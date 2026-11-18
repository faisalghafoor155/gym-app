import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import { feedbackQuerySchema, idParam, updateFeedbackSchema } from '../schemas.js';
import { list, summary, update } from '../controllers/feedbackController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);
// Complaints are about members' experience, so they sit with whoever looks
// after members: the owner, a manager or a members manager.
router.use(requirePermission('canManageMembers'));

router.get('/', validate(feedbackQuerySchema, 'query'), authed(list));
router.get('/summary', authed(summary));
router.put('/:id', validate(idParam, 'params'), validate(updateFeedbackSchema), authed(update));

export default router;
