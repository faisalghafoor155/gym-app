/**
 * Dark keeps each badge's hue but swaps the solid `-100` fill for a translucent
 * wash of the same colour: a solid pastel on a dark row glows like a highlight
 * and pulls the eye away from the row's actual content. The text lifts to the
 * 300/400 steps, which is where contrast comes back over a dark surface.
 */
const styles: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  expiring: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  // A superseded membership is history, not a problem — it should not draw
  // the eye the way an expired one does.
  superseded: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
  // Long gone rather than newly overdue — grey, so it does not compete with
  // the expired members somebody can still win back.
  lapsed: 'bg-slate-200 text-slate-600 dark:bg-slate-700/70 dark:text-slate-400',
  inactive: 'bg-slate-200 text-slate-600 dark:bg-slate-700/70 dark:text-slate-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  due: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  cash: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  // Violet rather than the accent. `online` sits in the same tables as `paid`
  // and `active`, and the accent is now a green — a blue-named badge would have
  // rendered as a third green and read as another success state rather than as
  // the payment method it is.
  online: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export default function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
      styles[status] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {status}
    </span>
  );
}
