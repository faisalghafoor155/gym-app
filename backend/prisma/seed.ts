/**
 * Demo data for an existing gym.
 *
 * Additive by design: it never deletes, and it never touches the accounts that
 * can sign in. Run it against a gym that already exists (the one you registered
 * through the app) and it fills out the picture around it — enough members in
 * enough states that every filter tab, badge and dashboard panel has something
 * real to show, and enough of everything else (leads, day passes, lockers,
 * promo codes, referrals, measurements, freezes, staff salaries) that no page
 * in the sidebar opens onto an empty table.
 *
 * Member numbers continue from the gym's own counter, so seeded members sit in
 * sequence after the ones already there rather than colliding with them.
 *
 *   npm run db:seed                             # first gym in the database
 *   npm run db:seed -- --gym APEX               # by name, when there is more than one
 *   npm run db:seed -- --email demo@gymflow.pk  # the gym that account owns —
 *                                               # created, with that owner, if
 *                                               # nobody has the address yet
 *   npm run db:seed -- --email x@y.pk --only equipment  # machines and
 *                                               # upkeep only, no new members
 *
 * Every account the seed creates signs in with `password123`.
 *
 * Safe to run more than once: every run adds a fresh batch of members and the
 * activity around them. The things a gym has one of — its lockers, promo codes,
 * staff profiles and their paid months — are only added where missing.
 *
 * Needs `BIOMETRIC_KEY` in the environment, the same as the server: fingerprint
 * enrolments are encrypted on the way in, and seeding rows the app cannot read
 * back would be worse than seeding none.
 */
import 'dotenv/config';
import { PrismaClient, type MembershipStatus, type PromoCode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { encryptTemplate } from '../src/services/fingerprint/crypto.js';
import { summarise } from '../src/services/staffAttendance.js';
import { waiverFor } from '../src/services/waiver.js';
import { crc32, deflateSync } from 'node:zlib';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
});

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

/** Deterministic pseudo-randomness: the same seed run twice produces the same
 *  shape of data, which makes "did my change break this?" answerable. */
let rngState = 20260810;
const rand = (): number => {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const between = (lo: number, hi: number): number => Math.floor(rand() * (hi - lo + 1)) + lo;
/** One decimal place, the precision a tape and a scale actually read to. */
const tenth = (n: number): number => Math.round(n * 10) / 10;

/**
 * How a seeded payment was taken, cash or wallet.
 *
 * Kept together so the pair is always consistent: a cash row with a channel is
 * a contradiction the API refuses, and seeded data that contains one would
 * have the books disagreeing with the rules that produced them.
 */
const takenBy = (cashChance: number): { method: string; channel: string | null } =>
  rand() > cashChance
    ? { method: 'cash', channel: null }
    : { method: 'online', channel: pick(['easypaisa', 'jazzcash', 'bank'] as const) };

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (from: Date, n: number): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d;
};
/** A moment during the gym's opening hours on a given day. */
const atHour = (day: Date, lo = 7, hi = 21): Date => {
  const d = new Date(day);
  d.setHours(between(lo, hi), between(0, 59), 0, 0);
  return d;
};
/**
 * Never later than now. Something stamped "today at 8pm" while it is still the
 * afternoon would be a payment from the future — pulled back to a few minutes
 * ago instead, so today's tiles still count it.
 */
const notAfterNow = (d: Date): Date => {
  const now = Date.now();
  return d.getTime() > now ? new Date(now - between(5, 90) * 60_000) : d;
};
const clamp = (d: Date, lo: Date, hi: Date): Date => (d < lo ? lo : d > hi ? hi : d);
const wholeDaysSince =(d: Date): number =>
  Math.floor((daysAgo(0).getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);

/**
 * A calendar day as a `@db.Date` column holds it: UTC midnight of the gym's
 * day, `offset` days from today. Pakistan keeps no daylight saving, so the
 * five-hour offset the server uses is the whole of the time-zone logic.
 */
const gymDate = (offset = 0): Date => {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
/** The first of a month, `monthsBack` before the gym's current one, at UTC
 *  midnight — the form the salary tables key their months by. */
const monthStartUtc = (monthsBack: number): Date => {
  const today = gymDate(0);
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1));
};
const daysInMonth = (month: Date): number =>
  new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
const monthLabel = (month: Date): string =>
  month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const FIRST = [
  'Ahmed', 'Bilal', 'Hamza', 'Usman', 'Zain', 'Omar', 'Saad', 'Taimoor',
  'Ayesha', 'Fatima', 'Hira', 'Sana', 'Maryam', 'Zoya', 'Iqra', 'Noor',
  'Danish', 'Faizan', 'Rehan', 'Shahzad', 'Kashif', 'Adeel', 'Junaid', 'Waleed',
  'Amna',
] as const;
const LAST = [
  'Khan', 'Ali', 'Malik', 'Sheikh', 'Butt', 'Chaudhry', 'Qureshi', 'Siddiqui',
  'Hussain', 'Raza', 'Iqbal', 'Farooq',
] as const;
const phoneNo = (): string => `03${between(0, 4)}${between(10, 99)}${between(1000000, 9999999)}`;

/**
 * The states worth having on screen. Counts are weighted the way a real gym
 * looks: mostly active, a handful chasing renewal, a few gone quiet.
 */
const COHORTS = [
  // Comfortably active — expiry well in the future. The first few of these are
  // long-standing members on their latest renewal, which is what gives the
  // progress charts and the anniversary card something to show.
  { kind: 'active', count: 42, startedDaysAgo: () => between(3, 20) },
  // Inside the 7-day warning window the app derives on read. On the 30-day
  // plan, starting 24-29 days ago puts the expiry 1-6 days out.
  { kind: 'expiring', count: 18, startedDaysAgo: () => between(24, 29) },
  // Expired recently: the renewal call list.
  { kind: 'expired', count: 16, startedDaysAgo: () => between(33, 50) },
  // Expired long enough that the app treats them as off the roster (60+ days),
  // but still inside the fingerprint retention window — their enrolment stays.
  { kind: 'lapsed', count: 11, startedDaysAgo: () => between(95, 140) },
  // Gone long enough that fingerprint retention deletes their template: more
  // than LAPSED_AFTER_DAYS + the grace window past expiry. On the 30-day plan
  // that means starting at least 180 days ago. Kept as its own cohort so the
  // retention job has something to actually find on a freshly seeded database
  // — without these, the job runs and correctly reports nothing to do, which
  // is indistinguishable from a job that is broken.
  { kind: 'departed', count: 9, startedDaysAgo: () => between(200, 320) },
  // Registered but never sold anything — the "No membership" tab.
  { kind: 'none', count: 7, startedDaysAgo: () => 0 },
  // Bought, then called it off. Should never read as active anywhere.
  { kind: 'cancelled', count: 6, startedDaysAgo: () => between(10, 40) },
  // Joined in the last couple of days: today's takings, today's check-ins and
  // the "new this week" count would all read zero without them.
  { kind: 'fresh', count: 6, startedDaysAgo: () => between(0, 2) },
  // Paid part of the price at the counter and owe the rest. Nothing records
  // the shortfall as a row — the app derives it from the price against what
  // was paid — so these are what fill the Pending Dues page.
  { kind: 'partial', count: 8, startedDaysAgo: () => between(2, 22) },
  // A running membership, but not seen for a fortnight or more: the Inactive
  // Members list the desk rings round.
  { kind: 'idle', count: 6, startedDaysAgo: () => between(25, 45) },
] as const; // 129 members in total
type CohortKind = (typeof COHORTS)[number]['kind'];

const SUPPLEMENTS = [
  { name: 'Whey Protein 2lb', category: 'protein', price: 8500, costPrice: 6200, stock: 14, dosage: '1 scoop', timing: 'Post-workout' },
  { name: 'Mass Gainer 3kg', category: 'protein', price: 11000, costPrice: 8300, stock: 6, dosage: '2 scoops', timing: 'Post-workout' },
  { name: 'Creatine Monohydrate', category: 'creatine', price: 4200, costPrice: 2900, stock: 20, dosage: '5g', timing: 'Daily' },
  { name: 'Pre-Workout C4', category: 'preworkout', price: 6800, costPrice: 5000, stock: 3, dosage: '1 scoop', timing: '30 min before' },
  { name: 'BCAA 400g', category: 'bcaa', price: 5200, costPrice: 3700, stock: 0, dosage: '1 scoop', timing: 'Intra-workout' },
  { name: 'Multivitamin', category: 'vitamins', price: 2800, costPrice: 1700, stock: 25, dosage: '1 tablet', timing: 'With breakfast' },
  { name: 'Fish Oil Omega-3', category: 'vitamins', price: 3100, costPrice: 2000, stock: 11, dosage: '2 softgels', timing: 'With meals' },
  { name: 'L-Carnitine', category: 'fatburner', price: 4900, costPrice: 3400, stock: 7, dosage: '1 serving', timing: 'Pre-cardio' },
] as const;
/** Left empty and nearly empty on purpose, so the low-stock panel has
 *  something to warn about after the restock below has run. */
const SHOWCASE_LOW_STOCK = new Set(['BCAA 400g', 'Pre-Workout C4']);

const WORKOUT_PLANS = [
  { name: 'Beginner Full Body', description: '3 days a week, compound lifts, light progressive overload.' },
  { name: 'Push Pull Legs', description: '6-day split for intermediate lifters.' },
  { name: 'Fat Loss Circuit', description: 'High-intensity circuits with short rest, 4 days a week.' },
  { name: 'Strength 5x5', description: 'Squat, bench, deadlift, row and press on a 5x5 scheme.' },
] as const;

const DIET_PLANS = [
  { name: 'Cutting - 1800 kcal', description: 'High protein, moderate carbs, 40/30/30 split.' },
  { name: 'Bulking - 3200 kcal', description: 'Calorie surplus with 6 meals a day.' },
  { name: 'Maintenance - 2400 kcal', description: 'Balanced macros for holding bodyweight.' },
] as const;

/**
 * Trainers, priced deliberately unlike each other so the fee resolution has
 * something to show: one charges above the gym rate, one below, one is free,
 * and one leaves `ptFee` null so the gym default applies.
 */
const TRAINERS = [
  { name: 'Coach Bilal Ahmed', phone: '03001234501', specialization: 'Strength & Conditioning', commissionPercentage: 15, ptFee: 12000 },
  { name: 'Coach Sara Khan', phone: '03001234502', specialization: 'Weight Loss', commissionPercentage: 12, ptFee: 8000 },
  { name: 'Coach Usman Tariq', phone: '03001234503', specialization: 'Bodybuilding', commissionPercentage: 20, ptFee: null },
  { name: 'Coach Hina Malik', phone: '03001234504', specialization: 'Yoga & Mobility', commissionPercentage: 10, ptFee: 0 },
  { name: 'Coach Faizan Ali', phone: '03001234505', specialization: 'CrossFit', commissionPercentage: 18, ptFee: null },
] as const;

// Length lives on the schedule's start/end times, not on the class, so it is
// not a field here.
const CLASSES = [
  { name: 'Morning HIIT', description: 'Thirty minutes of high-intensity intervals.' },
  { name: 'Evening Yoga', description: 'Mobility and breathing, all levels welcome.' },
  { name: 'Spin Class', description: 'Indoor cycling to music.' },
  { name: 'Boxing Basics', description: 'Footwork, bag work and pad drills.' },
] as const;

/**
 * A month of running costs. Dated across the last three months so the profit
 * report has more than one period to compare, and spread over categories so
 * the breakdown is not one bar.
 *
 * No salaries line: wages are booked by the Staff Salaries section further
 * down, the way the Salaries page books them — one expense per advance and per
 * payday, named after the person. A lump "staff salaries" row here as well
 * would count the same wages twice.
 */
const EXPENSES = [
  { category: 'rent', amount: 85000, vendor: 'Property Owner', notes: 'Monthly hall rent', monthly: true },
  { category: 'utilities', amount: 24000, vendor: 'K-Electric', notes: 'Electricity', monthly: true },
  { category: 'utilities', amount: 3500, vendor: 'SSGC', notes: 'Gas', monthly: true },
  { category: 'maintenance', amount: 8000, vendor: 'FitFix Services', notes: 'Treadmill belt replacement', monthly: false },
  { category: 'equipment', amount: 65000, vendor: 'Gym Tech Pk', notes: 'Two adjustable benches', monthly: false },
  { category: 'marketing', amount: 15000, vendor: 'Meta Ads', notes: 'Ramzan promotion', monthly: false },
  { category: 'supplies', amount: 4200, vendor: 'Metro Cash & Carry', notes: 'Cleaning supplies and towels', monthly: false },
] as const;

/**
 * Promo codes in every state the page distinguishes: running, unlimited,
 * fixed-sum, run out of date, and switched off. Validity is in days from
 * today; null is open-ended.
 */
const PROMOS = [
  { code: 'EID25', description: 'Eid offer — 25% off any plan', kind: 'percent', value: 25, from: -45, until: 20, maxUses: 40, isActive: true },
  { code: 'STUDENT10', description: 'Students with a valid card', kind: 'percent', value: 10, from: null, until: null, maxUses: null, isActive: true },
  { code: 'FAMILY1000', description: 'Second family member joining', kind: 'fixed', value: 1000, from: null, until: null, maxUses: null, isActive: true },
  { code: 'NEWYEAR15', description: 'New Year offer', kind: 'percent', value: 15, from: -330, until: -300, maxUses: 100, isActive: true },
  { code: 'CORPORATE20', description: 'Corporate tie-up (paused)', kind: 'percent', value: 20, from: null, until: null, maxUses: 25, isActive: false },
] as const;

const LEAD_SOURCES = ['walk-in', 'walk-in', 'facebook', 'instagram', 'instagram', 'referral', 'call', 'other'] as const;
const LEAD_INTERESTS = [
  'Weight loss', 'Muscle gain', 'Personal training', 'Ladies timing', 'Cardio only',
  'CrossFit', 'Student package', 'Couple package', 'Yoga classes',
] as const;
const LOST_REASONS = [
  'Too expensive', 'Joined another gym closer to home', 'Timings do not suit',
  'Moved to another city', 'No response after three calls',
] as const;

/**
 * The people the gym pays, linked to a login where they have one. Salaries
 * are whole rupees, as they are agreed; `joinedMonthsAgo` 1 with a day puts a
 * pro-rated first month on the sheet.
 */
const STAFF = [
  { name: 'Sana Iqbal', role: 'receptionist', monthlySalary: 45000, phone: '03211234561', joinedMonthsAgo: 14, joinedDay: 1, login: 'reception', isActive: true },
  { name: 'Kamran Shah', role: 'manager', monthlySalary: 85000, phone: '03211234562', joinedMonthsAgo: 26, joinedDay: 1, login: 'accounts', isActive: true },
  { name: 'Imran Masih', role: 'cleaner', monthlySalary: 32000, phone: '03211234563', joinedMonthsAgo: 9, joinedDay: 1, login: null, isActive: true },
  { name: 'Tariq Mehmood', role: 'security', monthlySalary: 38000, phone: '03211234564', joinedMonthsAgo: 18, joinedDay: 1, login: null, isActive: true },
  { name: 'Asif Raza', role: 'trainer', monthlySalary: 60000, phone: '03211234565', joinedMonthsAgo: 1, joinedDay: 12, login: null, isActive: true },
  // Left two months ago: still on the sheet for the months they were paid.
  { name: 'Nadeem Akhtar', role: 'cleaner', monthlySalary: 30000, phone: '03211234566', joinedMonthsAgo: 11, joinedDay: 1, login: null, isActive: false },
] as const;

/** One row of the members created this run, kept for the sections after the
 *  member loop that hang things off them. */
/**
 * A drawn-looking signature as a PNG data URL: a looping pen line across a
 * white strip, different for every member. Encoded by hand (zlib does the
 * compression) so the seed needs no image library.
 */
const signaturePng = (): string => {
  const w = 240;
  const h = 70;
  const px = Buffer.alloc(w * h, 255);
  const ink = (x: number, y: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const xi = Math.round(x) + dx;
      const yi = Math.round(y) + dy;
      if (xi >= 0 && xi < w && yi >= 0 && yi < h) px[yi * w + xi] = 20;
    }
  };
  const a = 8 + rand() * 10;
  const f1 = 0.05 + rand() * 0.06;
  const f2 = 0.15 + rand() * 0.15;
  for (let t = 0; t <= 1; t += 0.0015) {
    const x = 15 + t * (w - 40) + Math.sin(t * 40 * f2) * 6;
    const y = h / 2 + Math.sin(t * 200 * f1) * a + Math.cos(t * 90 * f2) * 6;
    ink(x, y);
  }
  // Each row starts with filter byte 0 (none).
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

type Seeded = {
  id: string;
  name: string;
  memberNo: string;
  gender: string;
  kind: CohortKind;
  createdAt: Date;
  hasTrainer: boolean;
  membership: { id: string; startDate: Date; expiryDate: Date; durationDays: number; includesLocker: boolean } | null;
};

/**
 * The gym's machines with a year of upkeep: services on schedule (and a few
 * that slipped), faults reported by staff and members, some fixed with a
 * repair bill. Every service or repair that cost money is booked as a
 * "maintenance" expense linked to it, as the Equipment page does.
 *
 * Only when the gym has no equipment yet, so running the seed again does not
 * buy the same treadmill twice. Returns what it added.
 */
async function seedEquipment(gymId: string, desk: () => string, books: () => string) {
  const made = { machines: 0, services: 0, faults: 0 };
  if (await prisma.equipment.count({ where: { gymId } })) return made;

  const today = gymDate(0);
  const dayOffset = (n: number) => new Date(today.getTime() + n * 86_400_000);
  const MACHINES: {
    name: string; category: string; brand: string | null; model: string | null; location: string;
    cost: number; every: number | null; lastAgo: number | null; boughtAgo: number; warrantyDays: number | null;
  }[] = [
    { name: 'Treadmill 1', category: 'cardio', brand: 'Life Fitness', model: 'T5', location: 'Cardio zone', cost: 480000, every: 90, lastAgo: 104, boughtAgo: 700, warrantyDays: 1095 },
    { name: 'Treadmill 2', category: 'cardio', brand: 'Life Fitness', model: 'T5', location: 'Cardio zone', cost: 480000, every: 90, lastAgo: 86, boughtAgo: 700, warrantyDays: 1095 },
    { name: 'Treadmill 3', category: 'cardio', brand: 'Technogym', model: 'Run 600', location: 'Cardio zone', cost: 620000, every: 90, lastAgo: 30, boughtAgo: 200, warrantyDays: 730 },
    { name: 'Elliptical', category: 'cardio', brand: 'Precor', model: 'EFX 635', location: 'Cardio zone', cost: 350000, every: 120, lastAgo: 40, boughtAgo: 500, warrantyDays: 365 },
    { name: 'Spin Bike 1', category: 'cardio', brand: 'Keiser', model: 'M3i', location: 'Spin room', cost: 210000, every: 60, lastAgo: 55, boughtAgo: 400, warrantyDays: 730 },
    { name: 'Spin Bike 2', category: 'cardio', brand: 'Keiser', model: 'M3i', location: 'Spin room', cost: 210000, every: 60, lastAgo: 20, boughtAgo: 400, warrantyDays: 730 },
    { name: 'Rowing Machine', category: 'cardio', brand: 'Concept2', model: 'RowErg', location: 'Cardio zone', cost: 180000, every: 180, lastAgo: 150, boughtAgo: 300, warrantyDays: 1825 },
    { name: 'Cable Crossover', category: 'strength', brand: 'Hammer Strength', model: null, location: 'Weights floor', cost: 750000, every: 120, lastAgo: 128, boughtAgo: 900, warrantyDays: 365 },
    { name: 'Leg Press', category: 'strength', brand: 'Hammer Strength', model: 'Linear', location: 'Weights floor', cost: 520000, every: 120, lastAgo: 60, boughtAgo: 900, warrantyDays: 365 },
    { name: 'Lat Pulldown', category: 'strength', brand: 'Matrix', model: 'G3', location: 'Weights floor', cost: 280000, every: 120, lastAgo: 115, boughtAgo: 600, warrantyDays: 365 },
    { name: 'Smith Machine', category: 'strength', brand: 'Matrix', model: 'Magnum', location: 'Weights floor', cost: 390000, every: 180, lastAgo: 90, boughtAgo: 600, warrantyDays: 365 },
    { name: 'Power Rack', category: 'free_weights', brand: 'Rogue', model: 'R-3', location: 'Weights floor', cost: 160000, every: 365, lastAgo: 100, boughtAgo: 800, warrantyDays: null },
    { name: 'Dumbbell Set 2.5-40 kg', category: 'free_weights', brand: 'Eleiko', model: null, location: 'Weights floor', cost: 300000, every: null, lastAgo: null, boughtAgo: 800, warrantyDays: null },
    { name: 'Battle Ropes & Kettlebells', category: 'functional', brand: null, model: null, location: 'Functional area', cost: 45000, every: null, lastAgo: null, boughtAgo: 250, warrantyDays: null },
    { name: 'Ladies Treadmill', category: 'cardio', brand: 'Johnson', model: 'T8', location: 'Ladies section', cost: 330000, every: 90, lastAgo: 70, boughtAgo: 450, warrantyDays: 730 },
  ];

  const byName: Record<string, { id: string }> = {};
  for (const m of MACHINES) {
    const purchasedOn = dayOffset(-m.boughtAgo);
    const machine = await prisma.equipment.create({
      data: {
        gymId,
        name: m.name,
        category: m.category,
        brand: m.brand,
        model: m.model,
        serialNo: m.brand ? `${m.brand.slice(0, 3).toUpperCase()}-${between(100000, 999999)}` : null,
        location: m.location,
        purchasedOn,
        cost: m.cost,
        warrantyUntil: m.warrantyDays ? new Date(purchasedOn.getTime() + m.warrantyDays * 86_400_000) : null,
        serviceEveryDays: m.every,
        createdAt: purchasedOn,
      },
    });
    byName[m.name] = machine;
    made.machines++;

    // Services back from the last one, a schedule's length apart, as far as
    // the purchase date. The last-serviced date is the newest of them.
    if (m.every && m.lastAgo !== null) {
      for (let ago = m.lastAgo; ago < m.boughtAgo; ago += m.every + between(-5, 10)) {
        const servicedOn = dayOffset(-ago);
        const cost = pick([0, 2500, 3500, 4000, 6000]);
        const vendor = pick(['FitFix Services', 'ProGym Technicians', 'Ali Fitness Repairs']);
        const expense = cost
          ? await prisma.expense.create({
            data: {
              gymId, category: 'maintenance', amount: cost, spentOn: servicedOn, vendor,
              notes: `Service — ${m.name}`, recordedById: books(), createdAt: servicedOn,
            },
          })
          : null;
        await prisma.equipmentService.create({
          data: {
            gymId, equipmentId: machine.id, servicedOn, cost: cost || null, vendor,
            notes: pick(['Belt and motor checked', 'Lubricated, cables tightened', 'General service', null]),
            expenseId: expense?.id ?? null, recordedById: books(), createdAt: servicedOn,
          },
        });
        made.services++;
      }
      await prisma.equipment.update({ where: { id: machine.id }, data: { lastServicedOn: dayOffset(-m.lastAgo) } });
    }
  }

  // Faults: a few still open, the rest fixed — two reported by a member.
  const member = await prisma.member.findFirst({ where: { gymId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const FAULTS: { machine: string; text: string; ago: number; fixed: boolean; cost?: number; note?: string; byMember: boolean }[] = [
    { machine: 'Treadmill 2', text: 'Belt slips when running above speed 10', ago: 2, fixed: false, byMember: true },
    { machine: 'Cable Crossover', text: 'Left cable frayed near the pulley, taped off', ago: 1, fixed: false, byMember: false },
    { machine: 'Spin Bike 1', text: 'Resistance knob loose', ago: 0, fixed: false, byMember: false },
    { machine: 'Elliptical', text: 'Console screen not turning on', ago: 40, fixed: true, cost: 8500, note: 'Replaced display board', byMember: false },
    { machine: 'Lat Pulldown', text: 'Seat pad torn', ago: 75, fixed: true, cost: 3000, note: 'New seat cushion', byMember: true },
    { machine: 'Treadmill 1', text: 'Squeaking at low speed', ago: 120, fixed: true, cost: 0, note: 'Lubricated the deck', byMember: false },
    { machine: 'Smith Machine', text: 'Safety catch sticking', ago: 200, fixed: true, cost: 4500, note: 'Catch replaced', byMember: false },
  ];
  for (const f of FAULTS) {
    const machine = byName[f.machine]!;
    const reportedAt = notAfterNow(atHour(daysAgo(f.ago), 9, 20));
    const fixedAt = f.fixed ? notAfterNow(atHour(daysAgo(Math.max(0, f.ago - between(1, 4))), 11, 18)) : null;
    const expense = f.fixed && f.cost
      ? await prisma.expense.create({
        data: {
          gymId, category: 'maintenance', amount: f.cost, spentOn: fixedAt!, vendor: f.machine,
          notes: `Repair — ${f.machine}: ${f.text}`.slice(0, 300), recordedById: books(), createdAt: fixedAt!,
        },
      })
      : null;
    await prisma.equipmentFault.create({
      data: {
        gymId,
        equipmentId: machine.id,
        description: f.text,
        status: f.fixed ? 'fixed' : 'open',
        ...(f.byMember && member ? { reportedByMemberId: member.id } : { reportedById: desk() }),
        reportedAt,
        fixedAt,
        fixNotes: f.fixed ? f.note : null,
        repairCost: f.fixed && f.cost ? f.cost : null,
        expenseId: expense?.id ?? null,
      },
    });
    made.faults++;
  }
  return made;
}

async function main(): Promise<void> {
  const email = arg('--email');
  let gym;

  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('password123', 10);

  if (email) {
    const emailLower = email.trim().toLowerCase();
    let user = await prisma.user.findFirst({ where: { email: emailLower } });
    if (!user) {
      console.log(`User "${emailLower}" not found. Auto-creating gym and owner account...`);
      gym = await prisma.gym.create({
        data: {
          name: "Powerhouse Gym",
          ownerName: "Faisal Ghafoor",
          phone: '0423-5871234',
          address: 'Plot 12, Main Boulevard, Gulberg III, Lahore',
          // A demo gym on Pro, so no page is hidden behind an upgrade prompt
          // and the roster is not capped below what this script seeds.
          plan: 'pro',
        }
      });
      user = await prisma.user.create({
        data: {
          gymId: gym.id,
          email: emailLower,
          name: "Faisal Ghafoor",
          passwordHash,
          role: "owner",
          isActive: true,
          emailVerifiedAt: new Date(),
        }
      });
      console.log(`Created owner account: ${emailLower} / password123`);
    }
    gym = await prisma.gym.findUnique({ where: { id: user.gymId } });
  } else {
    const gymName = arg('--gym');
    gym = gymName
      ? await prisma.gym.findFirst({ where: { name: gymName } })
      : await prisma.gym.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  if (!gym) {
    console.log("No gym found in database. Creating default 'Powerhouse Gym' and owner...");
    gym = await prisma.gym.create({
      data: {
        name: "Powerhouse Gym",
        ownerName: "Admin Owner",
        plan: 'pro',
      }
    });

    await prisma.user.create({
      data: {
        gymId: gym.id,
        email: "owner@gym.com",
        name: "Admin Owner",
        passwordHash,
        role: "owner",
        isActive: true,
      }
    });
    console.log("Created owner account: owner@gym.com / password123");
  }
  const gymId = gym.id;

  console.log(`Seeding into "${gym.name}" — nothing existing will be removed.`);

  // --- accounts that can sign in ------------------------------------------
  // The owner already exists. Two staff logins join them, so the Team page
  // lists more than one person, and "recorded by" on payments and expenses
  // names more than one hand. Addresses carry a slice of the gym's id because
  // an email is unique across every gym in the database, not just this one.
  const owner = await prisma.user.findFirst({
    where: { gymId, role: 'owner' },
    orderBy: { createdAt: 'asc' },
  });
  const tag = gymId.slice(0, 8);
  const STAFF_LOGINS = [
    { key: 'reception', name: 'Sana Iqbal', staffPermission: 'receptionist' },
    { key: 'accounts', name: 'Kamran Shah', staffPermission: 'accountant' },
  ] as const;
  const logins: Record<string, { id: string; name: string }> = {};
  for (const s of STAFF_LOGINS) {
    const address = `${s.key}.${tag}@demo.gymflow.pk`;
    const existing = await prisma.user.findUnique({ where: { email: address } });
    logins[s.key] = existing ?? await prisma.user.create({
      data: {
        gymId,
        email: address,
        name: s.name,
        passwordHash,
        role: 'staff',
        staffPermission: s.staffPermission,
        isActive: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: daysAgo(between(0, 3)),
      },
    });
  }
  // Whoever was at the counter. Mostly the receptionist; the owner covers.
  const deskUsers = [logins['reception']!, logins['reception']!, ...(owner ? [owner] : [])];
  const desk = (): string => pick(deskUsers).id;
  const books = (): string => (owner && rand() > 0.5 ? owner.id : logins['accounts']!.id);

  // `--only equipment`: just the machines and their upkeep, for a gym seeded
  // before the Equipment page existed — without another batch of members.
  if (arg('--only') === 'equipment') {
    const e = await seedEquipment(gymId, desk, books);
    console.log(`Done — ${e.machines} machines, ${e.services} services, ${e.faults} faults.`);
    return;
  }

  /**
   * An audit entry, as the app would have written it for what the seed just
   * did. Attributed to the owner — the person who would be reading the log.
   */
  let audits = 0;
  const auditRow = async (
    at: Date,
    entry: { action: string; entity: string; entityId: string; entityLabel: string; before?: object; after?: object; reason?: string },
  ): Promise<void> => {
    if (!owner) return;
    await prisma.auditLog.create({
      data: {
        gymId,
        actorId: owner.id,
        actorName: owner.name,
        actorRole: owner.role,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : undefined,
        after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : undefined,
        reason: entry.reason ?? null,
        createdAt: at,
      },
    });
    audits++;
  };

  // --- membership plans ------------------------------------------------
  // A brand-new gym starts with three zero-priced plans. Give the unpriced
  // ones a real price so seeded memberships record something meaningful,
  // and leave any the owner has already priced alone. The yearly plan comes
  // with a locker, so the lockers page has holders who owe no rent.
  const PRICES: Record<string, number> = { Monthly: 2500, '3 Months': 6500, Yearly: 22000 };
  for (const [name, price] of Object.entries(PRICES)) {
    const existing = await prisma.membershipPlan.findFirst({ where: { gymId, name } });
    if (!existing) {
      await prisma.membershipPlan.create({
        data: {
          gymId, name, price,
          durationDays: name === 'Monthly' ? 30 : name === '3 Months' ? 90 : 365,
          includesCardio: name !== 'Monthly',
          includesLocker: name === 'Yearly',
        },
      });
    } else if (existing.price.equals(0)) {
      await prisma.membershipPlan.update({ where: { id: existing.id }, data: { price } });
    }
  }

  const plans = await prisma.membershipPlan.findMany({
    where: { gymId, isActive: true },
    orderBy: { durationDays: 'asc' },
  });
  const monthly = plans.find(p => p.durationDays === 30) ?? plans[0]!;
  const quarterly = plans.find(p => p.durationDays === 90) ?? monthly;

  // --- workout and diet plans -----------------------------------------
  for (const p of WORKOUT_PLANS) {
    const exists = await prisma.workoutPlan.findFirst({ where: { gymId, name: p.name } });
    if (!exists) await prisma.workoutPlan.create({ data: { ...p, gymId } });
  }
  for (const p of DIET_PLANS) {
    const exists = await prisma.dietPlan.findFirst({ where: { gymId, name: p.name } });
    if (!exists) await prisma.dietPlan.create({ data: { ...p, gymId } });
  }
  const workoutPlans = await prisma.workoutPlan.findMany({ where: { gymId } });
  const dietPlans = await prisma.dietPlan.findMany({ where: { gymId } });

  // --- supplements ------------------------------------------------------
  // With a cost price, so the profit report has margins to work out rather
  // than reporting every sale as "cost unknown".
  for (const s of SUPPLEMENTS) {
    const exists = await prisma.supplement.findFirst({ where: { gymId, name: s.name } });
    if (!exists) await prisma.supplement.create({ data: { ...s, gymId } });
    else if (exists.costPrice === null) {
      await prisma.supplement.update({ where: { id: exists.id }, data: { costPrice: s.costPrice } });
    }
  }

  // Restocks. Nothing records a delivery except the audit trail, which is
  // where the app writes one, so that is where the shelf's history goes — and
  // the stock moves by exactly what the entry says it did.
  let restocks = 0;
  for (const s of await prisma.supplement.findMany({ where: { gymId } })) {
    if (SHOWCASE_LOW_STOCK.has(s.name) || s.stock >= 12) continue;
    const quantity = between(10, 24);
    const updated = await prisma.supplement.update({
      where: { id: s.id },
      data: { stock: { increment: quantity } },
    });
    await auditRow(atHour(daysAgo(between(20, 50)), 11, 17), {
      action: 'supplement.restock',
      entity: 'supplement',
      entityId: s.id,
      entityLabel: `${s.name} +${quantity}`,
      before: { stock: s.stock },
      after: { stock: updated.stock, added: quantity },
      reason: pick(['Monthly order from distributor', 'Delivery from Nutrition Hub', 'Restock after sale week']),
    });
    restocks++;
  }
  const supplements = await prisma.supplement.findMany({ where: { gymId } });

  // --- gym pricing ------------------------------------------------------
  // The trainer fee falls back to this whenever a trainer sets no rate of its
  // own, so a seeded gym should have a real one rather than the honest 0 a
  // fresh gym starts with.
  if (gym.defaultPtFee.equals(0)) {
    await prisma.gym.update({ where: { id: gymId }, data: { defaultPtFee: 10000 } });
  }
  // The accounts the front desk reads out when a member pays online. Seeded so
  // the channel picker has something to show rather than an empty hint. And
  // the day-pass fee, guest allowance and referral reward, each only where the
  // owner has not set one — a zero there is the gym's own "not configured".
  await prisma.gym.update({
    where: { id: gymId },
    data: {
      easypaisaAccount: gym.easypaisaAccount ?? '0300-1234567',
      jazzcashAccount: gym.jazzcashAccount ?? '0301-7654321',
      bankAccount:
        gym.bankAccount ?? 'Meezan Bank — Iron Works Gym — PK36MEZN0001234567890123',
      ...(gym.dayPassFee.equals(0) && { dayPassFee: 500 }),
      ...(gym.guestPassesPerMonth === 0 && { guestPassesPerMonth: 4 }),
      ...(gym.referralRewardDays === 0 && { referralRewardDays: 7 }),
      // Staff have Sunday off unless the owner chose another day (or none).
      ...(gym.staffWeeklyOff === null && { staffWeeklyOff: 0 }),
    },
  });
  const settings = await prisma.gym.findUniqueOrThrow({ where: { id: gymId } });
  const gymDefaultPtFee = settings.defaultPtFee.toNumber();

  // --- trainers ---------------------------------------------------------
  for (const t of TRAINERS) {
    const exists = await prisma.trainer.findFirst({ where: { gymId, name: t.name } });
    if (!exists) await prisma.trainer.create({ data: { ...t, gymId } });
  }
  const trainers = await prisma.trainer.findMany({ where: { gymId, isActive: true } });

  // --- classes and their weekly schedules -------------------------------
  for (const c of CLASSES) {
    const exists = await prisma.class.findFirst({ where: { gymId, name: c.name } });
    if (!exists) await prisma.class.create({ data: { ...c, gymId } });
  }
  const classes = await prisma.class.findMany({ where: { gymId } });

  for (const cls of classes) {
    const already = await prisma.classSchedule.count({ where: { classId: cls.id } });
    if (already > 0) continue;
    // Two slots a week each, on days that do not all collide, so the weekly
    // grid has something in most columns.
    for (const dayOffset of [0, 3]) {
      const day = (classes.indexOf(cls) + dayOffset) % 7;
      const morning = cls.name.includes('Morning') || cls.name.includes('Spin');
      const startHour = morning ? 7 : 18;
      await prisma.classSchedule.create({
        data: {
          gymId,
          classId: cls.id,
          trainerId: pick(trainers).id,
          dayOfWeek: day,
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(startHour + 1).padStart(2, '0')}:00`,
          capacity: between(10, 25),
        },
      });
    }
  }
  const schedules = await prisma.classSchedule.findMany({ where: { gymId } });

  // --- promo codes --------------------------------------------------------
  // Only the missing ones: a code is unique per gym, and a second run that
  // tried to add EID25 again would fail on it rather than skip it.
  for (const p of PROMOS) {
    const exists = await prisma.promoCode.findUnique({ where: { gymId_code: { gymId, code: p.code } } });
    if (exists) continue;
    await prisma.promoCode.create({
      data: {
        gymId,
        code: p.code,
        description: p.description,
        kind: p.kind,
        value: p.value,
        validFrom: p.from === null ? null : gymDate(p.from),
        validUntil: p.until === null ? null : gymDate(p.until),
        maxUses: p.maxUses,
        isActive: p.isActive,
        createdAt: daysAgo(p.from === null ? 120 : -p.from + 3),
      },
    });
  }
  const promos = await prisma.promoCode.findMany({ where: { gymId } });
  /** A code the desk could actually have used on `day`, by the same tests
   *  the server applies at the counter. */
  const usablePromo = (day: Date): PromoCode | null => {
    const ok = promos.filter(p =>
      p.isActive
      && (!p.validFrom || p.validFrom <= day)
      && (!p.validUntil || addDays(p.validUntil, 1) > day)
      && (p.maxUses === null || p.usedCount < p.maxUses));
    return ok.length ? pick(ok) : null;
  };
  /** Rupees off, worked out as `discountFor` does it. */
  const discountFor = (p: PromoCode, price: number): number => {
    const value = p.value.toNumber();
    const off = p.kind === 'percent' ? Math.round((price * value) / 100) : value;
    return Math.min(price, Math.max(0, off));
  };

  // --- expenses ---------------------------------------------------------
  // Three months of them, so the profit report has periods to compare rather
  // than a single bar.
  let expensesAdded = 0;
  if ((await prisma.expense.count({ where: { gymId } })) === 0) {
    for (let monthsBack = 0; monthsBack < 3; monthsBack++) {
      for (const e of EXPENSES) {
        // The one-off costs land in a single month; the running ones recur.
        if (!e.monthly && monthsBack !== between(0, 2)) continue;
        const spentOn = daysAgo(monthsBack * 30 + between(1, 25));
        await prisma.expense.create({
          data: {
            gymId,
            category: e.category,
            // Utilities wobble month to month; rent does not.
            amount: e.category === 'rent' ? e.amount : Math.round(e.amount * (0.9 + rand() * 0.2)),
            spentOn,
            vendor: e.vendor,
            notes: e.notes,
            recordedById: books(),
          },
        });
        expensesAdded++;
      }
    }
  }

  // --- members, memberships, payments, attendance -----------------------
  let created = 0;
  let paymentsMade = 0;
  let checkins = 0;
  let ptSessionsMade = 0;
  let bookingsMade = 0;
  let salesMade = 0;
  let withTrainer = 0;
  let enrolled = 0;
  let promoUses = 0;

  const seeded: Seeded[] = [];
  /** Referrals made this run, settled after the loop once every referrer's
   *  membership exists to put reward days on. */
  const referrals: { rewardId: string; referrerId: string; referredName: string; referredAt: Date }[] = [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const cohort of COHORTS) {
    for (let i = 0; i < cohort.count; i++) {
      // The gym's own counter drives the member number, exactly as the app
      // does it, so seeded members continue the sequence instead of clashing.
      const { memberSeq } = await prisma.gym.update({
        where: { id: gymId },
        data: { memberSeq: { increment: 1 } },
        select: { memberSeq: true },
      });
      const memberNo = `MEM-${String(memberSeq).padStart(5, '0')}`;
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      // Drawn once and used everywhere below, so the member, their membership,
      // their fingerprint and their first payment all agree on when they came.
      const startedAgo = cohort.startedDaysAgo();

      // The first ten of the active cohort have been coming for months: this
      // membership is a renewal, and the one before it is kept as history.
      const longStanding = cohort.kind === 'active' && i < 10;
      let createdAt = daysAgo(
        startedAgo + (longStanding ? between(120, 380) : cohort.kind === 'fresh' ? 0 : between(0, 5)),
      );
      // One of them joined exactly a year ago today, so the dashboard's
      // anniversary card has a name on it.
      if (longStanding && i === 0) {
        createdAt = daysAgo(0);
        createdAt.setFullYear(createdAt.getFullYear() - 1);
      }
      // And two of them have a birthday today. Dates of birth are calendar
      // dates, stored as UTC midnight, which is how the app reads them back.
      const today = gymDate(0);
      const dateOfBirth = longStanding && (i === 1 || i === 2)
        ? new Date(Date.UTC(today.getUTCFullYear() - (i === 1 ? 26 : 31), today.getUTCMonth(), today.getUTCDate()))
        : daysAgo(between(18, 45) * 365);

      // About a third train with somebody. Lapsed members are left without —
      // they stopped coming, so a live trainer assignment would be odd.
      const trainer =
        cohort.kind !== 'lapsed' && cohort.kind !== 'departed' && cohort.kind !== 'idle'
        && cohort.kind !== 'none' && (longStanding || rand() > 0.65)
          ? pick(trainers)
          : null;

      // A friend brought them in, now and then — which is what a referral is
      // in the app: a member registered naming who sent them.
      const referrerPool = seeded.filter(s => s.kind === 'active' && s.membership);
      const referrer =
        (cohort.kind === 'fresh' || cohort.kind === 'active' || cohort.kind === 'partial')
        && !longStanding && referrerPool.length > 3 && rand() > 0.72
          ? pick(referrerPool)
          : null;

      const gender = rand() > 0.35 ? 'male' : 'female';
      const member = await prisma.member.create({
        data: {
          gymId,
          memberNo,
          name,
          phone: phoneNo(),
          email: rand() > 0.4
            ? `${name.toLowerCase().replace(/\s+/g, '.')}.${memberSeq}@example.com`
            : null,
          gender,
          dateOfBirth,
          address: pick(['Model Town', 'Johar Town', 'DHA Phase 5', 'Gulberg III', 'Bahria Town']),
          emergencyContact: phoneNo(),
          // Only the app's own 60-day rule decides who reads as lapsed; the
          // stored status stays 'active' so nothing is hard-coded inactive.
          status: 'active',
          createdAt,
          trainerId: trainer?.id ?? null,
          referredById: referrer?.id ?? null,
        },
      });
      created++;

      // The reward is fixed now, at the gym's current rate, and granted later
      // by the desk — the same two steps the app takes.
      if (referrer) {
        const reward = await prisma.referralReward.create({
          data: {
            gymId,
            referrerId: referrer.id,
            referredId: member.id,
            rewardDays: settings.referralRewardDays,
            createdAt,
          },
        });
        referrals.push({ rewardId: reward.id, referrerId: referrer.id, referredName: name, referredAt: createdAt });
      }

      const row: Seeded = {
        id: member.id, name, memberNo, gender, kind: cohort.kind, createdAt,
        hasTrainer: !!trainer, membership: null,
      };
      seeded.push(row);

      // The one-off assignment fee, resolved the way the app resolves it:
      // the trainer's own rate, else the gym's. A rate of zero raises no
      // charge at all rather than a zero-rupee debt.
      if (trainer) {
        withTrainer++;
        const feeRate = trainer.ptFee === null ? gymDefaultPtFee : trainer.ptFee.toNumber();
        // A third of them haggled, so the "(agreed rate)" note has examples.
        const negotiated = rand() > 0.66 && feeRate > 0;
        const fee = negotiated ? Math.round((feeRate * (0.6 + rand() * 0.25)) / 500) * 500 : feeRate;
        if (fee > 0) {
          await prisma.payment.create({
            data: {
              gymId,
              memberId: member.id,
              type: 'other',
              amount: fee,
              method: 'cash',
              // Most are collected at the counter; a few are left owing so the
              // outstanding column is not empty.
              status: rand() > 0.25 ? 'paid' : 'due',
              paymentDate: notAfterNow(atHour(daysAgo(startedAgo), 9, 20)),
              notes:
                `Trainer Fee (PT) for instructor: ${trainer.name}` +
                (negotiated ? ' (agreed rate)' : ''),
              recordedById: desk(),
            },
          });
          paymentsMade++;
        }

        // Sessions actually delivered, with the trainer's commission worked
        // out the same way the app does — otherwise the commission report
        // would show sessions but no earnings. Never before the member joined.
        const sessions = between(2, 10);
        const stillComing = cohort.kind !== 'expired' && cohort.kind !== 'cancelled';
        for (let s = 0; s < sessions; s++) {
          const price = between(3, 8) * 500;
          const commission = Math.round((price * trainer.commissionPercentage.toNumber()) / 100);
          // One booked for the coming week, for members still training, so
          // the sessions list has something scheduled ahead of today.
          const upcoming = s === 0 && stillComing && rand() > 0.4;
          const when = upcoming
            ? addDays(daysAgo(0), between(1, 6))
            : daysAgo(between(0, Math.min(45, wholeDaysSince(createdAt))));
          when.setHours(between(7, 20), 0, 0, 0);
          const status = when > new Date() ? 'scheduled' : pick(['completed', 'completed', 'cancelled'] as const);
          // A cancelled session was never charged for.
          const paymentStatus = status !== 'cancelled' && rand() > 0.3 ? 'paid' : 'unpaid';
          // Trainers are paid out at the start of each month for the month
          // before, so last month's sessions are settled and this month's are
          // what the payouts page shows as owed.
          const payoutStatus = status === 'completed' && when < thisMonthStart ? 'paid' : 'unpaid';
          const session = await prisma.ptSession.create({
            data: {
              gymId,
              memberId: member.id,
              trainerId: trainer.id,
              sessionDate: when,
              priceCharged: price,
              trainerCommission: commission,
              status,
              paymentStatus,
              payoutStatus,
              // Booked a day or three ahead, but not before the member joined
              // and not later than now.
              createdAt: clamp(addDays(when, -between(0, 3)), createdAt, new Date()),
            },
          });
          // Paid means a payment row, linked to the session, exactly as the
          // sessions endpoint writes one — a session marked paid with no money
          // behind it would be revenue the books never saw.
          if (paymentStatus === 'paid') {
            await prisma.payment.create({
              data: {
                gymId,
                memberId: member.id,
                amount: price,
                type: 'other',
                method: 'cash',
                status: 'paid',
                paymentDate: notAfterNow(when),
                notes: `PT Session with Trainer: ${trainer.name}`,
                recordedById: desk(),
                ptSessionId: session.id,
              },
            });
            paymentsMade++;
          }
          ptSessionsMade++;
        }
      }

      if (cohort.kind === 'none') continue;

      // The date-sensitive cohorts are pinned to the 30-day plan: their whole
      // point is where the expiry falls relative to today, and a 365-day plan
      // picked at random would push it a year out and empty the tab. The idle
      // ones are on three months, so their membership is still running.
      const datePinned = cohort.kind === 'expiring' || cohort.kind === 'expired'
        || cohort.kind === 'lapsed' || cohort.kind === 'departed';
      const plan = datePinned ? monthly : cohort.kind === 'idle' ? quarterly : pick(plans);
      const start = daysAgo(startedAgo);
      const expiry = addDays(start, plan.durationDays);
      const status: MembershipStatus = cohort.kind === 'cancelled' ? 'cancelled' : 'active';

      // The membership before this one, for the long-standing members: what
      // they renewed from. Superseded, as the app marks a renewed membership,
      // and paid in full.
      if (longStanding) {
        const prevStart = new Date(createdAt);
        prevStart.setHours(0, 0, 0, 0);
        const prev = await prisma.membership.create({
          data: {
            gymId,
            memberId: member.id,
            planId: plan.id,
            startDate: prevStart,
            expiryDate: addDays(prevStart, plan.durationDays),
            pricePaid: plan.price,
            status: 'superseded',
            createdAt: prevStart,
          },
        });
        await prisma.payment.create({
          data: {
            gymId,
            memberId: member.id,
            membershipId: prev.id,
            type: 'membership',
            amount: plan.price,
            ...takenBy(0.3),
            status: 'paid',
            paymentDate: atHour(prevStart, 9, 20),
            notes: `${plan.name} membership`,
            recordedById: desk(),
          },
        });
        paymentsMade++;
      }

      // Now and then a promo code, applied the way the server applies it: it
      // sets the price, and the use is recorded against this membership.
      const listPrice = plan.price.toNumber();
      const promo = cohort.kind !== 'cancelled' && cohort.kind !== 'lapsed'
        && cohort.kind !== 'departed' && rand() > 0.82
        ? usablePromo(start)
        : null;
      const discount = promo ? discountFor(promo, listPrice) : 0;
      const sold = listPrice - discount;

      const membership = await prisma.membership.create({
        data: {
          gymId,
          memberId: member.id,
          planId: plan.id,
          startDate: start,
          expiryDate: expiry,
          pricePaid: sold,
          status,
          createdAt: start,
        },
      });
      row.membership = {
        id: membership.id, startDate: start, expiryDate: expiry,
        durationDays: plan.durationDays, includesLocker: plan.includesLocker,
      };

      if (promo) {
        await prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
        promo.usedCount++;
        await prisma.promoRedemption.create({
          data: { gymId, promoCodeId: promo.id, memberId: member.id, membershipId: membership.id, discount, createdAt: start },
        });
        promoUses++;
      }

      // What they paid when they joined, pointed at the membership it bought —
      // which is what lets the app tell a paid-up membership from an unpaid
      // one. Cancelled members still paid once. The partial cohort handed
      // over part of it; what is left is owed, and shows as a balance.
      const paidNow = cohort.kind === 'partial'
        ? Math.max(500, Math.min(sold - 500, Math.round((sold * (0.3 + rand() * 0.4)) / 500) * 500))
        : sold;
      await prisma.payment.create({
        data: {
          gymId,
          memberId: member.id,
          membershipId: membership.id,
          type: 'membership',
          amount: paidNow,
          ...takenBy(0.3),
          status: 'paid',
          paymentDate: notAfterNow(atHour(start, 9, 20)),
          notes: `${plan.name} membership${promo ? ` (${promo.code})` : ''}${paidNow < sold ? ' — part payment' : ''}`,
          recordedById: desk(),
        },
      });
      paymentsMade++;

      // A few of the expired ones owe for the renewal they have not made yet,
      // so the dues panel has something in it.
      if (cohort.kind === 'expired' && rand() > 0.5) {
        await prisma.payment.create({
          data: {
            gymId,
            memberId: member.id,
            // Deliberately unlinked: this is money owed for a renewal nobody
            // has sold yet, so there is no membership for it to point at.
            membershipId: null,
            type: 'membership',
            amount: plan.price,
            method: 'cash',
            status: 'due',
            paymentDate: expiry,
            notes: 'Renewal pending',
            recordedById: desk(),
          },
        });
        paymentsMade++;
      }

      // Attendance, thinning out for people on their way out — which is what
      // makes the dashboard's daily chart and peak-hour read like a real week.
      // Only on days the member actually had a membership: the expired came
      // while theirs ran and not since, the idle stopped a fortnight ago, and
      // the fresh have been in every day or two since joining.
      const visitAgo: number[] = [];
      if (cohort.kind === 'fresh') {
        for (let d = 0; d <= startedAgo; d++) if (d === 0 || rand() > 0.3) visitAgo.push(d);
      } else if (cohort.kind === 'idle') {
        for (let d = 0; d < between(4, 10); d++) visitAgo.push(between(14, startedAgo));
      } else if (cohort.kind === 'expired') {
        for (let d = 0; d < between(2, 8); d++) visitAgo.push(between(startedAgo - 30, startedAgo));
      } else if (cohort.kind !== 'lapsed' && cohort.kind !== 'departed') {
        const span = longStanding ? 55 : Math.min(55, startedAgo);
        for (let d = 0; d < between(10, 40); d++) visitAgo.push(between(0, span));
      }

      const checkedDays = new Set<number>();
      for (const ago of visitAgo) {
        if (checkedDays.has(ago)) continue;
        checkedDays.add(ago);
        const at = daysAgo(ago);
        // Gyms fill up morning and evening; the middle of the day is quiet.
        at.setHours(rand() > 0.45 ? between(17, 21) : between(6, 10), between(0, 59), 0, 0);
        if (at > new Date()) continue;
        await prisma.attendance.create({
          data: { gymId, memberId: member.id, checkedInAt: at },
        });
        checkins++;
      }

      // Fingerprint enrolment, for about half the roster.
      //
      // Encrypted through the same helper the enrolment endpoint uses, never
      // written raw: a seeded row the app cannot decrypt would look like a
      // corrupt enrolment and send somebody hunting a bug that is not there.
      // The bytes themselves are nonsense — no real reader produced them, and
      // nothing matches against them until one is plugged in.
      //
      // Enrolled on the day they joined, which is what the retention job
      // measures for a member who never bought anything.
      if (rand() > 0.5) {
        await prisma.fingerprintTemplate.create({
          data: {
            gymId,
            memberId: member.id,
            template: encryptTemplate(
              Buffer.from(`seed-template-${memberNo}`),
              member.id,
            ),
            format: 'seed-v1',
            finger: pick(['right thumb', 'left thumb', 'right index'] as const),
            enrolledAt: daysAgo(startedAgo),
            enrolledBy: 'Seed data',
          },
        });
        enrolled++;
      }

      // Roughly half get a training and diet plan assigned, from their
      // trainer where they have one.
      if (rand() > 0.5 && workoutPlans.length && dietPlans.length) {
        await prisma.memberPlan.create({
          data: {
            memberId: member.id,
            workoutPlanId: pick(workoutPlans).id,
            dietPlanId: rand() > 0.3 ? pick(dietPlans).id : null,
            trainerId: trainer?.id ?? null,
            assignedAt: clamp(addDays(start, between(0, 3)), start, now),
          },
        });
      }

      // Supplement sales.
      //
      // A SupplementSale row as well as the payment, not just the payment:
      // the sales report and the stock ledger read the sale, so a payment on
      // its own would leave the Supplement Sales page empty while the money
      // showed up in revenue — books that disagree with each other.
      if (rand() > 0.55 && supplements.length) {
        const item = pick(supplements);
        const qty = rand() > 0.8 ? 2 : 1;
        if (item.stock >= qty && item.price) {
          const unitPrice = item.price;
          const total = unitPrice.mul(qty);
          const soldOn = notAfterNow(atHour(daysAgo(between(0, Math.min(40, wholeDaysSince(createdAt)))), 9, 21));

          const payment = await prisma.payment.create({
            data: {
              gymId,
              memberId: member.id,
              type: 'supplement',
              amount: total,
              ...takenBy(0.4),
              status: 'paid',
              paymentDate: soldOn,
              notes: `Purchased ${item.name}${qty > 1 ? ` x${qty}` : ''}`,
              recordedById: desk(),
            },
          });
          await prisma.supplementSale.create({
            data: {
              gymId,
              supplementId: item.id,
              memberId: member.id,
              quantity: qty,
              // Snapshotted, so a later price change does not rewrite what
              // this member was charged — and the cost likewise, so a later
              // supplier price does not rewrite this sale's margin.
              unitPrice,
              total,
              unitCost: item.costPrice,
              paymentId: payment.id,
              soldAt: soldOn,
            },
          });
          await prisma.supplement.update({
            where: { id: item.id },
            data: { stock: { decrement: qty } },
          });
          // The in-memory copy has to move too, or a later member in this loop
          // reads a stock level the database no longer has and oversells it.
          item.stock -= qty;
          paymentsMade++;
          salesMade++;
        }
      }

      // Class bookings for members who are actually still coming — some in
      // the fortnight just gone, some for the week ahead.
      const coming = cohort.kind === 'active' || cohort.kind === 'expiring'
        || cohort.kind === 'fresh' || cohort.kind === 'partial';
      if (schedules.length && coming && rand() > 0.5) {
        const booked = new Set<string>();
        for (let b = 0; b < between(1, 3); b++) {
          const schedule = pick(schedules);
          // On the weekday the class actually runs: the most recent one, or
          // the next one ahead.
          const ahead = rand() > 0.6;
          const bookingDate = daysAgo(0);
          const shift = (schedule.dayOfWeek - bookingDate.getDay() + 7) % 7;
          bookingDate.setDate(bookingDate.getDate() + (ahead ? shift : shift - 7 - 7 * between(0, 1)));
          if (bookingDate < daysAgo(wholeDaysSince(createdAt))) continue;
          // One booking per member per schedule per day is a database
          // constraint, so a repeat pick has to be skipped rather than retried
          // into a crash.
          const key = `${schedule.id}:${bookingDate.toISOString()}`;
          if (booked.has(key)) continue;
          booked.add(key);
          await prisma.classBooking.create({
            data: {
              gymId,
              scheduleId: schedule.id,
              memberId: member.id,
              bookingDate,
              status: bookingDate < daysAgo(0)
                ? pick(['attended', 'attended', 'cancelled'])
                : 'booked',
            },
          });
          bookingsMade++;
        }
      }
    }
  }

  const running = seeded.filter(s =>
    s.membership && (s.kind === 'active' || s.kind === 'expiring' || s.kind === 'partial' || s.kind === 'fresh'));
  // The active cohort is seeded first, so its first ten are the long-standing.
  const longStanders = seeded.filter(s => s.kind === 'active' && s.membership).slice(0, 10);

  // --- a member who can sign in -------------------------------------------
  // So the member portal has somebody to show: one of the long-standing
  // members, with their own login.
  const memberAddress = `member.${tag}@demo.gymflow.pk`;
  const portalMember = longStanders[0];
  if (portalMember && !(await prisma.user.findUnique({ where: { email: memberAddress } }))) {
    await prisma.user.create({
      data: {
        gymId,
        email: memberAddress,
        name: portalMember.name,
        passwordHash,
        role: 'member',
        memberId: portalMember.id,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  // --- walk-in supplement sales -------------------------------------------
  // Over the counter to somebody who is not a member: a sale with no member
  // and therefore no payment row, which is how the app records one.
  let walkInSales = 0;
  for (let i = 0; i < 10; i++) {
    const item = pick(supplements);
    if (!item.price || item.stock < 1) continue;
    const soldAt = notAfterNow(atHour(daysAgo(i < 2 ? 0 : between(1, 30)), 10, 21));
    await prisma.supplementSale.create({
      data: {
        gymId,
        supplementId: item.id,
        memberId: null,
        quantity: 1,
        unitPrice: item.price,
        total: item.price,
        unitCost: item.costPrice,
        paymentId: null,
        soldAt,
        notes: 'Walk-in customer',
      },
    });
    await prisma.supplement.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
    item.stock -= 1;
    walkInSales++;
  }

  // --- referral rewards ------------------------------------------------------
  // Some granted, as the desk grants them: the free days go onto the
  // referrer's running membership and move its expiry. Some still waiting,
  // a few called off because the friend did not stay.
  let rewardsGranted = 0;
  for (const r of referrals) {
    const roll = rand();
    if (roll < 0.45) {
      const ms = await prisma.membership.findFirst({
        where: { memberId: r.referrerId, gymId, status: 'active', expiryDate: { gte: daysAgo(0) } },
        orderBy: { startDate: 'desc' },
      });
      const days = settings.referralRewardDays;
      const grantedAt = notAfterNow(atHour(addDays(r.referredAt, between(1, 4)), 10, 19));
      const referrer = seeded.find(s => s.id === r.referrerId)!;
      if (ms && days > 0) {
        const newExpiry = addDays(ms.expiryDate, days);
        await prisma.membership.update({ where: { id: ms.id }, data: { expiryDate: newExpiry } });
        if (referrer.membership?.id === ms.id) referrer.membership.expiryDate = newExpiry;
        await prisma.referralReward.update({
          where: { id: r.rewardId },
          data: { status: 'granted', membershipId: ms.id, grantedAt, grantedById: owner?.id ?? null },
        });
        await auditRow(grantedAt, {
          action: 'referral.grant',
          entity: 'referral',
          entityId: r.rewardId,
          entityLabel: `${referrer.memberNo} · ${referrer.name} ← ${r.referredName}`,
          before: { status: 'pending', expiryDate: ms.expiryDate },
          after: { status: 'granted', expiryDate: newExpiry, daysAdded: days },
        });
      } else {
        await prisma.referralReward.update({
          where: { id: r.rewardId },
          data: { status: 'granted', note: 'Gym shaker and towel', grantedAt, grantedById: owner?.id ?? null },
        });
      }
      rewardsGranted++;
    } else if (roll < 0.6) {
      await prisma.referralReward.update({ where: { id: r.rewardId }, data: { status: 'cancelled' } });
    }
  }

  // --- leads -------------------------------------------------------------------
  // The enquiry pipeline, in every state: fresh enquiries, people already
  // rung, people on a trial, people who joined (linked to the member they
  // became) and people who did not (with why). Follow-ups are spread around
  // today, so "due today" and "overdue" both have names in them.
  let leadsMade = 0;
  const OPEN_LEADS = [
    ...Array<string>(8).fill('new'), ...Array<string>(7).fill('contacted'),
    ...Array<string>(5).fill('trial'), ...Array<string>(6).fill('lost'),
  ];
  for (const [i, status] of OPEN_LEADS.entries()) {
    const enquiredAgo = status === 'new' ? (i < 3 ? 0 : between(2, 6)) : between(4, 45);
    const enquired = notAfterNow(atHour(daysAgo(enquiredAgo), 10, 20));
    // Due today for some of those still open, overdue for some (never from
    // before they enquired), the rest later this week or next.
    const followUpOn = status === 'lost' ? null
      : i % 5 === 0 || enquiredAgo < 2 ? gymDate(0)
      : i % 5 === 1 ? gymDate(-between(1, Math.min(6, enquiredAgo - 1)))
      : gymDate(between(1, 9));
    await prisma.lead.create({
      data: {
        gymId,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        phone: phoneNo(),
        source: pick(LEAD_SOURCES),
        interest: pick(LEAD_INTERESTS),
        notes: status === 'trial' ? 'Three-day trial — check how it went'
          : status === 'contacted' ? pick(['Asked about fees, will visit', 'Wants evening timings', 'Comparing with another gym'])
          : null,
        status,
        followUpOn,
        lostReason: status === 'lost' ? pick(LOST_REASONS) : null,
        createdById: desk(),
        createdAt: enquired,
      },
    });
    leadsMade++;
  }
  // Converted: enquiries that turned into members created this run, which is
  // what lets the page say which sources actually bring people in.
  for (const m of seeded.filter(s => s.kind === 'fresh' || s.kind === 'active').slice(-5)) {
    const enquired = atHour(addDays(m.createdAt, -between(2, 10)), 10, 20);
    const lead = await prisma.lead.create({
      data: {
        gymId,
        name: m.name,
        phone: phoneNo(),
        source: pick(LEAD_SOURCES),
        interest: pick(LEAD_INTERESTS),
        status: 'joined',
        followUpOn: null,
        memberId: m.id,
        createdById: desk(),
        createdAt: enquired,
      },
    });
    await auditRow(notAfterNow(atHour(m.createdAt, 10, 20)), {
      action: 'lead.convert',
      entity: 'lead',
      entityId: lead.id,
      entityLabel: m.name,
      before: { status: 'trial' },
      after: { status: 'joined', memberId: m.id, member: m.name },
    });
    leadsMade++;
  }

  // --- day passes ----------------------------------------------------------------
  // Walk-ins over the last month, a handful of them today, and some brought in
  // by members as guests — never more per member than the gym's monthly
  // guest allowance lets through.
  let dayPassesMade = 0;
  const fee = settings.dayPassFee.toNumber();
  const guestsBy = new Map<string, number>();
  const guestCap = settings.guestPassesPerMonth > 0 ? Math.min(2, settings.guestPassesPerMonth) : 2;
  for (let i = 0; i < 40; i++) {
    const visitedAt = notAfterNow(atHour(daysAgo(i < 6 ? 0 : between(1, 30)), 6, 21));
    const hostPool = running.filter(s => (guestsBy.get(s.id) ?? 0) < guestCap);
    const host = rand() > 0.7 && hostPool.length ? pick(hostPool) : null;
    if (host) guestsBy.set(host.id, (guestsBy.get(host.id) ?? 0) + 1);
    const how = takenBy(0.25);
    await prisma.dayPass.create({
      data: {
        gymId,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        phone: rand() > 0.3 ? phoneNo() : null,
        amount: fee,
        ...how,
        reference: how.method === 'online' && rand() > 0.4 ? `TID${between(10000000, 99999999)}` : null,
        visitedAt,
        hostMemberId: host?.id ?? null,
        notes: host ? null : pick([null, null, 'Visiting from Karachi', 'Trying the gym before joining', 'Traveller']),
        recordedById: desk(),
        createdAt: visitedAt,
      },
    });
    dayPassesMade++;
  }

  // --- lockers ----------------------------------------------------------------------
  // Two banks of them, added only where the number is not already painted on
  // a door. Handed out to members on this run's roster: most paying rent, the
  // yearly-plan ones covered by their plan, and a few still held by members
  // whose membership has run out — the ones the page flags to free up.
  const LOCKER_RENT = 500;
  await prisma.locker.createMany({
    data: [
      ...Array.from({ length: 24 }, (_, i) => ({ gymId, number: String(i + 1), location: "Men's changing room" })),
      ...Array.from({ length: 12 }, (_, i) => ({ gymId, number: `L${i + 1}`, location: 'Ladies changing room' })),
    ],
    skipDuplicates: true,
  });
  const freeLockers = await prisma.locker.findMany({ where: { gymId, memberId: null } });
  let lockersAssigned = 0;
  let lockerPayments = 0;
  const lockerFor = (gender: string) => {
    const i = freeLockers.findIndex(l => l.number.startsWith('L') === (gender === 'female'));
    return i === -1 ? null : freeLockers.splice(i, 1)[0]!;
  };
  const holders = [
    ...running.filter(s => s.kind === 'active' || s.kind === 'partial').slice(0, 14),
    ...seeded.filter(s => s.kind === 'expired' || s.kind === 'lapsed').slice(0, 4),
  ];
  for (const h of holders) {
    // A few always left free, however many times this runs, so the page has
    // a door to hand out.
    if (freeLockers.length <= 10) break;
    const locker = lockerFor(h.gender);
    if (!locker || !h.membership) continue;
    const expiredHolder = h.kind === 'expired' || h.kind === 'lapsed';
    const assignedAt = atHour(clamp(addDays(h.membership.startDate, between(0, 3)), h.membership.startDate, daysAgo(0)), 9, 20);
    await prisma.locker.update({
      where: { id: locker.id },
      data: { memberId: h.id, assignedAt: notAfterNow(assignedAt) },
    });
    lockersAssigned++;
    await auditRow(notAfterNow(assignedAt), {
      action: 'locker.assign',
      entity: 'locker',
      entityId: locker.id,
      entityLabel: `Locker ${locker.number}`,
      after: { memberId: h.id, memberNo: h.memberNo, name: h.name, ...(h.membership.includesLocker && { coveredByPlan: true }) },
    });
    // A plan with a locker in it has already paid for the door.
    if (h.membership.includesLocker) continue;
    // The month's rent when it was handed over, then each month since. The
    // latest one is sometimes still owed, and for somebody whose membership
    // has lapsed it always is — the locker is still theirs, the money is not.
    const months = Math.floor(wholeDaysSince(assignedAt) / 30);
    for (let k = 0; k <= months; k++) {
      const due = (k === months && k > 0 && rand() > 0.6) || (expiredHolder && k === months && k > 0);
      const how = takenBy(0.3);
      await prisma.payment.create({
        data: {
          gymId,
          memberId: h.id,
          type: 'locker',
          amount: LOCKER_RENT,
          ...(due ? { method: 'cash', channel: null } : how),
          status: due ? 'due' : 'paid',
          paymentDate: notAfterNow(atHour(addDays(assignedAt, 30 * k), 9, 20)),
          notes: k === 0 ? `Locker ${locker.number}` : `Locker ${locker.number} — monthly rent`,
          recordedById: desk(),
        },
      });
      lockerPayments++;
    }
  }

  // --- membership freezes -----------------------------------------------------------
  // One under way now, one that ran its course, one ended early and one
  // booked to start next week — moving each membership's expiry by exactly
  // the days granted, and copying the window onto it, as the freeze endpoint
  // does. Each from a different running membership.
  let freezesMade = 0;
  const freezable = seeded.filter(s => s.kind === 'active' && s.membership && !s.membership.includesLocker && s !== portalMember);
  const FREEZES = [
    // Under way: started a few days ago, three weeks long.
    { needsAgo: 6, start: (_: Date) => daysAgo(4), days: 21, endedEarlyAgo: null, reason: 'Travelling to Dubai for work' },
    // Over: five days, a couple of days after the membership began.
    { needsAgo: 14, start: (ms: Date) => addDays(ms, 2), days: 5, endedEarlyAgo: null, reason: 'Fever — doctor advised rest' },
    // Booked for a month, back after a week.
    { needsAgo: 12, start: (_: Date) => daysAgo(10), days: 30, endedEarlyAgo: 3, reason: 'Knee injury' },
    // Starts next week.
    { needsAgo: 0, start: (_: Date) => addDays(daysAgo(0), 5), days: 14, endedEarlyAgo: null, reason: 'Family wedding in Multan' },
  ];
  const usedForFreeze = new Set<string>();
  for (const f of FREEZES) {
    const who = freezable.find(s =>
      !usedForFreeze.has(s.id) && s.membership!.startDate <= daysAgo(f.needsAgo));
    if (!who) continue;
    usedForFreeze.add(who.id);
    const ms = await prisma.membership.findUniqueOrThrow({ where: { id: who.membership!.id } });
    const start = f.start(ms.startDate);
    // Ending early hands back the unused days: what is left is the days the
    // member was actually away, and the window closes on the day they came back.
    const until = f.endedEarlyAgo === null ? addDays(start, f.days) : daysAgo(f.endedEarlyAgo);
    const granted = f.endedEarlyAgo === null ? f.days : Math.round((until.getTime() - start.getTime()) / 86_400_000);
    const bookedAt = start < daysAgo(0) ? atHour(start, 8, 11) : notAfterNow(atHour(daysAgo(0), 8, 11));
    await prisma.membershipFreeze.create({
      data: {
        gymId,
        membershipId: ms.id,
        startDate: start,
        days: granted,
        endedEarlyOn: f.endedEarlyAgo === null ? null : until,
        reason: f.reason,
        createdAt: bookedAt,
      },
    });
    const newExpiry = addDays(ms.expiryDate, granted);
    await prisma.membership.update({
      where: { id: ms.id },
      data: { expiryDate: newExpiry, frozenFrom: start, frozenUntil: until },
    });
    who.membership!.expiryDate = newExpiry;
    await auditRow(bookedAt, {
      action: 'membership.freeze',
      entity: 'membership',
      entityId: ms.id,
      entityLabel: `${who.memberNo} · ${who.name}`,
      before: { expiryDate: ms.expiryDate },
      after: { expiryDate: addDays(ms.expiryDate, f.days), frozenFrom: start, frozenUntil: addDays(start, f.days), days: f.days },
      reason: f.reason,
    });
    if (f.endedEarlyAgo !== null) {
      await auditRow(atHour(until, 8, 11), {
        action: 'membership.unfreeze',
        entity: 'membership',
        entityId: ms.id,
        entityLabel: `${who.memberNo} · ${who.name}`,
        before: { expiryDate: addDays(ms.expiryDate, f.days), frozenUntil: addDays(start, f.days) },
        after: { expiryDate: newExpiry, frozenUntil: until },
      });
    }
    freezesMade++;
  }

  // --- body measurements -----------------------------------------------------------
  // Monthly weigh-ins for the long-standing members, trending the way a
  // member with a goal trends — some cutting, some building — so the progress
  // chart draws a line rather than a dot.
  let measurementsMade = 0;
  for (const m of longStanders) {
    const tenure = wholeDaysSince(m.createdAt);
    const count = Math.min(6, Math.floor(tenure / 30) + 1);
    if (count < 2) continue;
    const cutting = m.gender === 'female' ? rand() > 0.2 : rand() > 0.45;
    let weight = cutting ? (m.gender === 'female' ? between(68, 82) : between(84, 102)) : (m.gender === 'female' ? between(50, 58) : between(60, 70));
    let fat = cutting ? between(26, 34) : between(13, 19);
    let waist = cutting ? between(92, 108) : between(72, 80);
    let chest = m.gender === 'female' ? between(86, 98) : between(92, 104);
    let arm = m.gender === 'female' ? between(27, 31) : between(30, 36);
    const hips = m.gender === 'female' ? between(98, 112) : null;
    const thigh = between(52, 62);
    for (let k = count - 1; k >= 0; k--) {
      const measuredOn = daysAgo(30 * k + between(0, 3));
      // Some months the member only stepped on the scale.
      const weightOnly = k !== 0 && k !== count - 1 && rand() > 0.7;
      await prisma.memberMeasurement.create({
        data: {
          gymId,
          memberId: m.id,
          measuredOn,
          weightKg: tenth(weight),
          bodyFatPct: weightOnly ? null : tenth(fat),
          chestCm: weightOnly ? null : tenth(chest),
          waistCm: weightOnly ? null : tenth(waist),
          hipsCm: weightOnly || hips === null ? null : tenth(hips - (count - 1 - k) * (cutting ? 1.1 : 0)),
          armCm: weightOnly ? null : tenth(arm),
          thighCm: weightOnly ? null : tenth(thigh + (count - 1 - k) * (cutting ? -0.6 : 0.5)),
          notes: k === count - 1 ? 'Starting measurements' : k === 0 ? pick(['Monthly check-in', 'Good progress', null]) : null,
          recordedById: desk(),
          createdAt: atHour(measuredOn, 9, 20) > new Date() ? new Date() : atHour(measuredOn, 9, 20),
        },
      });
      measurementsMade++;
      weight += cutting ? -(1 + rand() * 1.4) : 0.5 + rand() * 0.8;
      fat += cutting ? -(0.5 + rand() * 0.6) : 0.1 + rand() * 0.2;
      waist += cutting ? -(0.9 + rand() * 1.0) : 0.2 + rand() * 0.3;
      chest += cutting ? -(0.2 + rand() * 0.3) : 0.6 + rand() * 0.6;
      arm += cutting ? -(0.1 * rand()) : 0.2 + rand() * 0.3;
    }
  }

  // --- health declarations -------------------------------------------------------
  // Most members signed the questionnaire and waiver the day they joined; a
  // few never did, so the "not signed" state shows too. Around one in five
  // declared something a trainer should know about.
  let declarationsMade = 0;
  const waiverText = waiverFor(settings);
  const CONDITION_NOTES: Record<string, string> = {
    bp: 'High BP, on medication', diabetes: 'Type 2, controlled with tablets', heart: 'Mild arrhythmia — doctor says light cardio only',
    asthma: 'Uses an inhaler before cardio', injury: 'Lower back pain, avoid heavy deadlifts', surgery: 'Knee arthroscopy last year',
    pregnancy: 'Second trimester, light training only', other: 'Migraines',
  };
  for (const m of seeded) {
    if (rand() < 0.12) continue;
    const declared: string[] = [];
    if (rand() < 0.22) {
      const pool = m.gender === 'female'
        ? ['bp', 'diabetes', 'asthma', 'injury', 'surgery', 'pregnancy', 'other']
        : ['bp', 'diabetes', 'heart', 'asthma', 'injury', 'surgery', 'other'];
      declared.push(pick(pool));
      if (rand() < 0.3) {
        const second = pick(pool);
        if (!declared.includes(second)) declared.push(second);
      }
    }
    const signedAt = notAfterNow(new Date(m.createdAt.getTime() + between(5, 40) * 60_000));
    await prisma.healthDeclaration.create({
      data: {
        gymId,
        memberId: m.id,
        conditions: declared,
        details: declared.length ? declared.map(c => CONDITION_NOTES[c]).join('; ') : null,
        medications: declared.includes('bp') ? 'Amlodipine 5mg' : declared.includes('diabetes') ? 'Metformin' : null,
        waiverText,
        signature: signaturePng(),
        signedName: m.name,
        signedAt,
        membershipId: m.membership?.id ?? null,
        recordedById: desk(),
      },
    });
    declarationsMade++;
  }

  const equipmentMade = await seedEquipment(gymId, desk, books);

  // --- staff salaries ------------------------------------------------------------------
  // Profiles for the people the gym pays, the last few months paid, and the
  // current month still open with an advance, a deduction and a bonus on it.
  //
  // Everything goes through the same arithmetic the Salaries page uses: a
  // joining month is pro-rated by the days left in it, the net is base plus
  // bonuses less advances and deductions (never below zero), and money that
  // actually leaves the drawer — an advance, a payday with something to hand
  // over — is booked as a "salaries" expense in that person's name and linked
  // to the row that caused it. The attendance columns on a payment are left at
  // what the seeded staff attendance adds up to, as payday counts it.
  let staffMade = 0;
  let salaryPaymentsMade = 0;
  let adjustmentsMade = 0;
  let staffDaysMade = 0;
  const weeklyOff = settings.staffWeeklyOff;
  /** A Pakistan clock time on a gym day held as UTC midnight. */
  const pkt = (day: Date, hour: number, minute: number): Date =>
    new Date(day.getTime() + (hour - 5) * 3_600_000 + minute * 60_000);
  /**
   * A month of staff attendance, written once per person and month: mostly
   * present with real check-in and check-out times, now and then a half day,
   * a leave or a day nobody marked. Today's row has a check-in and, for most,
   * no check-out yet — they are still at work.
   */
  const seedStaffMonth = async (staffMemberId: string, month: Date, joinedOn: Date, lastDay: Date) => {
    if (await prisma.staffAttendance.count({ where: { staffMemberId, day: { gte: month, lte: lastDay } } })) return;
    const today = gymDate(0);
    const rows = [];
    for (let t = Math.max(month.getTime(), joinedOn.getTime()); t <= lastDay.getTime(); t += 86_400_000) {
      const day = new Date(t);
      const isToday = t === today.getTime();
      if (weeklyOff !== null && day.getUTCDay() === weeklyOff) continue;
      const roll = rand();
      if (!isToday && roll < 0.04) continue; // absent, unmarked
      const status = isToday ? 'present' : roll < 0.09 ? 'leave' : roll < 0.13 ? 'half' : 'present';
      const checkInAt = status === 'leave' ? null : notAfterNow(pkt(day, between(8, 9), between(0, 59)));
      const checkOutAt = status === 'leave' || (isToday && rand() < 0.8)
        ? null
        : pkt(day, status === 'half' ? between(13, 14) : between(17, 20), between(0, 59));
      rows.push({
        gymId, staffMemberId, day, status, checkInAt,
        checkOutAt: checkOutAt && checkOutAt.getTime() < Date.now() ? checkOutAt : null,
        recordedById: desk(), createdAt: checkInAt ?? pkt(day, 9, 0),
      });
    }
    await prisma.staffAttendance.createMany({ data: rows });
    staffDaysMade += rows.length;
  };
  const baseFor = (salary: number, joinedOn: Date, month: Date): number => {
    if (joinedOn.toISOString().slice(0, 7) !== month.toISOString().slice(0, 7)) return salary;
    const total = daysInMonth(month);
    return Math.round((salary * (total - joinedOn.getUTCDate() + 1)) / total);
  };
  for (const s of STAFF) {
    const joinedMonth = monthStartUtc(s.joinedMonthsAgo);
    const joinedOn = new Date(Date.UTC(joinedMonth.getUTCFullYear(), joinedMonth.getUTCMonth(), s.joinedDay));
    const login = s.login ? logins[s.login] : undefined;
    let person = await prisma.staffMember.findFirst({ where: { gymId, name: s.name } });
    if (!person) {
      // A login already tied to another profile stays where it is.
      const linkable = login && !(await prisma.staffMember.findUnique({ where: { userId: login.id } }));
      person = await prisma.staffMember.create({
        data: {
          gymId,
          name: s.name,
          phone: s.phone,
          role: s.role,
          monthlySalary: s.monthlySalary,
          joinedOn,
          userId: login && linkable ? login.id : null,
          isActive: s.isActive,
          notes: s.isActive ? null : `Left at the end of ${monthLabel(monthStartUtc(2))}`,
          createdAt: joinedOn,
        },
      });
      staffMade++;
    }

    // Months back from 3 to the current one (0). Somebody who has left was
    // paid up to two months ago and is not on the sheet after that.
    for (let back = 3; back >= 0; back--) {
      const month = monthStartUtc(back);
      if (joinedOn > new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), daysInMonth(month)))) continue;
      if (!s.isActive && back < 2) continue;
      const monthLast = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), daysInMonth(month)));
      const today = gymDate(0);
      await seedStaffMonth(person.id, month, joinedOn, monthLast < today ? monthLast : today);
      const marked = await prisma.staffAttendance.findMany({
        where: { staffMemberId: person.id, day: { gte: month, lte: monthLast } },
        select: { day: true, status: true },
      });
      const days = summarise(month, marked, { joinedOn, weeklyOff, today });

      const paidAlready = await prisma.salaryPayment.findUnique({
        where: { staffMemberId_month: { staffMemberId: person.id, month } },
      });
      if (paidAlready) {
        // Paid by an earlier run before attendance was seeded: give it the days.
        if (paidAlready.presentDays.equals(0) && days.presentDays > 0) {
          await prisma.salaryPayment.update({
            where: { id: paidAlready.id },
            data: { presentDays: days.presentDays, leaveDays: days.leaveDays, absentDays: days.absentDays },
          });
        }
        continue;
      }
      const hasAdjustments = await prisma.salaryAdjustment.count({ where: { staffMemberId: person.id, month } });

      // What happened during the month. The current month gets one of each
      // kind spread across the staff; past months now and then an advance.
      const adjustments: { kind: 'advance' | 'deduction' | 'bonus'; amount: number; notes: string; day: number }[] = [];
      if (back === 0) {
        if (s.name === 'Sana Iqbal') adjustments.push({ kind: 'advance', amount: 10000, notes: "Sister's wedding", day: 6 });
        if (s.name === 'Imran Masih') adjustments.push({ kind: 'deduction', amount: 2000, notes: 'Two days absent without leave', day: 10 });
        if (s.name === 'Tariq Mehmood') adjustments.push({ kind: 'bonus', amount: 5000, notes: 'Night shifts during renovation', day: 12 });
        if (s.name === 'Kamran Shah') adjustments.push({ kind: 'advance', amount: 15000, notes: 'Medical bills', day: 3 });
      } else {
        if (s.name === 'Kamran Shah' && back === 1) adjustments.push({ kind: 'advance', amount: 20000, notes: 'School fees', day: 14 });
        if (s.name === 'Imran Masih' && back === 2) adjustments.push({ kind: 'advance', amount: 5000, notes: 'Rent', day: 18 });
        if (s.name === 'Sana Iqbal' && back === 1) adjustments.push({ kind: 'bonus', amount: 4000, notes: 'Most renewals collected', day: 28 });
        if (s.name === 'Tariq Mehmood' && back === 2) adjustments.push({ kind: 'deduction', amount: 1500, notes: 'Late on six days', day: 25 });
      }

      if (hasAdjustments === 0) {
        for (const a of adjustments) {
          const on = new Date(month.getUTCFullYear(), month.getUTCMonth(), Math.min(a.day, daysInMonth(month)));
          const at = notAfterNow(atHour(on, 10, 18));
          // An advance is cash out of the drawer the day it is given.
          const expense = a.kind === 'advance'
            ? await prisma.expense.create({
              data: {
                gymId,
                category: 'salaries',
                amount: a.amount,
                spentOn: at,
                vendor: s.name,
                notes: `Salary advance — ${monthLabel(month)}`,
                recordedById: books(),
                createdAt: at,
              },
            })
            : null;
          await prisma.salaryAdjustment.create({
            data: {
              gymId,
              staffMemberId: person.id,
              kind: a.kind,
              amount: a.amount,
              month,
              notes: a.notes,
              expenseId: expense?.id ?? null,
              recordedById: books(),
              createdAt: at,
            },
          });
          adjustmentsMade++;
        }
      }

      // The current month is still open: what it owes shows on the sheet,
      // unpaid, until payday.
      if (back === 0) continue;

      // Payday falls in the first days of the following month — never later
      // than now, for last month's when today is the 1st.
      const recorded = await prisma.salaryAdjustment.findMany({ where: { staffMemberId: person.id, month } });
      const of = (kind: string) => recorded.filter(a => a.kind === kind).reduce((t, a) => t + a.amount.toNumber(), 0);
      const baseSalary = baseFor(person.monthlySalary.toNumber(), joinedOn, month);
      const bonuses = of('bonus');
      const advances = of('advance');
      const deductions = of('deduction');
      const netPay = Math.max(0, Math.round((baseSalary + bonuses - advances - deductions) * 100) / 100);
      // Absences are shown, not cut: the gym's "cut salary for absent days" is
      // left off, as it is by default.
      const nextMonth = new Date(month.getUTCFullYear(), month.getUTCMonth() + 1, between(1, 3));
      const paidAt = notAfterNow(atHour(nextMonth, 11, 17));
      const how = s.monthlySalary >= 60000 ? { method: 'online', channel: 'bank' } : { method: 'cash', channel: null };
      const recordedById = books();
      const expense = netPay > 0
        ? await prisma.expense.create({
          data: {
            gymId,
            category: 'salaries',
            amount: netPay,
            spentOn: paidAt,
            vendor: s.name,
            notes: `Salary — ${monthLabel(month)}`,
            recordedById,
            createdAt: paidAt,
          },
        })
        : null;
      const payment = await prisma.salaryPayment.create({
        data: {
          gymId,
          staffMemberId: person.id,
          month,
          baseSalary,
          bonuses,
          advances,
          deductions,
          presentDays: days.presentDays,
          leaveDays: days.leaveDays,
          absentDays: days.absentDays,
          netPay,
          ...how,
          reference: how.method === 'online' ? `IBFT${between(100000, 999999)}` : null,
          paidAt,
          expenseId: expense?.id ?? null,
          recordedById,
          createdAt: paidAt,
        },
      });
      salaryPaymentsMade++;
      await auditRow(paidAt, {
        action: 'salary.pay',
        entity: 'salaryPayment',
        entityId: payment.id,
        entityLabel: `${s.name} · ${monthLabel(month)} · Rs. ${netPay}`,
        after: { month: month.toISOString().slice(0, 7), baseSalary, bonuses, advances, deductions, netPay, method: how.method },
      });
    }
  }

  // A trainer payout at the start of this month, for last month's sessions —
  // the entry the payouts page's history would have left.
  for (const t of trainers) {
    const settled = await prisma.ptSession.aggregate({
      where: { gymId, trainerId: t.id, payoutStatus: 'paid' },
      _sum: { trainerCommission: true },
      _count: true,
    });
    if (!settled._count) continue;
    await auditRow(notAfterNow(atHour(new Date(now.getFullYear(), now.getMonth(), 2), 12, 16)), {
      action: 'trainer.payout',
      entity: 'trainer',
      entityId: t.id,
      entityLabel: `${t.name} · Rs. ${settled._sum.trainerCommission?.toNumber() ?? 0}`,
      after: { sessions: settled._count, amount: settled._sum.trainerCommission?.toNumber() ?? 0 },
    });
  }

  console.log(
    [
      `Done — ${created} members (${withTrainer} with a trainer)`,
      `${paymentsMade + lockerPayments} payments`,
      `${checkins} check-ins`,
      `${enrolled} fingerprints enrolled`,
      `${salesMade} supplement sales to members and ${walkInSales} to walk-ins`,
      `${restocks} restocks`,
      `${ptSessionsMade} PT sessions`,
      `${bookingsMade} class bookings`,
      `${expensesAdded} expenses`,
      `${trainers.length} trainers`,
      `${classes.length} classes on ${schedules.length} weekly slots`,
      `${supplements.length} supplements`,
      `${workoutPlans.length} workout and ${dietPlans.length} diet plans`,
      `${promos.length} promo codes (${promoUses} used this run)`,
      `${referrals.length} referrals (${rewardsGranted} rewarded)`,
      `${leadsMade} leads`,
      `${dayPassesMade} day passes`,
      `${lockersAssigned} lockers handed out (${lockerPayments} rent payments)`,
      `${freezesMade} freezes`,
      `${measurementsMade} measurements`,
      `${staffMade} staff profiles, ${adjustmentsMade} salary adjustments, ${salaryPaymentsMade} salaries paid, ${staffDaysMade} staff attendance days, ${declarationsMade} health declarations, ${equipmentMade.machines} machines (${equipmentMade.services} services, ${equipmentMade.faults} faults)`,
      `${audits} audit entries`,
    ].join(', ') + '.',
  );
  console.log(
    `Staff logins: reception.${tag}@demo.gymflow.pk, accounts.${tag}@demo.gymflow.pk; ` +
    `member portal: ${memberAddress} — all with password123.`,
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
