# Deploying for real — domain, TLS, and mail that keeps working

This is the one-time setup that turns the working stack into something a gym
can actually be handed. It replaces three temporary arrangements that all fail
the same way — silently, some days later:

| Temporary now | Fails when | Permanent here |
|---|---|---|
| Cloudflare quick tunnel | the tunnel restarts and the hostname dies | a domain you own, on a VPS |
| no TLS of your own | never — it just was never yours | Let's Encrypt, renewed by certbot |
| mail disabled | a staff member forgets their password | Resend on a verified domain |

Work through it in order. Each section ends with a check that either passes or
tells you what is wrong, and none of them is optional — the last section is the
one that catches the mistakes the earlier checks let through.

---

## 0. What you need before starting

- **A VPS.** Any provider — DigitalOcean, Hetzner, Contabo. The stack runs in
  about 2GB of RAM. Ports 80 and 443 must be reachable from the internet, which
  is the reason this does not run on an office machine: Let's Encrypt proves
  control of the domain by fetching a file over port 80, and a home connection
  usually cannot offer one at a stable address.
- **A domain**, with access to its DNS records.
- **Docker and Docker Compose** installed on the VPS.
- **An email address** for the certificate's expiry notices.

Roughly 45 minutes, most of it waiting for DNS.

---

## 1. Point the domain at the VPS

Create one A record:

```
Type: A      Name: gym  (or @ for the bare domain)
Value: <the VPS's public IP>       TTL: 300
```

Wait for it to take effect, and confirm from somewhere that is not the VPS:

```sh
dig +short gym.example.com
```

**This must print the VPS's IP before you go on.** Certbot's first request fails
if DNS has not propagated, and repeated failures hit Let's Encrypt's rate limit
— five failures per hour, per domain, and then you are locked out of issuing
for that domain while you work out what went wrong. Waiting five minutes here
is cheaper than waiting an hour there.

---

## 2. Get the code and fill in the configuration

```sh
git clone <your repo> gym-app
cd gym-app/docker
cp .env.example .env
```

Now edit `.env`. Three of these have no safe default and the server refuses to
start, or quietly loses data, without them:

```sh
# Generate each of these separately — never reuse one for another.
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 32   # BIOMETRIC_KEY
openssl rand -base64 32   # BACKUP_ENCRYPTION_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

| Setting | Value | Why it matters |
|---|---|---|
| `DOMAIN` | `gym.example.com` | Bare hostname. No `https://`, no trailing slash — nginx and certbot both build paths from it. |
| `POSTGRES_PASSWORD` | generated | — |
| `JWT_SECRET` | generated | Under 32 characters and the server exits at boot. |
| `BIOMETRIC_KEY` | generated | Encrypts fingerprint templates. **The server refuses to start without it.** Lose it and every member must be re-enrolled at the desk. |
| `BACKUP_ENCRYPTION_KEY` | generated | Without it, dumps are plaintext copies of every member's personal and payment data. |
| `APP_URL` | `https://gym.example.com` | The https overlay sets this too; setting it here keeps the two agreeing. |
| `HTTPS` | `true` | |
| `TRUST_PROXY_HOPS` | `1` | The nginx container is the only proxy. See §7 if you later put a CDN in front. |

**Keep `BIOMETRIC_KEY` and `BACKUP_ENCRYPTION_KEY` somewhere off this machine**
— a password manager, not a file beside the backups. They are the two values
that cannot be regenerated: everything else can be rotated, these two decrypt
data that already exists.

---

## 3. Issue the certificate

Port 80 must be free while this runs, so do it before bringing the stack up:

```sh
export DOMAIN=gym.example.com   # or read it from .env

docker compose -f docker-compose.yml -f docker-compose.https.yml \
  run --rm --service-ports certbot certonly \
  --standalone -d "$DOMAIN" --agree-tos -m you@example.com --no-eff-email
```

Expect `Successfully received certificate`. If instead it says the challenge
failed, the cause is almost always one of three things, in this order of
likelihood: DNS has not propagated (recheck §1), port 80 is closed on the VPS
firewall, or something else on the box is already listening on 80.

This is a **one-off**. The `certbot` container in the overlay renews twice a day
from here on, and never tries to issue — a container that issued on every boot
would exhaust the rate limit while you were still getting DNS right.

---

## 4. Bring the stack up on TLS

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

The overlay is applied **on top of** the base file, never instead of it. That
is why both `-f` flags are there every time — dropping the second one silently
returns you to plain http on port 8080, which is the exact hole the redirect
exists to close.

Check the boot log before anything else:

```sh
docker logs gym-app-backend-1 | head -30
```

The app reports its own unsafe settings at startup. An empty
`[startup] This deployment has unsafe settings` section is the goal; anything
listed there names what to fix and why.

---

## 5. Mail that keeps working

Mail is the failure nobody notices. `sendMail` never throws, and the
forgot-password endpoint answers identically whether or not the message went —
both deliberate, so the endpoint cannot be used to discover which addresses are
registered. Together they make a dead transport invisible from outside: a staff
member who forgets their password simply never receives anything, and no error
appears anywhere except this log.

### Use your own domain, not the shared sender

Resend works immediately with `onboarding@resend.dev` and no DNS setup, which is
right for a first test and wrong for a handover — it is a shared sender, the
mail reads as coming from a stranger, and you cannot influence its reputation.
For a permanent deployment, verify the domain:

1. **resend.com → Domains → Add Domain**, enter `example.com`.
2. Resend gives you DKIM and SPF records. Add them to the same DNS you edited
   in §1.
3. Wait for Resend to show **Verified** — usually minutes, occasionally an hour.
4. **API Keys → Create**, and copy the key.

Then in `docker/.env`:

```sh
RESEND_API_KEY=re_your_real_key
MAIL_FROM=noreply@example.com     # only after the domain shows Verified
```

**Order matters.** Setting `MAIL_FROM` to an unverified domain makes Resend
refuse every send — worse than the shared sender, because it looks configured.
If the domain is not verified yet, leave `MAIL_FROM` unset: mail goes from
`onboarding@resend.dev` and works.

While you are in DNS, add a DMARC record. Without one, some providers treat a
new sending domain with suspicion and mail lands in spam — which looks exactly
like mail that was never sent:

```
Type: TXT    Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:you@example.com
```

`p=none` only asks for reports; it rejects nothing. Tighten it later once the
reports show your own mail passing.

### Check it

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d backend
cd ../backend && npx tsx scripts/checkMail.ts you@example.com
```

This sends a real message and reports what the app would use. It exists
precisely because the app's own silence about mail is deliberate. **Confirm the
message arrives in the inbox, not the spam folder** — for a password reset,
spam is the same as never.

---

## 6. Verify TLS end to end

```sh
# Plain http redirects, and does not serve the app
curl -sI http://gym.example.com | head -1        # expect 301

# HSTS is set
curl -sI https://gym.example.com | grep -i strict-transport

# The session cookie comes back marked Secure — this is the whole point
curl -si https://gym.example.com/api/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"..."}' | grep -i set-cookie
```

The cookie must carry **both** `Secure` and `HttpOnly`. If `Secure` is missing,
TLS is working but the app does not know it: check `HTTPS=true` reached the
container with `docker exec gym-app-backend-1 printenv HTTPS`.

Then confirm renewal is actually wired up, rather than assuming:

```sh
docker compose -f docker-compose.yml -f docker-compose.https.yml \
  run --rm certbot renew --dry-run
```

A dry run that fails now is a certificate that expires in 90 days with nobody
watching. This is the single most valuable check in this document, because it
is the only failure here whose symptom is a whole gym locked out on a Tuesday
morning three months from now.

---

## 7. If you put Cloudflare or a CDN in front

Only then, raise the hop count so rate limiting still sees real client IPs:

```sh
TRUST_PROXY_HOPS=2
```

Too low and every request appears to come from the proxy, so one attacker
exhausts the login budget for every user at once. Too high and a client can
spoof its own IP through `X-Forwarded-For`. The right number is the count of
proxies actually in front of the app — no more, no less.

---

## 8. Backups — prove the restore, do not assume it

The stack takes an encrypted dump daily and prunes after `BACKUP_KEEP_DAYS`.
Two things are worth doing once, on the real deployment:

**Send them offsite.** Set `BACKUP_S3_BUCKET` and its credentials. Until then
the dumps sit on the same disk as the database they protect, which is not a
backup — it is a second copy of the thing that fails.

**Restore one.** An untested backup is a hypothesis:

```sh
docker exec gym-app-backup-1 sh -c '
  f=$(ls -t /backups/*.enc | head -1)
  psql -h db -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE restore_check"
  printf "%s" "$BACKUP_ENCRYPTION_KEY" \
    | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass stdin -in "$f" \
    | gunzip | psql -h db -U "$POSTGRES_USER" -d restore_check
  psql -h db -U "$POSTGRES_USER" -d restore_check -tAc "select count(*) from \"Member\""
  psql -h db -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE restore_check WITH (FORCE)"
'
```

The member count should match production. If the decrypt step fails,
`BACKUP_ENCRYPTION_KEY` has changed since that dump was written — which means
every dump older than the change is unreadable, and you want to know that now
rather than during an incident.

---

## 9. The last check

Sign in as the owner over `https://` and confirm, in this order:

- [ ] The padlock is present and the certificate names your domain.
- [ ] Signing out and back in works — the Secure cookie is being accepted.
- [ ] **Trigger a real password reset** and follow the emailed link all the way
      to a changed password. This exercises mail, `APP_URL`, and TLS in one
      action, and it is the flow that strands people when any of the three is
      wrong.
- [ ] `docker logs gym-app-backend-1 | grep -A10 "unsafe settings"` lists
      nothing you have not decided to accept.

Then go through [UAT.md](UAT.md) against the deployed site rather than a local
stack. Section 14 covers the payment gateways, which need the client's own
merchant credentials and cannot be rehearsed anywhere else.

---

## What still needs credentials you do not have yet

None of these stop a handover; each one degrades a feature quietly, which is
why they are listed rather than left to be discovered.

| Missing | What happens | Where it shows |
|---|---|---|
| `AWS_*` / `S3_BUCKET_NAME` | member photo uploads are refused | startup warning |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | no receipts, no expiry reminders | silent |
| `JAZZCASH_*` / `EASYPAISA_*` | online renewals become front-desk requests | startup warning |
| `BACKUP_S3_BUCKET` | backups stay on one disk | backup container log |
| `SENTRY_DSN` | errors go to stdout only | startup log |

The WhatsApp one is worth a note: the payment receipt template now carries a
fifth variable for the date, so **the template must be re-approved in Meta's
console before receipts will send at all**. Meta rejects a send whose variable
count disagrees with the approved body. The current body is in
`backend/src/services/whatsapp-templates.md`.
