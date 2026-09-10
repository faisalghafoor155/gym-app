# UAT — a gym's day, end to end

Run before handover, against the Docker stack rather than the dev servers: the
containers are what the client gets, and a Vite dev server hides a class of
problems (proxy rules, the built bundle, the service worker) that only show up
in the real build.

```sh
cd docker
docker compose up -d --build
```

Then <http://localhost:8080>.

## Before you start

**Rebuild, do not reuse.** `up -d` alone leaves yesterday's image running and
you will test code you did not write. `--build` is not optional here.

**Accounts.** The seed creates an owner and no staff, so the staff accounts
below were created for this run. Password for all of them: `password123`.

| Account | Role | Tests |
|---|---|---|
| `faisalghafoor015@gmail.com` | owner | everything, plus staff management |
| `manager@uat.test` | manager | full access except staff management |
| `membersmanager@uat.test` | members_manager | members and memberships |
| `accountant@uat.test` | accountant | payments, expenses, reports |
| `receptionist@uat.test` | receptionist | check-in and attendance |
| `inventorymanager@uat.test` | inventory_manager | supplements and stock |

**Gym.** APEX — 266 members, 398 payments, 11 trainers, on the `basic` plan.
The plan matters: `basic` is what most clients will be on, so anything gated
behind `pro` should be visibly locked rather than broken.

**No account has 2FA yet, and no member has a login.** Both are set up inside
the script below, at the points where you would naturally create them.

---

## 1. First impressions — the owner signs in

- [ ] Sign in as the owner. Dashboard loads without a flash of an empty state.
- [ ] Every number on the dashboard is plausible against 266 members — not 0,
      not `NaN`, not `Rs. NaN`.
- [ ] Sidebar shows the owner's full list, ending with Security.
- [ ] Switch the theme. Nothing becomes unreadable — check the dashboard tiles
      and one table.
- [ ] Reload. You stay signed in, and the theme you picked survives with you.

## 2. The front desk — the busiest screen

Sign in as `receptionist@uat.test` in a **private window**, so the owner
session stays open in the other.

- [ ] The sidebar is *shorter*. No Payments, no Expenses, no Staff, no Plans.
      This is the permission-gated nav doing its job.
- [ ] Attendance page loads.
- [ ] Check a member in by searching their name or member number.
- [ ] Check the **same** member in again. The app should say they are already
      in rather than silently double-counting.
- [ ] Check in a member whose membership has expired. The result should say so
      clearly — this is the moment the front desk needs to ask for money.
- [ ] Try to reach `/payments` by typing the URL. You should not get the page.

> A receptionist who can *see* the member list is correct — they cannot edit
> it. Verified at the API: `POST /api/members` returns 403 for this account.

## 3. Money in — recording a payment

Back to the owner, or `accountant@uat.test`.

- [ ] Payments page: the tiles above the table read "matching filters" and the
      totals are the server's, not the sum of the page. Change a filter and
      watch them move.
- [ ] Record a **cash** payment against a member. It appears in the list.
- [ ] Record an **online** payment — pick a wallet, enter a transaction id.
      Both are stored and shown.
- [ ] Edit that online payment and switch it to **cash**. The wallet and
      transaction id must disappear, not linger. *(The unit tests pin this
      rule; confirm it holds in the real app.)*
- [ ] Edit any payment. The member field is read-only — money cannot be moved
      between members by editing.
- [ ] Delete a payment. It asks first, and says the deletion is permanent.
- [ ] Export CSV. It opens in Excel with columns intact and names not mangled.

## 4. Money out — expenses and profit

- [ ] Record an expense with a vendor and notes.
- [ ] Record one leaving vendor and notes **blank**. It saves — a blank vendor
      is "no vendor", not an error.
- [ ] The profit tiles move by what you just spent.
- [ ] Filter by category. The tiles and the table describe the same window.
- [ ] Edit the amount. Profit follows.
- [ ] Delete it. Profit goes back.

## 5. Selling a membership — the full cycle

- [ ] Add a new member with a photo. The photo shows on their row.
- [ ] Try adding a second member with the **same phone number**. The app warns
      about the duplicate.
- [ ] Sell them a membership. The expiry date is right for the plan duration.
- [ ] Their status becomes `active`; the dashboard active count goes up by one.
- [ ] Renew before it expires. The new period starts from the old expiry, not
      from today — a member who renews early must not lose days.
- [ ] View or print a receipt. The gym name, address and phone are on it.

## 6. Trainers and PT

- [ ] Add a trainer leaving the assignment fee **blank**. Blank means the gym
      default — the trainer must not end up assigned for free.
- [ ] Add another with a fee of `0`. That is a deliberate free assignment and
      must survive as zero.
- [ ] Assign a trainer to a member and log a PT session.
- [ ] Mark it completed, then paid. The commission updates.
- [ ] Deactivate a trainer. Members already assigned keep their history.

## 7. Supplements and stock

Sign in as `inventorymanager@uat.test`.

- [ ] The sidebar shows Supplements and little else.
- [ ] Sell a supplement. Stock drops by the quantity sold.
- [ ] Sell more than the stock on hand. It should refuse, not go negative.
- [ ] Restock. The number goes back up.

## 8. Classes

- [ ] Create a class and put it on the timetable.
- [ ] Book a member onto a slot.
- [ ] Fill the slot to capacity, then try one more. It should refuse rather
      than overbook.
- [ ] Cancel a booking. The place is freed.

## 9. Staff and permissions — owner only

- [ ] Team page: add a staff account by **invite**. Note whether the email
      actually arrives (see "What will not work locally").
- [ ] Add one with a **typed password** instead. Sign in as them in a private
      window to prove the password works.
- [ ] Open **Change Permissions** on a staff member and check the picker:
      - Levels read as plain names — "Full Access", not "Full Access (Manager)".
      - Order runs widest to narrowest, Manager first.
      - Changing the level updates the description **and** the capability chips.
- [ ] Set someone to `accountant`, sign in as them, and confirm the sidebar
      matches the chips you were shown.
- [ ] Revoke an account. They are signed out and cannot sign back in.

### Ownership transfer — the one action with no way back

- [ ] The crown icon appears only on **staff** rows, never on a member's portal
      login and never on your own.
- [ ] Transfer to a staff account. You become staff, they become owner, and
      your other open sessions are signed out.
- [ ] Confirm you **cannot** take it back — only an owner may transfer, and you
      are not one any more. Have the new owner transfer it back to you.

### The part the UI cannot show you

A hidden page is not a locked door: the browser decides what to draw, the
server decides what to allow. These two used to disagree, so they are worth
re-checking whenever permissions change.

- [ ] Sign in as `receptionist@uat.test`. There is no Membership Plans link and
      no Workout & Diet link in the sidebar — that is the browser's half.
- [ ] Now the server's half. With the receptionist signed in, open the browser
      console (F12) and run:

      ```js
      await fetch('/api/membership-plans', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Should fail', price: 1, durationDays: 365 })
      }).then(r => r.status)
      ```

      **Expect `403`.** A `201` means a receptionist can sell a year for one
      rupee, which is the failure this check exists for.

- [ ] Same again against `/api/plans/workout` with `{ name: 'Should fail' }`.
      Expect `403`.

## 10. Two-factor — the part with no safety net

Do this on a staff account first, **not** the owner, until you have seen it
work once end to end.

- [ ] Security page: enable 2FA. A QR code appears with the manual key beside it.
- [ ] Scan it with Google Authenticator or any TOTP app.
- [ ] **Save the backup codes.** They are shown once and never again.
- [ ] Enter the 6-digit code. 2FA turns on.
- [ ] Sign out, sign in again — after the password you are asked for the code.
- [ ] Enter a **wrong** code. Refused, and you stay on the code step.
- [ ] Enter the right code. You are in.
- [ ] Sign out and sign in with a **backup code** instead of the app.
- [ ] Use that same backup code again. It must be refused — single use.
- [ ] Security page shows one fewer backup code remaining.
- [ ] Spend codes until two are left. The count on the Security page turns
      amber and tells you to generate a new set.
- [ ] Click **New backup codes**. It asks for your password.
- [ ] Enter a **wrong** password. Refused, and your existing codes still work.
- [ ] Enter the right one. Eight fresh codes appear — save them.
- [ ] Try one of the **old** codes at sign-in. It must be refused: regenerating
      kills the previous set.
- [ ] Sign in with one of the **new** codes. It works.
- [ ] Your authenticator app still gives valid codes — regenerating does not
      change the secret, so there is nothing to re-scan.
- [ ] Disable 2FA. It asks for your **password**, not a code — someone who has
      lost their phone must still be able to turn it off.

## 11. The member's own view

- [ ] Give a member a login (Team page, add member account).
- [ ] Sign in as them in a private window.
- [ ] They see **only** My Membership — no member list, no money, no staff.
- [ ] Their expiry date and days remaining are correct.
- [ ] They can book a class and cancel it.
- [ ] They can edit their own profile but not their membership.

## 12. On a phone — where this app actually lives

Use a real phone on the same network, or DevTools device mode at 360px.

- [ ] Sidebar collapses to a drawer; tapping a link closes it.
- [ ] Check-in works one-handed.
- [ ] Tables scroll sideways rather than pushing the page wide.
- [ ] Recording a payment is possible without pinch-zooming.
- [ ] Install the PWA. It opens without browser chrome.
- [ ] Turn **airplane mode on**. The app still opens to its cached shell.
- [ ] Try to save something offline. It says you are offline — not "failed to
      save member", which would read as the save being rejected.
- [ ] Turn it off. The next save works.

## 13. Things that should fail

Worth ten minutes, because this is what an untrained user does by accident.

- [ ] Sign in with a wrong password five times. The rate limiter kicks in.
- [ ] Sell a membership with no plan selected. Refused clearly.
- [ ] Enter a negative payment amount. Refused.
- [ ] Enter text where a number belongs. Refused without crashing.
- [ ] Open two tabs, delete a member in one, act on them in the other. The
      second tab fails gracefully rather than white-screening.
- [ ] Leave a session overnight, then use it. It either works or sends you to
      the login page — it does not hang.

---

## What will not work locally

Not bugs; they need real credentials or a public URL, and each will look like a
failure if you are not expecting it.

| Feature | Why | To test properly |
|---|---|---|
| Invite / reset emails | SMTP not configured locally | set the mail vars, then `npm run check:mail` in `backend/` |
| WhatsApp reminders | needs a provider account | `npm run check:whatsapp` |
| Google sign-in | client id is origin-bound | add `localhost:8080` as an authorised origin |
| Online payment callbacks | the gateway must reach a public URL | needs the deployed URL |
| Fingerprint reader | needs the physical device | on-site only |

## 14. Payment gateways — with the client's own merchant account

Everything above runs against test credentials. This section is the one part
that cannot be rehearsed: it needs the client's real merchant account, and it
moves real money. **It happens on the client's deployment, on the permanent
domain — not on a tunnel, not on localhost.** The gateway posts its callback to
a URL it must be able to reach, and a temporary hostname stops resolving the
moment the tunnel restarts.

Do it in two passes. The logic underneath is already covered by 30 automated
cases in `backend/tests/routes/onlinePayments.integration.test.ts`, including
the failure and duplicate paths below — what these passes prove is that the
*credentials and URLs* are right, which no test can check.

### Pass 1 — sandbox credentials

No real money. Confirms the wiring end to end.

- [ ] `JAZZCASH_POST_URL` / `EASYPAISA_POST_URL` point at the **sandbox** host.
- [ ] Member signs in to the portal, picks a plan, presses pay.
- [ ] The browser lands on the provider's page — not an error, not a blank form.
      A blank or rejected form almost always means the merchant id, password or
      integrity salt is wrong.
- [ ] Complete the payment with the provider's sandbox test card or account.
- [ ] You are returned to the app and the payment reads **paid**.
- [ ] The membership is active, with the expiry the plan should give.
- [ ] The member receives the WhatsApp receipt naming the plan and the amount.
- [ ] The audit log names the gateway, not the member, as what moved it.

### Pass 2 — production credentials, one small real payment

- [ ] `JAZZCASH_POST_URL` / `EASYPAISA_POST_URL` now point at the **production**
      host. JazzCash defaults to sandbox when unset, so an unset value here is
      the single most likely way to ship a gym that cannot take money.
- [ ] Take **one** small real payment (Rs. 50) from a real account.
- [ ] Everything in Pass 1 holds.
- [ ] Refund it through the provider's own dashboard, and note that the app
      does not know about the refund — the payment row stays `paid` and must be
      corrected at the desk.

### The failure cases — do not skip these

These are the ones that cost money when they are wrong, and each has an
automated test, so a failure here means a configuration difference rather than
a logic bug.

- [ ] **Cancel at the provider's page.** No membership is created, and the
      payment does not appear as paid.
- [ ] **A declined payment** (the provider's test card for failure). Recorded
      as failed; nothing is granted.
- [ ] **No double charge.** Complete a payment, then press the browser's back
      button and submit again. The member gets one membership and one payment,
      not two.
- [ ] **The member cannot grant themselves anything.** Start a checkout and
      close the tab before paying. The intent stays pending and expires after
      an hour; no membership appears.

### If a callback never arrives

The commonest cause is the callback URL, not the code. Check, in this order:

1. `APP_URL` is the permanent domain and is reachable from the public internet.
2. The provider's merchant dashboard has that same callback URL registered.
3. `docker logs gym-app-backend-1` shows the callback arriving at all. If it
   does not, the problem is between the provider and the server. If it arrives
   and is rejected, the log says why — usually a signature mismatch, which
   means the integrity salt differs from the one in the dashboard.

## Recording what you find

For each problem: **what you did, what happened, what you expected**, plus the
account and the page. A screenshot of the browser console (F12) is worth more
than a description when something white-screens.

Triage before anything goes to the client:

- **Blocks the gym's day** — check-in, taking money, signing in. Fix first.
- **Wrong data** — a number that disagrees with the database. Fix before
  handover; the client will trust these numbers.
- **Awkward but workable** — note it, decide together.
- **Cosmetic** — list it, do not delay handover for it.
