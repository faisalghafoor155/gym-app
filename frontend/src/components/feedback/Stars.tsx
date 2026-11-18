import { Star } from 'lucide-react';

/** A row of five stars, filled to `value`; clickable when `onChange` is given. */
export default function Stars({ value, onChange, size = 16, label }: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={label ?? `${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => {
        const star = (
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-slate-600'} />
        );
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(n)} className="p-0.5 rounded hover:scale-110 transition-transform">
            {star}
          </button>
        ) : <span key={n}>{star}</span>;
      })}
    </span>
  );
}
