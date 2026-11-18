import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireOwner, requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import { assignStaffBranchSchema, createBranchSchema, idParam, updateBranchSchema } from '../schemas.js';
import { assignStaff, create, list, listStaff, overview, remove, update } from '../controllers/branchesController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);

// Every staff account needs the list, to know where it is working.
router.get('/', authed(list));
// The side-by-side figures are the gym's books.
router.get('/overview', requirePermission('canViewReports'), authed(overview));

// Opening branches and placing staff is the owner's.
router.post('/', requireOwner, validate(createBranchSchema), authed(create));
router.put('/:id', requireOwner, validate(idParam, 'params'), validate(updateBranchSchema), authed(update));
router.delete('/:id', requireOwner, validate(idParam, 'params'), authed(remove));
router.get('/staff', requireOwner, authed(listStaff));
router.put('/staff/:id', requireOwner, validate(idParam, 'params'), validate(assignStaffBranchSchema), authed(assignStaff));

export default router;
