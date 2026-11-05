import type { Request, Response, NextFunction } from 'express';
import { isPlatformAdmin } from '../services/platformAdmin.js';

/**
 * Gates a route to the platform operator. Mounted after `auth`, which puts the
 * signed-in account's email on the request.
 *
 * 404 rather than 403 for everyone else: a gym owner poking at /api/platform
 * has no business learning that the operator's tooling exists.
 */
export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const { userEmail, role, emailVerifiedAt } = req as Request & {
    userEmail?: string; role?: string; emailVerifiedAt?: Date | null;
  };
  if (!isPlatformAdmin({ email: userEmail, role, emailVerifiedAt })) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
};
