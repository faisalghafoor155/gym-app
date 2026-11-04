import jwt from 'jsonwebtoken';

/**
 * The token behind the "Approve" button in the operator's new-gym email.
 *
 * It lets the operator let a gym in straight from their inbox, without signing
 * in first. That makes the link itself the credential, so it says exactly one
 * thing — *this* gym may be approved — and nothing else: it cannot suspend,
 * delete, or approve a different gym, and the auth middleware refuses any
 * token with a `purpose`, so it can never be passed off as a session.
 *
 * A week, because a signup that arrives on a Friday may not be looked at
 * until Monday. Approving twice is harmless, so it need not be single-use.
 */
export const GYM_APPROVAL_PURPOSE = 'gym-approval' as const;
export const GYM_APPROVAL_TTL_SECONDS = 7 * 24 * 60 * 60;

export const signGymApprovalToken = (gymId: string): string =>
  jwt.sign({ gymId, purpose: GYM_APPROVAL_PURPOSE }, process.env.JWT_SECRET!, {
    expiresIn: GYM_APPROVAL_TTL_SECONDS,
  });

/** The gym a token was issued for, or null if it is malformed, expired or not one of ours. */
export const verifyGymApprovalToken = (token: string): string | null => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      gymId?: unknown;
      purpose?: unknown;
    };
    if (payload.purpose !== GYM_APPROVAL_PURPOSE || typeof payload.gymId !== 'string') return null;
    return payload.gymId;
  } catch {
    return null;
  }
};
