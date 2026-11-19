import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireFeature } from '../middleware/requireFeature.js';
import { authed } from '../types.js';
import { broadcastAudienceSchema, createBroadcastSchema, idParam } from '../schemas.js';
import { audience, create, getOne, list, templates } from '../controllers/broadcastsController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);
// Messaging the whole roster is for whoever looks after members, the same
// people who run leads and feedback.
router.use(requirePermission('canManageMembers'));

router.get('/templates', authed(templates));
router.get('/audience', validate(broadcastAudienceSchema, 'query'), authed(audience));
router.get('/', authed(list));
router.get('/:id', validate(idParam, 'params'), authed(getOne));
// Sending is a WhatsApp feature of the gym's plan; reading the log is not.
router.post('/', requireFeature('whatsapp'), validate(createBroadcastSchema), authed(create));

export default router;
