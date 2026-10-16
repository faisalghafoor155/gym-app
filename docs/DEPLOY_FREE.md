# Deploying free, for a gym owner to test

The goal of this document is narrow: get the app onto the internet at no cost,
so a gym owner can open it on their own laptop and phone while your machine is
off. It is not the permanent handover — [DEPLOY.md](DEPLOY.md) is that, on a
VPS with your own domain. Come back to this one when the owner says yes.

About 40 minutes, most of it waiting for a build.

| | Service | Free tier | Runs out? |
|---|---|---|---|
| App + API | Render | 750 hrs/month | no |
| Database | Neon | 0.5 GB | no |
| Mail | Resend | 3,000/month | no |
| Keep-awake | UptimeRobot | 50 monitors | no |

---

## Why one service and not two

The obvious shape is React on Vercel and the API on Render. It does not work
here, and it fails in a way that looks like a bug rather than a
misconfiguration: everything loads, the login POST returns 200, and then every
following request arrives logged out.

The session cookie is `sameSite: 'lax'` (`backend/src/services/session.ts`).
Two different hosts are two different sites, so the browser declines to send
it. The only way to make the split work is `sameSite: 'none'`, and that lax
setting is the entire CSRF defence for this API — there are no CSRF tokens
anywhere, because there has never needed to be.

So Express serves the React bundle itself, from the same origin, via
`SERVE_STATIC_DIR`. The browser sees one host. Nothing about cookies, CORS or
auth has to change, and no secret can end up in the bundle because the bundle
needs none.

If you want the Vercel URL later, the safe version is Vercel proxying `/api`
through to Render with a `vercel.json` rewrite — one origin as far as the
browser is concerned. Not covered here; it is a second thing to debug and buys
nothing for a demo.

---

## Why Neon and not Render's database

**Render's free Postgres is deleted 30 days after you create it.** Not
suspended — deleted. A gym owner three weeks into testing would lose every
member, payment and attendance record, and the only warning is an email to
you. Neon's free tier has no such expiry.

This is why `render.yaml` has no `databases:` block and `DATABASE_URL` is set
by hand.

---

## 1. The database (Neon)

1. Sign up at [neon.tech](https://neon.tech) with GitHub.
2. Create a project — name it `gym-app`, pick the region closest to the gym.
3. On the dashboard, open **Connection string** and **turn on "Connection
   pooling"**. Copy the pooled string. It looks like:

```
postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

Two details decide whether this works:

- **`-pooler` must be in the hostname.** The free service sleeps and wakes, and
  each wake opens fresh connections; against the direct host they accumulate
  until Postgres refuses new ones, which surfaces days later as intermittent
  500s rather than as an obvious failure.
- **`?sslmode=require` must be on the end.** Neon refuses plaintext, and the
  error Prisma reports for a missing SSL mode does not mention SSL.

Keep this string for step 3. Nothing else here needs it — you never run
migrations by hand; Render's build does it.

---

## 2. Generate the two keys you cannot lose

On any machine with openssl (Git Bash has it):

```sh
openssl rand -base64 32     # BIOMETRIC_KEY
```

`JWT_SECRET` you do not generate — Render makes it for you.

**`BIOMETRIC_KEY` is required even with no fingerprint reader attached.** The
server calls `process.exit(1)` at boot without it (`backend/src/index.ts`), so
the symptom is a service that deploys green and then dies in a restart loop.

Put it in a password manager now. Lose it and every enrolled member has to be
re-enrolled at the desk; there is no recovery path.

---

## 3. The app (Render)

Push first — Render reads the blueprint from the repo:

```sh
git push origin main
```

Then:

1. [render.com](https://render.com) → sign up with GitHub.
2. **New → Blueprint**, pick the `gym-app` repo. Render finds `render.yaml`
   and shows one web service, `gym-app`.
3. It asks for the variables marked `sync: false`. Fill in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon string from §1 |
   | `BIOMETRIC_KEY` | the key from §2 |
   | `APP_URL` | `https://gym-app.onrender.com` — *your* assigned URL |
   | `APP_BASE_URL` | the same URL |

   You will not know the URL until Render assigns it. Put anything in, deploy,
   then correct both from the dashboard once you can see it — links in emails
   are built from `APP_URL`, so a wrong value produces reset links that go
   nowhere.

4. **Apply**. The first build takes 5–10 minutes: two npm installs, a Vite
   build, a tsc build, and `prisma migrate deploy` creating all 37 migrations
   against the empty Neon database.

### When it fails

Read the build log top to bottom; the first error is the real one.

| Log says | Cause |
|---|---|
| `tsc: not found` | `--include=dev` lost from the build command |
| `Can't reach database server` | direct Neon host, or `?sslmode=require` missing |
| `BIOMETRIC_KEY` error, restart loop | §2 not done |
| `preDeployCommand` rejected | a `preDeployCommand:` came back into `render.yaml`; it is paid-only |

After it goes live, open the **Logs** tab and find:

```
[startup] This deployment has unsafe settings for production:
```

Everything listed there is something the app has decided to tolerate and tell
you about. On a fresh free deploy you should expect exactly two — mail and S3 —
and both are addressed below. **Anything else listed is a real
misconfiguration**, most often `HTTPS` or `TRUST_PROXY_HOPS` not reaching the
container.

---

## 4. Stop it falling asleep

A free Render service sleeps after 15 minutes with no traffic. The next visitor
waits ~50 seconds staring at nothing, which reads as broken. Worse, the three
`node-cron` jobs — expiry reminders, fingerprint retention, subscription
billing — simply never fire while it sleeps, and nothing reports that they
didn't.

1. [uptimerobot.com](https://uptimerobot.com) → free account.
2. **Add New Monitor** → HTTP(s), URL `https://your-app.onrender.com/api/health`,
   interval **5 minutes**.

`/api/health` is the right target: it returns `{"status":"ok"}` without touching
the database, so the ping costs nothing and stays green even if Postgres is
briefly unreachable.

This keeps the service inside the 750 free instance-hours — one always-on
service is ~730.

---

## 5. Mail

Skippable for a first look, but a gym owner who forgets their password has no
way back in without it, and they will not get an error — `sendMail` never
throws, and forgot-password answers identically either way, both deliberate.

1. [resend.com](https://resend.com) → **API Keys → Create**.
2. In Render → **Environment**, add `RESEND_API_KEY`.
3. **Leave `MAIL_FROM` unset.** Mail then goes from `onboarding@resend.dev`,
   which needs no DNS. Setting it to an unverified domain makes Resend refuse
   every send — which looks configured and works worse than not setting it.

Render restarts on save. The mail warning should be gone from the boot log.

---

## 6. Create the demo gym

Register through the app — there is no bootstrap script, and the registration
endpoint is what creates a gym and its owner together in one transaction
(`backend/src/controllers/auth.ts`).

1. Open `https://your-app.onrender.com` — you get the login page.
2. **Register**, and fill in:

   | Field | Use |
   |---|---|
   | Gym name | the real gym's name |
   | Owner name | the owner's name |
   | Email | an address **you** control, for now |
   | Password | generate one, store it in your password manager |

3. You are signed in as `owner` of a brand-new gym, with its own `gymId`.

Use your own email, not the owner's. Password reset and email verification both
run through it, and you want to be the one who can recover the account while
this is still a demo.

### Fill it with data worth looking at

An empty app demos badly — every dashboard panel reads zero and no filter tab
has anything behind it. The seed script fixes that, and it is additive: it never
deletes, and it never touches accounts that can sign in.

It has to run against Neon, from your machine, with the same two secrets the
server uses:

```sh
cd backend
DATABASE_URL="<the pooled Neon string>" \
BIOMETRIC_KEY="<the key from §2>" \
npm run db:seed
```

`BIOMETRIC_KEY` is needed because seeded fingerprint enrolments are encrypted on
the way in, exactly as the app does it.

Run it once. Every run adds another batch of members.

### Hand it over

Give the owner the URL and the login. Two things worth saying out loud:

- **The first load after a quiet spell may take a moment.** With UptimeRobot
  running it should not, but if they open it before you have set that up, it
  will.
- **Photo uploads will be refused** until S3 is configured (§8).

If you would rather they had their own account than shared yours, invite them
from **Staff** inside the app once mail works — that sends a real invite link
and gives them a separate login you can revoke.

---

## 7. Test it properly

From a machine that is not yours, with your laptop **off**. That last part is
the actual test.

```sh
# Health, without waking anything expensive
curl https://your-app.onrender.com/api/health
# {"status":"ok"}

# The session cookie must come back Secure AND HttpOnly
curl -si https://your-app.onrender.com/api/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | grep -i set-cookie
```

The cookie must carry **both** `Secure` and `HttpOnly`. Missing `Secure` means
`HTTPS=true` did not reach the container — check Render's Environment tab.

Then in a browser, in this order. Each step covers something the one before it
cannot:

- [ ] Log in, reload the page, still logged in — the cookie is being stored and
      returned.
- [ ] Add a member, take a payment, check them in — the write path reaches Neon.
- [ ] Log out, log back in.
- [ ] **Trigger a password reset and follow the emailed link to a changed
      password.** This exercises mail, `APP_URL` and TLS in one action, and it is
      the flow that strands people when any of the three is wrong.
- [ ] On a phone: open the URL, **Add to Home Screen**, launch it from the icon.
      It should open standalone with no browser chrome.
- [ ] Turn the phone to airplane mode and reopen it — you should get the app
      shell, not the browser's offline dinosaur. Data will be empty; that is
      correct, the service worker deliberately caches no `/api` response so a
      logged-out phone holds no member data.
- [ ] Register a **second** gym with a different email, add a member to it, and
      confirm from the first account that it is invisible. This is the
      multi-tenant `gymId` isolation, and it is worth proving once against the
      deployed database rather than trusting it.

Then work through [UAT.md](UAT.md) against the deployed URL.

---

## 8. What stays switched off, and what that costs

None of these stop a demo. Each degrades one feature quietly, which is why they
are written down rather than left to be found.

| Missing | What the owner sees |
|---|---|
| `S3_BUCKET_NAME` + `AWS_*` | member photo uploads refused with a clear message |
| `WHATSAPP_TOKEN` | no WhatsApp receipts or expiry reminders (email still goes) |
| `JAZZCASH_*` / `EASYPAISA_*` | online renewals become front-desk requests for staff to confirm |
| `SENTRY_DSN` | errors only in Render's logs, which roll off |
| backups | **nothing is backed up** — see below |

### Backups

There are none on this setup. `docker/backup.sh` belongs to the compose stack
and is not running anywhere here.

Neon's free tier keeps a 24-hour restore window, which covers "I deleted
something this morning" and nothing else. For a demo that is an acceptable
trade. Before the gym relies on this for real records, either move to
[DEPLOY.md](DEPLOY.md) or take a dump yourself:

```sh
pg_dump "<the pooled Neon string>" > gym-backup.sql
```

### Photos, if you want them

Cloudflare R2 has a free tier and speaks the S3 API, so it needs no code
change — set `AWS_*` and `S3_BUCKET_NAME` to R2's values and `AWS_REGION=auto`.

---

## 9. The desktop .exe on the same data

The gym's PC runs `GymPro-Portable.exe`; the owner manages the gym from the
website on their phone. Both read and write the same Neon database, so a
member added at the desk shows on the phone straight away.

Put a file called `gympro-config.json` **in the same folder as the .exe**
(on the USB is fine). Start from `gympro-config.example.json` in the repo:

```json
{
  "databaseUrl": "<the pooled Neon string from §1>",
  "biometricKey": "<the SAME key you gave Render in §2>",
  "appUrl": "https://<your-service>.onrender.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "<gmail address>",
  "smtpPass": "<gmail app password>"
}
```

- **`biometricKey` must match Render's `BIOMETRIC_KEY` exactly.** Two-factor
  secrets and fingerprints are encrypted with it; with a different key, a
  record written on one side cannot be read on the other.
- **`appUrl`** makes invite and reset links point at the website, so they open
  on a phone anywhere — not at the gym PC.
- Mail is optional; blank values are ignored.
- With `databaseUrl` set the .exe does not start its own database, and it
  leaves the daily reminders to Render so members are not messaged twice.
- **The desk now needs internet.** With none, the .exe waits on its splash
  screen ("No internet — waiting…") and closes after about 90 seconds.
- The file holds the database password. It is in `.gitignore`; keep it off
  anything shared.

Remove the file (or empty `databaseUrl`) and the .exe goes back to its own
database on that PC — which still has whatever it held before.

## The limits, in one place

| | Limit | Consequence |
|---|---|---|
| Render | sleeps after 15 min idle | ~50s cold start; cron jobs skipped. §4 fixes it |
| Render | 750 instance-hours/month | one always-on service fits, a second does not |
| Render | 512 MB RAM, shared CPU | fine for one gym; the build is the tight part |
| Render | logs roll off | no error history — that is what Sentry would be for |
| Neon | 0.5 GB storage | thousands of members; photos are the only real consumer, and they go to S3 |
| Neon | scales to zero | ~1s on the first query after idle |
| Resend | 3,000/month, 100/day | expiry reminders to a large gym could approach the daily cap |
| all | no SLA, no support | fine for a demo, not for a gym's only record of who paid |

The honest summary: this is a demo that survives your laptop being off. It is
not somewhere a gym should keep its only copy of who has paid. When the owner
says yes, move to [DEPLOY.md](DEPLOY.md).
