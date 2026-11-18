import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import {
  createSalaryAdjustmentSchema, createStaffMemberSchema, idParam, paySalarySchema,
  salaryMonthQuerySchema, staffMemberQuerySchema, updateStaffMemberSchema,
} from '../schemas.js';
import {
  createAdjustment, createStaff, getPayment, getSheet, listStaff, pay,
  removeAdjustment, removePayment, removeStaff, updateStaff,
} from '../controllers/salariesController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);
// Salaries are paid out of the gym's books and land in its expenses, so they
// sit behind the same permission: the owner, a manager or an accountant.
router.use(requirePermission('canManageExpenses'));

router.get('/staff', validate(staffMemberQuerySchema, 'query'), authed(listStaff));
router.post('/staff', validate(createStaffMemberSchema), authed(createStaff));
router.put('/staff/:id', validate(idParam, 'params'), validate(updateStaffMemberSchema), authed(updateStaff));
router.delete('/staff/:id', validate(idParam, 'params'), authed(removeStaff));

router.get('/sheet', validate(salaryMonthQuerySchema, 'query'), authed(getSheet));

router.post('/adjustments', validate(createSalaryAdjustmentSchema), authed(createAdjustment));
router.delete('/adjustments/:id', validate(idParam, 'params'), authed(removeAdjustment));

router.post('/pay', validate(paySalarySchema), authed(pay));
router.get('/payments/:id', validate(idParam, 'params'), authed(getPayment));
router.delete('/payments/:id', validate(idParam, 'params'), authed(removePayment));

export default router;
