import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import { createDayPassSchema, dayPassQuerySchema, idParam } from '../schemas.js';
import { create, getAll, remove } from '../controllers/dayPassesController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);
// Selling a day pass is taking money at the counter, like a fee.
router.use(requirePermission('canRecordPayments'));

router.get('/', validate(dayPassQuerySchema, 'query'), authed(getAll));
router.post('/', validate(createDayPassSchema), authed(create));
// Undoing a sale is a correction to the books, which is a bigger permission
// than making one.
router.delete('/:id', requirePermission('canManagePayments'), validate(idParam, 'params'), authed(remove));

export default router;
