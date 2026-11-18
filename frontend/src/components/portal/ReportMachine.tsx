import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { Card, secondaryButton } from '../ui';
import ReportFaultModal from '../equipment/ReportFaultModal';

/**
 * Lets a member tell the gym a machine is broken. Hidden when the gym has not
 * listed its machines, since there would be nothing to pick.
 */
export default function ReportMachine() {
  const { t } = useLanguage();
  const [machines, setMachines] = useState<{ id: string; name: string; location: string | null }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void api.get<typeof machines>('/me/equipment').then(r => setMachines(r.data)).catch(() => setMachines([]));
  }, []);
  if (machines.length === 0) return null;

  return (
    <Card className="p-4 flex flex-wrap items-center gap-3">
      <Wrench size={18} className="text-orange-500" />
      <p className="flex-1 text-sm text-gray-700 dark:text-slate-300">{t('Something broken in the gym? Let the staff know.')}</p>
      <button onClick={() => setOpen(true)} className={secondaryButton}>{t('Report a fault')}</button>
      {open && (
        <ReportFaultModal machines={machines} endpoint="/me/equipment-faults"
          onClose={() => setOpen(false)} onDone={() => setOpen(false)} />
      )}
    </Card>
  );
}
