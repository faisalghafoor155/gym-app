import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Color = 'blue' | 'green' | 'red' | 'yellow';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  color?: Color;
}

const colors: Record<Color, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  yellow: 'bg-yellow-50 text-yellow-600',
};

export default function StatCard({ icon: Icon, label, value, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={22} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}
