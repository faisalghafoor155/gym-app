const styles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expiring: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-200 text-gray-600',
  // A superseded membership is history, not a problem — it should not draw
  // the eye the way an expired one does.
  superseded: 'bg-gray-100 text-gray-500',
  // Long gone rather than newly overdue — grey, so it does not compete with
  // the expired members somebody can still win back.
  lapsed: 'bg-slate-200 text-slate-600',
  inactive: 'bg-slate-200 text-slate-600',
  paid: 'bg-green-100 text-green-700',
  due: 'bg-red-100 text-red-700',
  cash: 'bg-gray-100 text-gray-700',
  online: 'bg-blue-100 text-blue-700',
};

export default function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
