# GymPro — Feature Roadmap

Features a complete gym management app still needs, ranked by impact.
Tick a box when a task ships.

**Status legend:** `[x]` done · `[ ]` not started · 🟠 partly there (note says what exists)

_Last checked against the code: 2026-11-23 (after Leads trials and follow-ups)._

---

## 🔴 Priority 1: brings in money directly

### 1. Leads / Enquiry CRM
People who walk in to ask about the gym, followed up until they join.
- [x] `Lead` model: name, phone, source (walk-in / Facebook / referral), interest, notes
  ✅ `Lead` table + `/api/leads` (`backend/src/controllers/leadsController.ts`)
- [x] Status pipeline: New → Contacted → Trial → Joined / Lost
  ✅ "Joined" is set only by converting, so it always links to a real member; a lost lead records why
- [x] Follow-up date with a "Today's follow-ups" list on the dashboard
  ✅ "Today's follow-ups" card on the dashboard (overdue first, call links, trial leads marked), for anyone with `canManageMembers`
- [x] Free trial pass (1–3 days) that lets a lead check in
  ✅ "Free trial" on a lead (1–7 days from today) moves it to On trial and sets a follow-up for the day after. While it runs, "Check in" on the Leads page records one visit a day (`LeadVisit`, kept out of member attendance); the row shows the trial's end and the visit count.
- [x] "Convert to member" button that pre-fills the member form
  ✅ "Make member" opens the normal registration form with name + phone; the lead is linked when it saves
- [x] WhatsApp follow-up reminder to staff
  ✅ Daily at nine, the gym's own number (Gym settings › phone) gets today's and overdue follow-ups: a count and the first five names (`jobs/leadFollowUps.ts`). Nothing on days with nobody to call. Needs the `lead_followups` template approved in Meta's console (`whatsapp-templates.md`).
- [x] Report: leads per source, conversion rate
  ✅ Shown at the top of the Leads page

### 2. Day Pass / Guest Entry
Walk-ins who pay for a single day.
- [x] Day pass sale (name, phone, amount) with no full member record
  ✅ Day Passes page (Payments menu) + `/api/day-passes`; cash or online with channel
- [ ] Shows in today's attendance and in the payment/collection reports
  🟠 Counted in the dashboard, payment summary (own "Day passes" column) and profit. Not in the Attendance page; the Day Passes page shows each day's walk-ins instead. Monthly Collection is member-by-member, so they don't appear there by design.
- [x] Guest of a member (bring-a-friend), with an optional limit per member
  ✅ Pick the host member when selling; the monthly limit is refused with a clear message
- [x] Day-pass price setting per gym
  ✅ Staff & Logins → Gym settings: day pass fee (prefilled) and guests per member a month

### 3. Installments
Split a membership fee across dates.
- [x] Installment plan when selling a membership (e.g. 3 parts, with due dates)
  ✅ Register and Renew both offer "Pay the rest in installments": 2–6 parts a month apart, every amount and date editable, up to 12 parts through the API. A plan can also be agreed, changed or removed later from Pending Dues (`PUT /api/members/:id/memberships/:membershipId/installments`). The parts must add up to what is owed.
- [x] Each installment shows in Dues until paid
  ✅ Each part on the row (paid / partly / due / overdue), the overdue amount, the next part, and an "Overdue installments" tile. Paid or not is worked out from the membership's payments, oldest part first (`backend/src/services/installments.ts`), so there is no paid flag to drift.
- [x] Automatic WhatsApp/SMS reminder before each due date (reuse `duesReminders` job)
  ✅ One reminder 2 days before each part is due; once a part is overdue, the weekly reminder chases the overdue amount only. A member keeping to their plan is not chased for the rest. Reuses the `dues_reminder` template, so no new Meta approval is needed.
- [x] Optional block on check-in when an installment is overdue
  ✅ Gym settings › "Block check-in when an installment is overdue" (off by default). With it off, the check-in panel still shows the overdue part or the next one.

### 4. Staff Salary & Staff Attendance
- [x] Staff profile: monthly salary, joining date, role (receptionist, cleaner, etc.)
  ✅ Staff Salaries page (Payments menu) + `/api/salaries`; a profile needs no login but can be linked to one
- [ ] Staff check-in/out (QR or fingerprint, reusing existing attendance hardware)
  🟠 One-tap check-in/out at the desk (Staff Attendance page, `canCheckIn`) and a monthly register on Staff Salaries (present / half day / leave). QR and fingerprint for staff not yet.
- [x] Monthly salary sheet: present days, advances, deductions, net pay
  ✅ Present, leave and absent days on each line; with "Cut salary for absent days" on, absences cost salary ÷ days in month. Weekly day off is a setting.
- [x] Mark salary paid → recorded as an expense automatically
  ✅ Payday and each advance are booked as "salaries" expenses; the Expenses page will not edit or delete them, undo is on the Salaries page
- [x] Salary slip (printable / PDF)
  ✅ Print / Save PDF from the sheet

---

## 🟡 Priority 2: smoother operations

### 5. Health Declaration / Waiver
- [x] Health questionnaire at join (BP, diabetes, heart, injuries, pregnancy)
  ✅ Opens after registering a member; also from the heart button on every member card (`/api/members/:id/health`)
- [x] Terms & liability waiver with on-screen signature
  ✅ Drawn signature (finger, stylus or mouse); wording editable in Gym settings, each signing keeps the wording it was signed under; printable
- [x] Health flag badge on the member profile and the trainer view
  ✅ Red badge with the conditions on the member card and next to the member in PT bookings; the heart button is amber until signed
- [x] Stored per member; re-sign on renewal (optional)
  ✅ Every signing kept as history; "Ask members to sign again when they renew" in Gym settings prompts after a renewal

### 6. Equipment & Maintenance
- [x] Equipment list: name, brand, purchase date, cost, warranty end
  ✅ Equipment page (sidebar) + `/api/equipment`; also model, serial no., location; retire instead of delete once it has history
- [x] Service schedule with "service due" alerts
  ✅ "Service every N days" from the last service; overdue / due-this-week on the page and in the dashboard's "Equipment needs attention" card
- [x] Fault report (staff or member) → status Open / Fixed
  ✅ Any staff from the Equipment page; members from the portal's Check-in tab
- [x] Repair cost linked to Expenses
  ✅ A service or repair with a cost is booked as a linked "maintenance" expense; the Expenses page will not edit or delete it

### 7. Member Feedback / Complaints
- [x] Feedback form in the member portal (rating + text, optional anonymous)
  ✅ Portal → Feedback tab: 1–5 stars, topic, comment; anonymous stores no member at all; the member sees the gym's replies
- [x] Complaint inbox for owner/staff with Open / Resolved status
  ✅ Feedback page (Members menu, `canManageMembers`) + `/api/feedback`; reply, resolve, reopen
- [x] Monthly satisfaction score on the dashboard
  ✅ "Member satisfaction" card: this month's average vs last month, % happy, replies waiting; the inbox also scores each topic

### 8. Multi-Branch
- [x] `Branch` under one gym owner; members, staff and payments scoped by branch
  ✅ `/api/branches`; every gym has a Main Branch (existing data filed there). Members, payments (through the member), check-ins, the dashboard, day passes and new expenses follow the branch in use; staff can be placed at one branch and then see only it.
  🟠 Phase 1: other pages (supplements, classes, lockers, salaries, equipment, leads, reports) are still gym-wide.
- [x] Branch switcher in the sidebar
  ✅ "All branches" or one; branches are added on Staff & Logins
- [x] Combined owner dashboard across branches
  ✅ "Branches this month" on the dashboard with All branches selected: members, today's check-ins, collected, spent
- [x] Option for a member to use all branches or one
  ✅ "Can use all branches" on the member form; otherwise check-in at another branch is refused

---

## 🟢 Priority 3: retention & engagement

### 9. Challenges / Leaderboard
- [x] Create a challenge (e.g. 30-day attendance streak, weight-loss %)
  ✅ Challenges page (Members menu, `canManageMembers`) + `/api/challenges`: most visits, attendance streak (days in a row) or weight loss %, between two dates, with an optional target and prize
- [x] Members join from the portal; progress updates from attendance/measurements
  ✅ Portal → Challenges tab: join / leave until it ends; the desk can also sign members up. Scores are worked out on read from check-ins and weigh-ins, nothing to resync (`services/challenges.ts`)
- [x] Leaderboard in the portal; winners announced on WhatsApp
  ✅ Portal shows the top 10 (others as "Ali K.") plus the member's own place. "Announce winners" after the end messages the top three once (`challenge_winner` template, SMS fallback) and fixes the board. The template needs approving in Meta's console (`whatsapp-templates.md`).

### 10. Bulk WhatsApp / Offers
- [x] Broadcast composer with audience filters (active, expired, inactive 30+ days, leads)
  ✅ WhatsApp Broadcast page (Members menu, `canManageMembers`, plan needs WhatsApp) + `/api/broadcasts`. Shows how many will get it before sending, leaving out opted-out members and numbers that can't take WhatsApp, and messaging a shared number once. Follows the branch in use; leads are gym-wide.
- [x] Templates (Eid offer, new batch, gym closed notice)
  ✅ Four Meta templates (offer, new batch, gym closed, announcement) with presets incl. Eid offer, and a live preview. Each needs approving in Meta's console as Marketing (`whatsapp-templates.md`).
- [ ] Send log with delivered/failed counts
  🟠 Log shows sent / failed / skipped per broadcast and per person, filling in live as it sends in the background (resumes after a restart). "Delivered" and "read" need Meta's webhook, which the app doesn't receive yet.

---

## 🔧 Technical housekeeping
- [x] Backend test suite is very slow (~2 hours for the full run on this machine)
  Now ~13 minutes. `resetDb` deletes rows instead of truncating every table (~1s → ~3ms per test), test files run in parallel with a database per worker, and the test databases are kept between runs and rebuilt only when a migration changes. `TEST_WORKERS=1` runs the files one at a time.
- [x] Failing test: `tests/routes/retentionFeatures.integration.test.ts` "lists what a part-paid renewal still owes" expected 3000 outstanding and got 5500
  The app was right: the test renewed an unpaid Rs. 2,500 membership, and renewing carries that balance over. The test now settles the old term first.
- [x] Fix lint warnings
  Mount-only effects marked like the rest of the code; `ThemedToaster`, the exercise photo data and `monthName` moved into their own modules.
  🟠 Left as is: the `useAuth` / `useTheme` style hooks exported next to their providers in `src/context/`. Only fast refresh is affected (a full reload instead of a hot swap when editing those files).

---

## 📊 Summary
| Section | Done | Partly there | Not started |
|---|---|---|---|
| P1: Leads CRM | 7 | 0 | 0 |
| P1: Day Pass | 3 | 1 | 0 |
| P1: Installments | 4 | 0 | 0 |
| P1: Staff Salary | 4 | 1 | 0 |
| P2: Health Waiver | 4 | 0 | 0 |
| P2: Equipment | 4 | 0 | 0 |
| P2: Feedback | 3 | 0 | 0 |
| P2: Multi-Branch | 4 | 0 | 0 |
| P3: Challenges | 3 | 0 | 0 |
| P3: Bulk WhatsApp | 2 | 1 | 0 |
| Technical | 3 | 0 | 0 |
| **Total** | **41** | **4** | **0** |

## ✅ Already built (for reference)
Members, memberships, freeze · Payments, dues, receipts, promo codes, online payments · Expenses, supplement sales ·
QR & fingerprint attendance · Trainers, PT sessions, payouts · Classes & bookings · Workout/diet plans, measurements ·
WhatsApp/SMS/email reminders & greetings · Member portal · Lockers · Referrals · Analytics · Audit log · Roles & 2FA ·
PWA/offline · Electron desktop · Multi-gym SaaS subscription billing
