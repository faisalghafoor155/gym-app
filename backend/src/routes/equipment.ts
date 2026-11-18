import { Router } from 'express';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { requireStaff } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { authed } from '../types.js';
import {
  createEquipmentSchema, faultQuerySchema, fixFaultSchema, idParam, recordServiceSchema,
  reportFaultSchema, updateEquipmentSchema,
} from '../schemas.js';
import {
  alerts, create, fixFault, getOne, list, listFaults, recordService, remove, removeFault,
  removeService, reportFault, update,
} from '../controllers/equipmentController.js';

const router = Router();

router.use(auth);
router.use(requireStaff);

// Anyone on the floor can see the machines and say one is broken.
router.get('/', authed(list));
router.get('/alerts', authed(alerts));
router.get('/faults', validate(faultQuerySchema, 'query'), authed(listFaults));
router.post('/faults', validate(reportFaultSchema), authed(reportFault));
router.get('/:id', validate(idParam, 'params'), authed(getOne));

// Buying, servicing and repairing cost money and land in Expenses, so they
// sit with the same permission: the owner, a manager or an accountant.
const books = requirePermission('canManageExpenses');
router.post('/', books, validate(createEquipmentSchema), authed(create));
router.put('/:id', books, validate(idParam, 'params'), validate(updateEquipmentSchema), authed(update));
router.delete('/:id', books, validate(idParam, 'params'), authed(remove));
router.post('/:id/services', books, validate(idParam, 'params'), validate(recordServiceSchema), authed(recordService));
router.delete('/services/:id', books, validate(idParam, 'params'), authed(removeService));
router.put('/faults/:id/fix', books, validate(idParam, 'params'), validate(fixFaultSchema), authed(fixFault));
router.delete('/faults/:id', books, validate(idParam, 'params'), authed(removeFault));

export default router;
