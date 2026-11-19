import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import {
  addParticipantSchema, createChallengeSchema, idParam, participantParams, updateChallengeSchema,
} from '../schemas.js';
import {
  addParticipant, announce, create, getOne, list, remove, removeParticipant, update,
} from '../controllers/challengesController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);
// Challenges are for keeping members coming back, so they sit with whoever
// looks after members.
router.use(requirePermission('canManageMembers'));

router.get('/', authed(list));
router.post('/', validate(createChallengeSchema), authed(create));
router.get('/:id', validate(idParam, 'params'), authed(getOne));
router.put('/:id', validate(idParam, 'params'), validate(updateChallengeSchema), authed(update));
router.delete('/:id', validate(idParam, 'params'), authed(remove));
router.post('/:id/participants', validate(idParam, 'params'), validate(addParticipantSchema), authed(addParticipant));
router.delete('/:id/participants/:memberId', validate(participantParams, 'params'), authed(removeParticipant));
router.post('/:id/announce', validate(idParam, 'params'), authed(announce));

export default router;
