import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '../ui';
import api from '../../api/client';

interface LowStockRow { id: string; name: string; stock: number; lowStockAt: number }

/**
 * Supplements at or below their reorder line. Fetched quietly: a staff
 * account without supplement access, or a gym that sells none, simply sees
 * no card rather than an error on the dashboard.
 */
export default function LowStockCard() {
  const [rows, setRows] = useState<LowStockRow[]>([]);
  useEffect(() => {
    void api.get<{ data: LowStockRow[] }>('/supplements/low-stock')
      .then(r => setRows(r.data.data))
      .catch(() => setRows([]));
  }, []);
  if (rows.length === 0) return null;

  return (
    <Card className="p-5 border-yellow-200 dark:border-yellow-500/20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-500" /> Supplements running low
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300">
            {rows.length}
          </span>
        </h2>
        <Link to="/supplements" className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          Restock <ArrowRight size={12} />
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {rows.slice(0, 12).map(r => (
          <li key={r.id} className={`text-xs rounded-lg px-2.5 py-1.5 ${
            r.stock === 0 ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300'}`}>
            <strong>{r.name}</strong> · {r.stock === 0 ? 'out of stock' : `${r.stock} left`}
          </li>
        ))}
      </ul>
    </Card>
  );
}
