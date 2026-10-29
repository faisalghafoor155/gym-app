import { useState } from 'react';
import { Dumbbell, Utensils, Flame, UserRound } from 'lucide-react';
import { Card, InlineEmpty, SegmentedControl } from '../ui';
import type { DailyWorkout, DietMeal, MyProfile } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The workout and diet plans the gym assigned, in full — every day's
 * exercises and every meal — rather than just their names. Today's workout
 * opens first, because "what am I doing today" is why a member opens this.
 */
export default function MyPlans({ plan }: { plan: MyProfile['plan'] }) {
  const { t } = useLanguage();
  const workout = plan?.workoutPlan;
  const diet = plan?.dietPlan;
  const trainerName = plan?.trainer?.name;
  const fromTrainer = trainerName && (
    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
      <UserRound size={12} /> {t('From your trainer {name}', { name: trainerName })}
    </p>
  );
  const days = ((workout?.workoutData as { days?: DailyWorkout[] } | undefined)?.days ?? [])
    .filter(d => d.exercises.length > 0);
  const meals = ((diet?.dietData as { meals?: DietMeal[] } | undefined)?.meals ?? [])
    .filter(m => m.items.length > 0);

  const todayName = DAYS[new Date().getDay()]!;
  const [day, setDay] = useState(() => days.find(d => d.day === todayName)?.day ?? days[0]?.day ?? '');
  const shown = days.find(d => d.day === day);
  const totalCalories = meals.reduce((t, m) => t + m.items.reduce((s, i) => s + (Number(i.calories) || 0), 0), 0);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Dumbbell size={16} className="text-blue-600 dark:text-blue-400" /> {t('Workout plan')}
        </h2>
        {!workout ? (
          <InlineEmpty message={t('No workout plan assigned yet. Your trainer sets this up for you.')} />
        ) : (
          <>
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{workout.name}</p>
            {fromTrainer}
            {workout.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{workout.description}</p>
            )}
            {days.length > 0 && (
              <div className="mt-4 space-y-3">
                <SegmentedControl
                  value={day}
                  onChange={setDay}
                  options={days.map(d => ({ value: d.day, label: d.day === todayName ? t('{day} · Today', { day: t(d.day.slice(0, 3)) }) : t(d.day.slice(0, 3)) }))}
                />
                {shown && (
                  <ol className="divide-y divide-gray-100 dark:divide-slate-800 rounded-xl border border-gray-100 dark:border-slate-800">
                    {shown.exercises.map((ex, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                          <span className="font-medium text-gray-800 dark:text-slate-200 truncate">{ex.name}</span>
                        </span>
                        <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">
                          {ex.sets} × {ex.reps}{ex.weight ? ` · ${t('{weight} kg', { weight: ex.weight })}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {!days.some(d => d.day === todayName) && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('Today ({day}) is a rest day in your plan.', { day: t(todayName) })}</p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Utensils size={16} className="text-green-600 dark:text-green-400" /> {t('Diet plan')}
          {totalCalories > 0 && (
            <span className="ml-auto text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <Flame size={13} /> {t('{kcal} kcal / day', { kcal: totalCalories.toLocaleString() })}
            </span>
          )}
        </h2>
        {!diet ? (
          <InlineEmpty message={t('No diet plan assigned yet. Your trainer sets this up for you.')} />
        ) : (
          <>
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{diet.name}</p>
            {fromTrainer}
            {diet.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{diet.description}</p>
            )}
            {meals.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meals.map((meal, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                    <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">{t(meal.name)}</h3>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
                      {meal.items.map((item, j) => (
                        <li key={j} className="flex justify-between gap-2">
                          <span>{item.name} <span className="text-gray-400">({item.amount})</span></span>
                          <span className="text-gray-400 shrink-0">{item.calories} kcal</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
