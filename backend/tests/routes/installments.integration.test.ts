/** @format */

import { describe, it, expect, beforeEach, vi } from "vitest";

import prisma from "../../src/db.js";
import { addDays, startOfDay } from "../../src/services/membership.js";
import { installmentSummary } from "../../src/services/installments.js";
import { api, resetDb, makeGym, addMember, addMembership, addPlan, addUser } from "../helpers.js";

/**
 * Installment plans: what a member still owes split into parts with due dates,
 * settled by ordinary payments, chased by date, and optionally enforced at
 * check-in.
 */

const sent = vi.hoisted(() => [] as { to: string; variables?: string[] }[]);
vi.mock("../../src/services/messaging.js", () => ({
  messagingEnabled: () => true,
  sendMemberMessage: async (msg: { to: string; variables?: string[] }) => {
    sent.push(msg);
    return "sent";
  },
}));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

const ymd = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** A member on a settled Rs. 2,500 term about to run out, renewing onto a
 *  Rs. 6,000 plan. */
const setup = async () => {
  const owner = await makeGym();
  const member = await addMember(owner.gymId);
  const plan = await addPlan(owner.gymId, { price: 6000, durationDays: 90 });
  const ms = await addMembership(owner.gymId, member.id, { planId: plan.id, expiresInDays: 2 });
  await prisma.payment.create({
    data: { gymId: owner.gymId, memberId: member.id, membershipId: ms.id, amount: 2500, status: "paid", type: "membership" },
  });
  const renew = (body: Record<string, unknown>) =>
    api()
      .post(`/api/members/${member.id}/memberships/${ms.id}/renew`)
      .set("Cookie", owner.cookie)
      .send({ method: "cash", ...body });
  return { owner, member, plan, renew };
};

const balances = async (cookie: string) =>
  (await api().get("/api/payments/balances").set("Cookie", cookie)).body;

describe("installmentSummary", () => {
  const today = startOfDay(new Date());
  const parts = [
    { seq: 1, amount: 2000, dueDate: addDays(today, -5) },
    { seq: 2, amount: 2000, dueDate: addDays(today, 25) },
  ];

  it("settles the part paid at the sale first, then the parts in order", () => {
    // Rs. 6,000 sold, Rs. 2,000 down, the rest in two parts; Rs. 3,000 paid.
    const s = installmentSummary(6000, 3000, parts);
    expect(s.installments.map((p) => [p.paid, p.remaining, p.status])).toEqual([
      [1000, 1000, "overdue"],
      [0, 2000, "due"],
    ]);
    expect(s.overdue).toBe(1000);
    expect(s.nextDue).toEqual({ dueDate: parts[0].dueDate, remaining: 1000 });
  });

  it("reads everything paid once the money covers the price", () => {
    const s = installmentSummary(6000, 6000, parts);
    expect(s.installments.every((p) => p.status === "paid")).toBe(true);
    expect(s.overdue).toBe(0);
    expect(s.nextDue).toBeNull();
  });

  it("does not call a part due today overdue", () => {
    const s = installmentSummary(2000, 0, [{ seq: 1, amount: 2000, dueDate: today }]);
    expect(s.installments[0].status).toBe("due");
    expect(s.overdue).toBe(0);
  });
});

describe("selling on installments", () => {
  it("splits what a renewal leaves unpaid and shows each part on the dues list", async () => {
    const { owner, renew } = await setup();
    const res = await renew({
      amount: 2000,
      installments: [
        { amount: 2000, dueDate: ymd(addDays(new Date(), 30)) },
        { amount: 2000, dueDate: ymd(addDays(new Date(), 60)) },
      ],
    });
    expect(res.status).toBe(201);

    const body = await balances(owner.cookie);
    expect(body.memberships).toHaveLength(1);
    const row = body.memberships[0];
    expect(row).toMatchObject({ outstanding: 4000, overdue: 0 });
    expect(row.installments).toHaveLength(2);
    expect(row.installments.map((p: { status: string }) => p.status)).toEqual(["due", "due"]);
    expect(row.nextDue.remaining).toBe(2000);
  });

  it("refuses parts that do not add up to what is left unpaid", async () => {
    const { renew } = await setup();
    const res = await renew({
      amount: 2000,
      installments: [{ amount: 3000, dueDate: ymd(addDays(new Date(), 30)) }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/add up/);
    // Nothing was sold: the whole renewal rolled back.
    expect(await prisma.installment.count()).toBe(0);
    expect(await prisma.membership.count({ where: { status: "active" } })).toBe(1);
  });

  it("refuses parts whose dates go backwards", async () => {
    const { renew } = await setup();
    const res = await renew({
      amount: 2000,
      installments: [
        { amount: 2000, dueDate: ymd(addDays(new Date(), 60)) },
        { amount: 2000, dueDate: ymd(addDays(new Date(), 30)) },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("splits what the joining payment does not cover when registering", async () => {
    const owner = await makeGym();
    const plan = await addPlan(owner.gymId, { price: 9000, durationDays: 90 });
    const res = await api()
      .post("/api/members")
      .set("Cookie", owner.cookie)
      .send({
        name: "Bilal Khan",
        phone: "03111234567",
        planId: plan.id,
        feeAmount: 3000,
        feeMethod: "cash",
        installments: [
          { amount: 3000, dueDate: ymd(addDays(new Date(), 30)) },
          { amount: 3000, dueDate: ymd(addDays(new Date(), 60)) },
        ],
      });
    expect(res.status).toBe(201);
    expect(await prisma.installment.count()).toBe(2);
  });
});

describe("agreeing a plan later", () => {
  const owing = async () => {
    const { owner, member, renew } = await setup();
    const res = await renew({ amount: 2000 });
    return { owner, member, membershipId: res.body.id as string };
  };

  it("splits an existing balance, and paying a part settles it", async () => {
    const { owner, member, membershipId } = await owing();
    const url = `/api/members/${member.id}/memberships/${membershipId}/installments`;

    const set = await api()
      .put(url)
      .set("Cookie", owner.cookie)
      .send({
        installments: [
          { amount: 1500, dueDate: ymd(addDays(new Date(), -1)) },
          { amount: 2500, dueDate: ymd(addDays(new Date(), 20)) },
        ],
      });
    expect(set.status).toBe(200);

    let row = (await balances(owner.cookie)).memberships[0];
    expect(row.overdue).toBe(1500);
    expect(row.installments[0].status).toBe("overdue");

    await api()
      .post("/api/payments")
      .set("Cookie", owner.cookie)
      .send({ memberId: member.id, membershipId, amount: 1500, method: "cash", type: "membership" });

    row = (await balances(owner.cookie)).memberships[0];
    expect(row.overdue).toBe(0);
    expect(row.installments.map((p: { status: string }) => p.status)).toEqual(["paid", "due"]);
    expect(row.nextDue).toMatchObject({ remaining: 2500 });
  });

  it("refuses a split that is not the balance, and removes one on an empty list", async () => {
    const { owner, member, membershipId } = await owing();
    const url = `/api/members/${member.id}/memberships/${membershipId}/installments`;

    const wrong = await api()
      .put(url)
      .set("Cookie", owner.cookie)
      .send({ installments: [{ amount: 1000, dueDate: ymd(addDays(new Date(), 5)) }] });
    expect(wrong.status).toBe(400);

    await api()
      .put(url)
      .set("Cookie", owner.cookie)
      .send({ installments: [{ amount: 4000, dueDate: ymd(addDays(new Date(), 5)) }] });
    expect(await prisma.installment.count()).toBe(1);

    const removed = await api().put(url).set("Cookie", owner.cookie).send({ installments: [] });
    expect(removed.status).toBe(200);
    expect(await prisma.installment.count()).toBe(0);
    // Still owed, just not split.
    expect((await balances(owner.cookie)).memberships[0].outstanding).toBe(4000);
  });

  it("does not reach another gym's membership", async () => {
    const { member, membershipId } = await owing();
    const other = await makeGym({ gymName: "Other Gym" });
    const res = await api()
      .put(`/api/members/${member.id}/memberships/${membershipId}/installments`)
      .set("Cookie", other.cookie)
      .send({ installments: [] });
    expect(res.status).toBe(404);
  });
});

describe("the member's own view", () => {
  it("shows the member their balance and each installment", async () => {
    const { owner, member, renew } = await setup();
    await renew({
      amount: 2000,
      installments: [
        { amount: 1500, dueDate: ymd(addDays(new Date(), -1)) },
        { amount: 2500, dueDate: ymd(addDays(new Date(), 30)) },
      ],
    });
    const account = await addUser(owner.gymId, { role: "member", memberId: member.id });

    const res = await api().get("/api/me").set("Cookie", account.cookie);

    expect(res.status).toBe(200);
    expect(res.body.membershipBalance).toMatchObject({ outstanding: 4000, overdue: 1500 });
    expect(res.body.membershipBalance.installments.map((p: { status: string }) => p.status))
      .toEqual(["overdue", "due"]);
  });

  it("reports no balance on a fully paid membership", async () => {
    const { owner, member, renew } = await setup();
    await renew({ amount: 6000 });
    const account = await addUser(owner.gymId, { role: "member", memberId: member.id });

    const res = await api().get("/api/me").set("Cookie", account.cookie);
    expect(res.body.membershipBalance).toBeNull();
  });
});

describe("check-in with an overdue installment", () => {
  const overdueMember = async () => {
    const { owner, member, renew } = await setup();
    await renew({
      amount: 2000,
      installments: [
        { amount: 2000, dueDate: ymd(addDays(new Date(), -3)) },
        { amount: 2000, dueDate: ymd(addDays(new Date(), 30)) },
      ],
    });
    const checkin = () =>
      api().post("/api/attendance/checkin").set("Cookie", owner.cookie).send({ memberId: member.id });
    return { owner, checkin };
  };

  it("lets the member in and reports the overdue part when the gym has not chosen to block", async () => {
    const { checkin } = await overdueMember();
    const res = await checkin();
    expect(res.status).toBe(201);
    expect(res.body.fee).toMatchObject({ overdue: 2000 });
  });

  it("turns the member away when the gym blocks overdue installments", async () => {
    const { owner, checkin } = await overdueMember();
    await prisma.gym.update({ where: { id: owner.gymId }, data: { blockOverdueInstallments: true } });
    const res = await checkin();
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("installment_overdue");
    expect(await prisma.attendance.count()).toBe(0);
  });
});

describe("dues reminders on an installment plan", () => {
  const run = async () => (await import("../../src/jobs/duesReminders.js")).runDuesReminders();

  it("stays quiet while the next part is weeks away", async () => {
    const { renew } = await setup();
    await renew({
      amount: 2000,
      installments: [{ amount: 4000, dueDate: ymd(addDays(new Date(), 20)) }],
    });
    const result = await run();
    expect(result.skippedNotDue).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it("reminds once shortly before a part falls due", async () => {
    const { renew } = await setup();
    await renew({
      amount: 2000,
      installments: [
        { amount: 2000, dueDate: ymd(addDays(new Date(), 1)) },
        { amount: 2000, dueDate: ymd(addDays(new Date(), 30)) },
      ],
    });
    expect((await run()).sent).toBe(1);
    expect(sent[0].variables?.[2]).toMatch(/^Rs\. 2,000 \(due /);
    const log = await prisma.reminderLog.findFirstOrThrow();
    expect(log.kind).toBe("installmentDue");
  });

  it("chases what is overdue, not the whole balance", async () => {
    const { renew } = await setup();
    await renew({
      amount: 2000,
      installments: [
        { amount: 1000, dueDate: ymd(addDays(new Date(), -2)) },
        { amount: 3000, dueDate: ymd(addDays(new Date(), 30)) },
      ],
    });
    expect((await run()).sent).toBe(1);
    expect(sent[0].variables?.[2]).toBe("Rs. 1,000");
  });
});
