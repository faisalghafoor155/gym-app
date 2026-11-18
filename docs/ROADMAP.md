# GymPro — Feature Roadmap

Features a complete gym management app still needs, ranked by impact.
Tick a box when a task ships.

**Status legend:** `[x]` done · `[ ]` not started · 🟠 partly there (note says what exists)

_Last checked against the code: 2026-11-18 (after Member Feedback)._

---

## 🔴 Priority 1: brings in money directly

### 1. Leads / Enquiry CRM
People who walk in to ask about the gym, followed up until they join.
- [x] `Lead` model: name, phone, source (walk-in / Facebook / referral), interest, notes
  ✅ `Lead` table + `/api/leads` (`backend/src/controllers/leadsController.ts`)
- [x] Status pipeline: New → Contacted → Trial → Joined / Lost
  ✅ "Joined" is set only by converting, so it always links to a real member; a lost lead records why
- [ ] Follow-up date with a "Today's follow-ups" list on the dashboard
  🟠 Follow-up date and a "Due today" list (overdue included) are on the Leads page. Not on the dashboard yet.
- [ ] Free trial pass (1–3 days) that lets a lead check in
  🟠 A lead can be marked "On trial", but there is no pass that lets them check in yet.
- [x] "Convert to member" button that pre-fills the member form
  ✅ "Make member" opens the normal registration form with name + phone; the lead is linked when it saves
- [ ] WhatsApp follow-up reminder to staff
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
- [ ] Installment plan when selling a membership (e.g. 3 parts, with due dates)
  🟠 Partial payments already work: the Dues page (`frontend/src/pages/Dues.tsx`) takes a payment against the membership balance. What's missing is a schedule with a due date for each part.
- [ ] Each installment shows in Dues until paid
  🟠 The Dues page lists the total unpaid balance, not separate installments.
- [ ] Automatic WhatsApp/SMS reminder before each due date (reuse `duesReminders` job)
  🟠 `backend/src/jobs/duesReminders.ts` already sends a weekly WhatsApp reminder for any balance, but not tied to a due date.
- [ ] Optional block on check-in when an installment is overdue

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
- [ ] `Branch` under one gym owner; members, staff and payments scoped by branch
- [ ] Branch switcher in the sidebar
- [ ] Combined owner dashboard across branches
- [ ] Option for a member to use all branches or one

---

## 🟢 Priority 3: retention & engagement

### 9. Challenges / Leaderboard
- [ ] Create a challenge (e.g. 30-day attendance streak, weight-loss %)
- [ ] Members join from the portal; progress updates from attendance/measurements
- [ ] Leaderboard in the portal; winners announced on WhatsApp
  🟠 A leaderboard exists for referrals only (`referralsController.ts`).

### 10. Bulk WhatsApp / Offers
- [ ] Broadcast composer with audience filters (active, expired, inactive 30+ days, leads)
  🟠 WhatsApp sending and the inactive-members list exist; there is no bulk-send screen.
- [ ] Templates (Eid offer, new batch, gym closed notice)
- [ ] Send log with delivered/failed counts

---

## 🔧 Technical housekeeping
- [ ] Backend test suite is very slow (~2 hours for the full run on this machine)
  ℹ️ Not hung: the earlier "no output" came from piping it through `tail`. With live output it ran ~13 of ~70 files in 25 minutes. Worth profiling (per-test `resetDb` truncating every table is the likely cost).
- [ ] Fix lint warnings:
  - `frontend/src/components/subscription/AdminBillingPanel.tsx:67`: missing `fetchAdminData` dependency
  - `frontend/src/pages/MyPortal.tsx:99`: missing `loadData` dependency
  - `frontend/src/components/fitness/ExerciseAnglesModal.tsx:31`: move constants out of the component file
  - `frontend/src/main.tsx:36`: fast-refresh export warning

---

## 📊 Summary
| Section | Done | Partly there | Not started |
|---|---|---|---|
| P1: Leads CRM | 4 | 2 | 1 |
| P1: Day Pass | 3 | 1 | 0 |
| P1: Installments | 0 | 3 | 1 |
| P1: Staff Salary | 4 | 1 | 0 |
| P2: Health Waiver | 4 | 0 | 0 |
| P2: Equipment | 4 | 0 | 0 |
| P2: Feedback | 3 | 0 | 0 |
| P2: Multi-Branch | 0 | 0 | 4 |
| P3: Challenges | 0 | 1 | 2 |
| P3: Bulk WhatsApp | 0 | 1 | 2 |
| Technical | 0 | 0 | 2 |
| **Total** | **22** | **10** | **11** |

## ✅ Already built (for reference)
Members, memberships, freeze · Payments, dues, receipts, promo codes, online payments · Expenses, supplement sales ·
QR & fingerprint attendance · Trainers, PT sessions, payouts · Classes & bookings · Workout/diet plans, measurements ·
WhatsApp/SMS/email reminders & greetings · Member portal · Lockers · Referrals · Analytics · Audit log · Roles & 2FA ·
PWA/offline · Electron desktop · Multi-gym SaaS subscription billing
