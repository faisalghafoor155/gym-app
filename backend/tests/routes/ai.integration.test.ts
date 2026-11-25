import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('POST /api/ai/chat — whose key answers', () => {
  const geminiOk = () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'from gemini' }] } }],
  }), { status: 200 });

  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'platform-gemini');
    vi.stubEnv('OPENAI_API_KEY', 'platform-openai');
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => geminiOk());
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  const urls = () => fetchSpy.mock.calls.map(([u]) => String(u));

  it('answers a free gym from the built-in coach, never on the platform keys', async () => {
    const owner = await makeGym({ plan: 'free' });

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'creatine kab lun?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Creatine/);
    expect(urls().filter(u => /googleapis|openai/.test(u))).toEqual([]);
  });

  it('lets a free gym use a key of its own', async () => {
    const owner = await makeGym({ plan: 'free' });

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'Hi', apiKey: 'gym-own-key' });

    expect(res.body.reply).toBe('from gemini');
    expect(urls().some(u => u.includes('key=gym-own-key'))).toBe(true);
    expect(urls().some(u => u.includes('platform-gemini'))).toBe(false);
  });

  it('answers a paid gym on the platform key', async () => {
    const owner = await makeGym({ plan: 'basic' });

    const res = await api().post('/api/ai/chat').set('Cookie', owner.cookie)
      .send({ message: 'Hi' });

    expect(res.body.reply).toBe('from gemini');
    expect(urls().some(u => u.includes('key=platform-gemini'))).toBe(true);
  });
});
