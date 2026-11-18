import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ArrowRight } from 'lucide-react';
import { Card } from '../ui';
import api from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { EquipmentAlerts } from '../../types';

/**
 * Machines due a service and faults still open. Shown only when there is
 * something to do, like the low-stock card beside it.
 */
export default function MaintenanceCard() {
  const { t } = useLanguage();
  const [data, setData] = useState<EquipmentAlerts | null>(null);
  useEffect(() => {
    void api.get<EquipmentAlerts>('/equipment/alerts')
      .then(r => setData(r.data))
      .catch(() => setData(null));
  }, []);
  if (!data || (data.serviceDue.length === 0 && data.faults.length === 0)) return null;

  return (
    <Card className="p-5 border-orange-200 dark:border-orange-500/20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <Wrench size={16} className="text-orange-500" /> {t('Equipment needs attention')}
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            {data.serviceDue.length + data.faults.length}
          </span>
        </h2>
        <Link to="/equipment" className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          {t('Open')} <ArrowRight size={12} />
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {data.faults.slice(0, 6).map(f => (
          <li key={f.id} className="text-xs rounded-lg px-2.5 py-1.5 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <strong>{f.equipment.name}</strong> · {t('broken')}: {f.description.length > 40 ? `${f.description.slice(0, 40)}…` : f.description}
          </li>
        ))}
        {data.serviceDue.slice(0, 8).map(m => (
          <li key={m.id} className={`text-xs rounded-lg px-2.5 py-1.5 ${
            m.state === 'overdue' ? 'bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300'
              : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300'}`}>
            <strong>{m.name}</strong> · {m.state === 'overdue'
              ? t('service overdue {days}d', { days: Math.abs(m.daysLeft) })
              : m.daysLeft === 0 ? t('service due today') : t('service in {days}d', { days: m.daysLeft })}
          </li>
        ))}
      </ul>
    </Card>
  );
}
