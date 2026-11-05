import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rawApi, resetDb } from '../helpers.js';

beforeEach(async () => {
  await resetDb();
  process.env.CRON_SECRET = 'test-cron-secret';
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

/**
 * Vercel keeps no process running for node-cron, so its own scheduler calls
 * these instead. Anyone else calling them must get nothing.
 */
describe('/api/cron/:group', () => {
  it('runs the daily reminders for the scheduler', async () => {
    const res = await rawApi()
      .get('/api/cron/reminders')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(res.body.results.map((r: { job: string }) => r.job)).toEqual([
      'expiry reminders', 'dues reminders', 'greetings',
    ]);
  });

  it('is not there without the secret, or with the wrong one', async () => {
    expect((await rawApi().get('/api/cron/reminders')).status).toBe(404);
    expect((await rawApi().get('/api/cron/reminders')
      .set('Authorization', 'Bearer wrong')).status).toBe(404);
  });

  it('is closed entirely when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await rawApi().get('/api/cron/reminders')
      .set('Authorization', 'Bearer ')).status).toBe(404);
  });

  it('refuses a group that does not exist', async () => {
    expect((await rawApi().get('/api/cron/everything')
      .set('Authorization', 'Bearer test-cron-secret')).status).toBe(404);
  });
});
