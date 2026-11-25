import { beforeEach, describe, expect, it } from 'vitest';
import { api, makeGym, rawApi, resetDb } from '../helpers.js';

/**
 * The AI coach runs on the platform's own key, so everything a caller can put
 * into the prompt is bounded, and each account gets its own share.
 */
beforeEach(resetDb);

describe('POST /api/ai/chat', () => {
  it('refuses an oversized lifter profile before anything reaches a model', async () => {
    const owner = await makeGym();

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'Diet plan please', context: { goal: 'x'.repeat(100_000) } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/context\.goal/);
  });

  it('refuses an oversized question', async () => {
    const owner = await makeGym();

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('refuses numbers that are not numbers', async () => {
    const owner = await makeGym();

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'Hi', context: { weightKg: 'a'.repeat(5000) } });

    expect(res.status).toBe(400);
  });

  it('limits each account, not only each address', async () => {
    const owner = await makeGym();

    // Invalid bodies: they still count against the limiter, which runs first,
    // and nothing is sent to a model.
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const res = await rawApi().post('/api/ai/chat').set('Cookie', owner.cookie).send({});
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
