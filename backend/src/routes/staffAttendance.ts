import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import {
  markStaffAttendanceSchema, salaryMonthQuerySchema, staffCheckSchema, staffDayQuerySchema,
} from '../schemas.js';
import { checkIn, checkOut, getDay, getMonth, mark } from '../controllers/staffAttendanceController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);

// Checking staff in and out is the desk's job, the same as checking members in.
router.get('/', requirePermission('canCheckIn'), validate(staffDayQuerySchema, 'query'), authed(getDay));
router.post('/check-in', requirePermission('canCheckIn'), validate(staffCheckSchema), authed(checkIn));
router.post('/check-out', requirePermission('canCheckIn'), validate(staffCheckSchema), authed(checkOut));

// The register and corrections to it decide pay, so they sit with salaries.
router.get('/month', requirePermission('canManageExpenses'), validate(salaryMonthQuerySchema, 'query'), authed(getMonth));
router.put('/mark', requirePermission('canManageExpenses'), validate(markStaffAttendanceSchema), authed(mark));

export default router;
