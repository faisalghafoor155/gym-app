import prisma from '../db.js';

/**
 * Branch scoping, in one place.
 *
 * A request carries `branchId` when it is about one branch (see the auth
 * middleware) and none when it is about the whole gym. These turn that into
 * the `where` fragments each query adds, so "which branch" is decided once and
 * read the same way everywhere.
 */

type Scoped = { branchId?: string };

/** Rows that belong to the branch: check-ins, expenses, day passes. */
export const inBranch = (req: Scoped) => (req.branchId ? { branchId: req.branchId } : {});

/**
 * Members whose home is the branch. For counts and money, so a member is
 * counted once, at home, however many branches they may use.
 */
export const homeMembers = (req: Scoped) => (req.branchId ? { branchId: req.branchId } : {});

/**
 * Members the branch's desk deals with: its own, and anyone allowed to use
 * every branch. For the roster and the check-in search.
 */
export const membersAt = (req: Scoped) =>
  req.branchId ? { OR: [{ branchId: req.branchId }, { allBranches: true }] } : {};

/** Payments and memberships, through the member they belong to. */
export const viaMember = (req: Scoped) => (req.branchId ? { member: { branchId: req.branchId } } : {});

/**
 * The gym's main branch, made if it has none yet — a gym that signed up after
 * branches existed has no row until something needs one.
 */
export const mainBranchId = async (gymId: string): Promise<string> => {
  const main = await prisma.branch.findFirst({ where: { gymId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }], select: { id: true } });
  if (main) return main.id;
  const made = await prisma.branch.create({ data: { gymId, name: 'Main Branch', isMain: true } });
  return made.id;
};

/** The branch a new row should be filed under: the one in use, or the main one. */
export const branchForNew = async (req: Scoped & { gymId: string }): Promise<string> =>
  req.branchId ?? mainBranchId(req.gymId);
