/** @format */

import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { JOB_GROUPS, runJobGroup, type JobGroup } from "../jobs/index.js";

const router = Router();

/**
 * Whether the caller holds `CRON_SECRET`. Vercel's cron sends it as a bearer
 * token on every scheduled call. Compared in constant time, and closed when
 * the secret is unset, so a deployment that never configured crons does not
 * leave reminders and billing triggerable by anyone.
 */
const fromScheduler = (req: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

/**
 * Runs one batch of the daily jobs. On a host with a long-running process the
 * node-cron scheduler does this instead; see `startJobs`.
 *
 * Every job is written to be safe to run twice in a day (each one records what
 * it already sent or issued), so a retried call costs nothing.
 */
router.get("/:group", async (req: Request<{ group: string }>, res: Response) => {
  if (!fromScheduler(req) || !(req.params.group in JOB_GROUPS)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const results = await runJobGroup(req.params.group as JobGroup);
  res.status(results.every((r) => r.ok) ? 200 : 500).json({ results });
});

export default router;
