/** @format */

import { Router } from "express";
import { z } from "zod";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js";
import { authed } from "../types.js";
import { idParam } from "../schemas.js";
import {
  approvalLinkConfirm,
  approvalLinkPage,
  approveGym,
  deleteGym,
  listGyms,
  resumeGym,
  suspendGym,
} from "../controllers/platformController.js";

const router = Router();

// The email approval link is its own credential, so it sits before `auth`:
// the operator may open it on a phone that has never signed in.
router.get("/approve/:token", approvalLinkPage);
router.post("/approve/:token", approvalLinkConfirm);

router.use(auth);
// Every route here is the operator's, never a gym owner's.
router.use(requirePlatformAdmin);

const suspendBody = z.object({ reason: z.string().trim().max(300).optional() });

const deleteBody = z.object({ confirmName: z.string().trim().max(200) });

router.get("/gyms", authed(listGyms));
router.post("/gyms/:id/approve", validate(idParam, "params"), authed(approveGym));
router.post("/gyms/:id/resume", validate(idParam, "params"), authed(resumeGym));
router.post(
  "/gyms/:id/suspend",
  validate(idParam, "params"),
  validate(suspendBody),
  authed(suspendGym),
);

router.delete(
  "/gyms/:id",
  validate(idParam, "params"),
  validate(deleteBody),
  authed(deleteGym),
);

export default router;
