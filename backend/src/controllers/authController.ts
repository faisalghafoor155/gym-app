import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { setSessionCookie, clearSessionCookie, revokeSessions } from '../services/session.js';
import type { AuthedRequest } from '../types.js';
import type {
  RegisterBody, LoginBody, ForgotPasswordBody, ResetPasswordBody,
  GoogleAuthBody, ChangePasswordBody, AcceptInviteBody,
} from '../schemas.js';
import { appUrl, findValidInvite } from '../services/invite.js';
import { verifyGoogleToken } from '../services/google.js';
import { DEFAULT_PLANS } from '../services/membership.js';
import {
  describePackage, ensureSubscription, issueInvoiceIfDue, termFor,
} from '../services/billing.js';
import { subscriptionsEnabled } from '../services/subscription.js';
import { sendMail, passwordResetMail } from '../services/mail.js';
import { notifyOperatorOfPendingGym } from '../services/operatorNotify.js';
import { isPlatformAdmin } from '../services/platformAdmin.js';
import {
  issueEmailVerification, consumeEmailVerification,
} from '../services/emailVerification.js';
import {
  signTwoFactorChallenge, verifyTwoFactorChallenge,
  matchTotpStep, consumeTotpStep, consumeBackupCode, readTwoFactorSecret,
  isTwoFactorLocked, recordFailedTwoFactorAttempt, clearTwoFactorAttempts,
} from '../services/twoFactor.js';

/** A reset link is short-lived; an old inbox should not be a way in. */
const RESET_TTL_MS = 60 * 60 * 1000;

/** Compared against when no account matches, at the same cost as a real one. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/**
 * Signs the session into an httpOnly cookie and returns the body. The token
 * itself never reaches the response body, so no script can read it.
 */
const startSession = (res: Response, user: {
  id: string; name: string; email: string; role: string; memberId: string | null;
  tokenVersion: number; staffPermission?: string | null;
  emailVerifiedAt?: Date | null;
  gym: {
    id: string; name: string; ownerName: string;
    phone: string | null; address: string | null;
    logo?: string | null;
  };
}) => {
  setSessionCookie(res, user.id, user.tokenVersion);
  return {
    user: {
      id: user.id, name: user.name, email: user.email,
      role: user.role, memberId: user.memberId,
      staffPermission: user.staffPermission,
      emailVerified: (user.emailVerifiedAt ?? null) !== null,
      isPlatformAdmin: isPlatformAdmin(user),
    },
    gym: {
      id: user.gym.id,
      name: user.gym.name,
      ownerName: user.gym.ownerName,
      phone: user.gym.phone,
      address: user.gym.address,
      logo: user.gym.logo ?? null,
    },
  };
};

/**
 * The gym as every signed-in client sees it.
 *
 * `phone` and `address` are here rather than fetched when needed because the
 * receipt needs them and a member cannot ask for them any other way:
 * `/gym-settings` is staff-only, so a member printing their own receipt would
 * get a 403. They are on the session for the same reason the name already
 * was — it is what the app prints on the gym's behalf, and it is not secret.
 */
const sessionInclude = {
  gym: {
    select: {
      id: true,
      name: true,
      ownerName: true,
      phone: true,
      address: true,
      logo: true,
      suspendedAt: true,
      suspendedReason: true,
    },
  },
} as const;

/**
 * Refuses a sign-in when the gym itself is suspended.
 *
 * `requireAuth` blocks every other route, but the sign-in paths run before it
 * and would otherwise hand out a perfectly valid cookie that fails on the very
 * next request — which reads as a broken app rather than a suspended one. The
 * refusal has to happen where the session is created.
 *
 * Returns true when it has answered, so each caller can stop.
 */
const refusedForSuspension = (
  res: Response,
  gym: { suspendedAt: Date | null; suspendedReason: string | null },
): boolean => {
  if (!gym.suspendedAt) return false;
  res.status(403).json({
    error:
      gym.suspendedReason ??
      "This gym's access has been suspended. Please contact support.",
    reason: 'gym_suspended',
  });
  return true;
};

/**
 * The answer when the first factor passed but the account has a second one.
 * No cookie, no lastLoginAt — the sign-in is not complete until the challenge
 * comes back through /auth/two-factor/verify-login with a valid code.
 */
const startTwoFactorChallenge = (user: { id: string; tokenVersion: number }) => ({
  requiresTwoFactor: true as const,
  twoFactorToken: signTwoFactorChallenge(user.id, user.tokenVersion),
});

/**
 * What a gym waiting for the operator's go-ahead is told. Doubles as the
 * marker: `suspendGym.ts` recognises it to list the gym as pending.
 */
export const PENDING_APPROVAL_REASON =
  'Your gym is waiting for approval. We will contact you once it is activated.';

/**
 * Whether a new gym must be approved before it can be used. On unless
 * explicitly set to "false" — an open signup that hands the full app to anybody
 * is the thing to opt into, not the default. Read per call so a test or an
 * operator can flip it without a restart.
 */
export const gymApprovalRequired = (): boolean =>
  process.env.REQUIRE_GYM_APPROVAL !== 'false';

/**
 * Public signup creates a NEW gym; the account that creates it is its owner.
 *
 * With approval required the gym is born suspended: everything exists and the
 * owner can sign in once it is lifted, but no session is issued now — a cookie
 * that fails on its first request reads as a broken app.
 */
export const register = async (
  req: Request<unknown, unknown, RegisterBody>,
  res: Response,
): Promise<void> => {
  const { gymName, ownerName, email, password, phone, plan, billingCycle } = req.body;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pending = gymApprovalRequired();
    const user = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          name: gymName,
          ownerName,
          phone,
          // Always free to start. A paid plan picked at sign-up only issues
          // its invoice below; `settleInvoice` moves the gym onto that plan
          // once the money arrives, the same as an upgrade from the billing page.
          plan: 'free',
          ...(pending && {
            suspendedAt: new Date(),
            suspendedReason: PENDING_APPROVAL_REASON,
          }),
        },
      });

      // A new gym starts with a price list to edit rather than an empty table.
      // Priced at zero on purpose — a made-up price looks like a real one.
      await tx.membershipPlan.createMany({
        data: DEFAULT_PLANS.map(p => ({ ...p, gymId: gym.id })),
      });

      return tx.user.create({
        data: {
          gymId: gym.id, email, passwordHash,
          name: ownerName, role: 'owner',
          lastLoginAt: new Date(),
        },
        include: sessionInclude,
      });
    });

    // The package as the operator will see it when deciding whether to approve.
    let pkg = describePackage(null);
    if (subscriptionsEnabled() && plan && plan !== 'free') {
      try {
        const sub = await ensureSubscription(
          user.gym.id,
          plan,
          termFor(plan, billingCycle ?? 'monthly'),
        );
        pkg = describePackage(sub);
        await issueInvoiceIfDue(sub.id, new Date());
      } catch (err) {
        console.error('[register] could not initialize subscription', err);
      }
    }

    // After the transaction, so a mail transport being slow or down cannot roll
    // back a gym that has already been created. Awaited before answering all
    // the same: on a serverless host the function may be frozen the moment the
    // response goes out, and a send still in flight then never arrives.
    // The address is unproven either way — this only starts the check.
    const notices: Promise<unknown>[] = [
      issueEmailVerification(user.id, {
        email: user.email,
        name: ownerName,
        gymName,
      }).catch((err: unknown) => {
        console.error('[verify-email] could not issue verification', err);
      }),
    ];
    if (pending) {
      notices.push(
        notifyOperatorOfPendingGym({
          gymId: user.gym.id,
          gymName,
          ownerName,
          email,
          phone,
          package: pkg,
        }).catch((err: unknown) => {
          console.error('[register] could not notify operator', err);
        }),
      );
    }
    await Promise.all(notices);

    if (pending) {
      res.status(202).json({ pendingApproval: true, message: PENDING_APPROVAL_REASON });
      return;
    }

    res.status(201).json(startSession(res, user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Confirms an address from the link that was mailed to it.
 *
 * Public: somebody clicking a link in their inbox may well not be signed in,
 * and requiring a session would make the common case fail. The token is the
 * credential, which is why it is single-use, short-lived and stored only as a
 * hash.
 */
export const verifyEmail = async (
  req: Request<unknown, unknown, { token: string }>,
  res: Response,
): Promise<void> => {
  try {
    const ok = await consumeEmailVerification(req.body.token);
    if (!ok) {
      res.status(400).json({ error: 'This link is invalid or has expired' });
      return;
    }
    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Sends the link again, for the address on the signed-in account. */
export const resendEmailVerification = async (
  req: AuthedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        gym: { select: { name: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (user.emailVerifiedAt) {
      res.status(400).json({ error: 'This address is already confirmed' });
      return;
    }

    const { emailed } = await issueEmailVerification(user.id, {
      email: user.email,
      name: user.name,
      gymName: user.gym.name,
    });

    // `emailed` is reported rather than assumed, so a deployment with no mail
    // transport says so instead of leaving somebody waiting for a message that
    // was only ever written to the container log.
    res.json({ emailed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (
  req: Request<unknown, unknown, LoginBody>,
  res: Response,
): Promise<void> => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: sessionInclude });

    // The same message for "no such account" and "wrong password" so the
    // endpoint cannot be used to discover which emails are registered. A
    // missing account still pays for one bcrypt compare, or the faster answer
    // would say the same thing the message is careful not to.
    if (!user?.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated' });
      return;
    }
    // The operator's own gym is held for approval like any other signup, and
    // the operator is the only one who can approve it — but cannot reach the
    // Platform page to do so while it is held. A verified owner on
    // PLATFORM_ADMIN_EMAILS is the person approval exists to ask, so their own
    // pending gym is let through here. Only the pending hold: a gym suspended
    // for any other reason stays suspended.
    if (
      user.gym.suspendedAt &&
      user.gym.suspendedReason === PENDING_APPROVAL_REASON &&
      isPlatformAdmin(user)
    ) {
      await prisma.gym.update({
        where: { id: user.gym.id },
        data: { suspendedAt: null, suspendedReason: null },
      });
      user.gym.suspendedAt = null;
      user.gym.suspendedReason = null;
    }
    // Checked before the second factor is even offered: making somebody find
    // their authenticator app to reach a refusal helps nobody.
    if (refusedForSuspension(res, user.gym)) return;
    if (user.twoFactorEnabled) {
      res.json(startTwoFactorChallenge(user));
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json(startSession(res, user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Completes a login that was answered with a 2FA challenge. The challenge
 * token proves the first factor already passed; the code is the second.
 * Either factor alone is useless, which is the whole point of 2FA.
 *
 * The code may be the 6-digit authenticator code or a backup code — the two
 * are told apart by shape, and a backup code is consumed as it is used.
 */
export const verifyTwoFactorLogin = async (
  req: Request<unknown, unknown, { token: string; code: string }>,
  res: Response,
): Promise<void> => {
  const { token, code } = req.body;
  try {
    const challenge = verifyTwoFactorChallenge(token);
    if (!challenge) {
      res.status(401).json({ error: 'Sign-in session expired. Please sign in again.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      include: sessionInclude,
    });

    // The challenge is only as fresh as the account it was issued for: a
    // password change or deactivation since then must void it.
    if (
      !user?.isActive
      || !user.twoFactorEnabled
      || !user.twoFactorSecret
      || user.tokenVersion !== challenge.tokenVersion
    ) {
      res.status(401).json({ error: 'Sign-in session expired. Please sign in again.' });
      return;
    }

    // Locked accounts are refused before the code is even looked at, so a
    // lock cannot be probed: the right code gets the same answer as a wrong one.
    if (isTwoFactorLocked(user.twoFactorLockedUntil)) {
      res.status(429).json({
        error: 'Too many wrong codes. Try again in 15 minutes.',
      });
      return;
    }

    let passed: boolean;
    if (code.includes('-')) {
      passed = await consumeBackupCode(user.id, code);
    } else {
      const step = matchTotpStep(readTwoFactorSecret(user.twoFactorSecret, user.id), code);
      // A code that matches but whose step was already spent is a replay.
      passed = step !== null && (await consumeTotpStep(user.id, step));
    }
    if (!passed) {
      await recordFailedTwoFactorAttempt(user.id);
      res.status(401).json({ error: 'Invalid code' });
      return;
    }
    await clearTwoFactorAttempts(user.id);

    // Checked again rather than trusted from the first step: the challenge is
    // valid for ten minutes, which is long enough for a gym to be suspended in
    // between, and this is the call that actually issues the cookie.
    if (refusedForSuspension(res, user.gym)) return;

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json(startSession(res, user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Signs in with a Google ID token. Only links to an account that already
 * exists — a Google login cannot create a gym or grant itself membership.
 */
export const googleAuth = async (
  req: Request<unknown, unknown, GoogleAuthBody>,
  res: Response,
): Promise<void> => {
  try {
    const profile = await verifyGoogleToken(req.body.credential);
    if (!profile) {
      res.status(401).json({ error: 'Google sign-in failed' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
      include: sessionInclude,
    });
    if (!user) {
      res.status(404).json({ error: 'No account found for this Google address. Ask your gym to add you first.' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated' });
      return;
    }
    // Suspension applies to every way in, or it applies to none of them.
    if (refusedForSuspension(res, user.gym)) return;
    // 2FA applies here too — Google verifying the password side does not
    // prove possession of the authenticator, and skipping it would make the
    // second factor optional for anyone who links a Google account.
    if (user.twoFactorEnabled) {
      res.json(startTwoFactorChallenge(user));
      return;
    }

    // First Google sign-in on an existing password account links the two.
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: profile.googleId, lastLoginAt: new Date() },
    });

    res.json(startSession(res, user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Always answers the same way whether or not the address exists, so this
 * cannot be used to enumerate accounts.
 */
export const forgotPassword = async (
  req: Request<unknown, unknown, ForgotPasswordBody>,
  res: Response,
): Promise<void> => {
  const reply = { message: 'If that email is registered, a reset link has been sent.' };
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
      include: { gym: { select: { name: true } } },
    });
    if (!user || !user.isActive) {
      res.json(reply);
      return;
    }

    // Only the hash is stored, so a database leak does not hand over live
    // reset links.
    const token = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenAt: new Date() },
    });

    const link = `${appUrl()}/reset-password?token=${token}`;

    // Awaited, so a mail server that hangs shows up as a slow request rather
    // than a silently dropped reset. `sendMail` never throws and logs the link
    // when SMTP is unconfigured, so the flow stays usable either way.
    await sendMail({
      to: user.email,
      fromName: user.gym?.name,
      ...passwordResetMail(link, RESET_TTL_MS / 60_000, user.gym?.name),
    });

    res.json(reply);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const resetPassword = async (
  req: Request<unknown, unknown, ResetPasswordBody>,
  res: Response,
): Promise<void> => {
  const { token, password } = req.body;
  try {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({ where: { resetTokenHash } });

    const expired = !user?.resetTokenAt
      || Date.now() - user.resetTokenAt.getTime() > RESET_TTL_MS;
    if (!user || expired) {
      res.status(400).json({ error: 'This reset link is invalid or has expired' });
      return;
    }

    // A reset is how someone recovers an account they may have lost control
    // of, so every session opened with the old password goes with it.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        resetTokenHash: null,
        resetTokenAt: null,
        tokenVersion: { increment: 1 },
      },
    });

    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Tells the invite page whether the link is worth showing a form for, so
 * somebody arriving on a dead link is told immediately rather than after
 * choosing a password.
 */
export const checkInvite = async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query['token'] === 'string' ? req.query['token'] : '';
  try {
    const invite = token ? await findValidInvite(token) : null;
    if (!invite) {
      res.status(400).json({ error: 'This invite link is invalid or has expired' });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: invite.userId },
      select: { name: true, email: true, role: true, ...sessionInclude },
    });

    // Enough to confirm the invite is for them, and nothing more — this is an
    // unauthenticated endpoint reachable by anyone holding the link.
    res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      gymName: user.gym.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Sets the password on an invited account and signs them straight in — a
 * second login prompt right after choosing a password is a step nobody needs.
 */
export const acceptInvite = async (
  req: Request<unknown, unknown, AcceptInviteBody>,
  res: Response,
): Promise<void> => {
  const { token, password } = req.body;
  try {
    const invite = await findValidInvite(token);
    if (!invite) {
      res.status(400).json({ error: 'This invite link is invalid or has expired' });
      return;
    }

    // Clearing the token in the same update is what makes the link single-use:
    // a second attempt finds no matching hash.
    const user = await prisma.user.update({
      where: { id: invite.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        inviteTokenHash: null,
        inviteTokenAt: null,
        lastLoginAt: new Date(),
        // Following a link sent to that address proves exactly what the
        // verification mail proves, so asking again would be theatre.
        emailVerifiedAt: new Date(),
      },
      include: sessionInclude,
    });

    // The invite was issued before the gym was suspended, and accepting it
    // would otherwise mint a session that fails on the next request.
    if (refusedForSuspension(res, user.gym)) return;

    res.json(startSession(res, user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const changePassword = async (
  req: AuthedRequest<Record<string, string>, unknown, ChangePasswordBody>,
  res: Response,
): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // An account created through Google has no password to confirm against;
    // setting one for the first time is allowed.
    if (user.passwordHash && !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });

    // Every other device is signed out, but the tab that just changed the
    // password keeps working: it gets a fresh cookie carrying the new version.
    setSessionCookie(res, user.id, updated.tokenVersion);
    res.json({ message: 'Password changed. Other devices have been signed out.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Sits in front of `auth` on the logout route. Signing out with a session that
 * is already dead — expired, or revoked from another device — should still
 * clear the cookie rather than answer 401 and leave it in the browser.
 *
 * `auth` replies through `res.status(401).json(...)`, so intercepting `json`
 * is what catches it; anything else passes through untouched.
 */
export const logoutFallback = (_req: Request, res: Response, next: NextFunction): void => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode === 401) {
      res.status(200);
      clearSessionCookie(res);
      return json({ message: 'Signed out' });
    }
    return json(body);
  };
  next();
};

/**
 * The cookie is httpOnly, so only the server can end the session. Clearing it
 * is not enough on its own — a copy of the token taken beforehand would still
 * be valid for the rest of its 30 days — so the account's token version moves
 * on and strands it.
 *
 * This signs the account out everywhere rather than just in this browser.
 * Sessions are not tracked individually, so there is nothing finer to revoke;
 * for an app where one person's account is one person's login, signing out
 * meaning "signed out" is the safer reading.
 */
export const logout = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    await revokeSessions(req.userId);
  } catch (err) {
    // The cookie still goes, so the browser is signed out either way.
    console.error(err);
  }
  clearSessionCookie(res);
  res.json({ message: 'Signed out' });
};

/** Who am I — the frontend restores a session from the cookie, not from storage. */
export const me = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: sessionInclude,
    });
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, memberId: user.memberId,
        staffPermission: user.staffPermission,
        // Drives the banner offering to send the link again. A boolean rather
        // than the timestamp: when it happened is nobody's business on screen.
        emailVerified: user.emailVerifiedAt !== null,
        isPlatformAdmin: isPlatformAdmin(user),
      },
      // Field by field rather than `user.gym`, which would also hand out
      // `suspendedAt` and `suspendedReason` — internal state that a signed-in
      // client has no use for. A suspended gym never reaches this line anyway.
      gym: {
        id: user.gym.id,
        name: user.gym.name,
        ownerName: user.gym.ownerName,
        phone: user.gym.phone,
        address: user.gym.address,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
