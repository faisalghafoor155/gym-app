import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';
import prisma from '../db.js';
import { authed, type AuthedRequest } from '../types.js';
import { askFitnessAi } from '../services/ai.js';
import { planFor, planHasFeature } from '../services/subscription.js';
import validate from '../middleware/validate.js';
import { aiChatSchema, type AiChatBody } from '../schemas.js';

const router = Router();

router.use(auth);

// The app-wide AI limiter counts per address, which a script rotating through
// addresses walks straight past. This one counts per account, behind `auth`,
// so each signed-in person gets a fair share of the platform's AI key however
// many networks they ask from.
const perAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${(req as AuthedRequest).userId}`,
  message: { error: 'Too many questions for now. Please try again in a while.' },
  skip: (req) =>
    process.env.NODE_ENV === 'test' &&
    req.headers['x-test-skip-ratelimit'] === '1',
});

/** How many weigh-ins the coach is shown. Enough for a trend, few enough
 *  that the prompt stays about the question rather than the history. */
const PROGRESS_POINTS = 8;

/**
 * The signed-in member's recent weigh-ins, as prompt lines, or undefined for
 * a staff account or a member who has logged nothing.
 *
 * Read from the session's own member record — the request body cannot name
 * whose history goes into the prompt.
 */
const progressFor = async (req: AuthedRequest<unknown>): Promise<string | undefined> => {
  if (!req.memberId) return undefined;
  const rows = await prisma.memberMeasurement.findMany({
    where: { gymId: req.gymId, memberId: req.memberId },
    orderBy: { measuredOn: 'desc' },
    take: PROGRESS_POINTS,
  });
  if (rows.length === 0) return undefined;
  return rows
    .reverse()
    .map((r) => {
      const parts = [
        r.weightKg && `weight ${r.weightKg.toString()} kg`,
        r.bodyFatPct && `body fat ${r.bodyFatPct.toString()}%`,
        r.chestCm && `chest ${r.chestCm.toString()} cm`,
        r.waistCm && `waist ${r.waistCm.toString()} cm`,
        r.hipsCm && `hips ${r.hipsCm.toString()} cm`,
        r.armCm && `arm ${r.armCm.toString()} cm`,
        r.thighCm && `thigh ${r.thighCm.toString()} cm`,
      ].filter(Boolean);
      return parts.length
        ? `- ${r.measuredOn.toISOString().slice(0, 10)}: ${parts.join(', ')}`
        : null;
    })
    .filter(Boolean)
    .join('\n') || undefined;
};

// Every field is bounded by the schema — the question, and each line of the
// lifter profile — since all of it goes into a prompt someone pays for.
router.post('/chat', perAccountLimiter, validate(aiChatSchema), authed(async (req: AuthedRequest<Record<string, string>, unknown, AiChatBody>, res: Response): Promise<void> => {
  const { message, context, apiKey, lang } = req.body;

  try {
    // A failed lookup costs the answer some context, not the answer itself.
    const progress = await progressFor(req).catch((err: unknown) => {
      console.error('AI progress lookup failed:', err);
      return undefined;
    });

    // Not a 402: a gym without the AI coach on its plan still gets an answer,
    // on its own key or from the built-in coach — just never on the
    // platform's bill.
    const usePlatformKeys = planHasFeature(await planFor(req.gymId), 'aiCoach');

    const reply = await askFitnessAi({
      message,
      context,
      apiKey: apiKey || (req.headers['x-ai-api-key'] as string | undefined),
      progress,
      lang: lang === 'en' ? 'en' : 'ur',
      usePlatformKeys,
    });

    res.json({ reply });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: 'Could not process AI request' });
  }
}));

export default router;
