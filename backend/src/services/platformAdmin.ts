/**
 * Who runs the whole product, as opposed to one gym.
 *
 * A gym's owner sees their own gym and nothing else; the platform operator
 * sees every gym — who signed up, who is using it, who has paid. That is a
 * different kind of power from any `Role`, so it is not one. It is a short list
 * of email addresses in `PLATFORM_ADMIN_EMAILS` (comma-separated), read per
 * call so changing it does not need a restart.
 *
 * Deliberately outside the database: nothing a signed-in user can edit,
 * through any route, can grant it. Empty or unset means nobody has it.
 */
export const isPlatformAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
};
