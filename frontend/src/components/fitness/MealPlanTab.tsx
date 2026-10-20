import { Droplets, Sparkles, Copy, Check } from 'lucide-react';
import { Card } from '../ui';
import type { Goal, MacroResult, GainerProfile, MealSlot, CalcTab } from './data';

interface MealPlanTabProps {
  weightKg: number;
  goal: Goal;
  selectedGainer: string;
  macros: MacroResult;
  gainer: GainerProfile;
  gainerCalories: number;
  mealDistribution: MealSlot[];
  handleAskAi: (e?: React.FormEvent, customQuestion?: string) => Promise<void>;
  setTab: React.Dispatch<React.SetStateAction<CalcTab>>;
  handleCopyDietSummary: () => void;
  copiedPlan: boolean;
}

export default function MealPlanTab({
  copiedPlan,
  weightKg,
  goal,
  selectedGainer,
  macros,
  gainer,
  gainerCalories,
  mealDistribution,
  handleAskAi,
  setTab,
  handleCopyDietSummary,
}: MealPlanTabProps) {
  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <Card className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} /> Auto Calculated Meal Distribution
            </div>
            <h2 className="text-xl font-black mt-1">
              {macros.targetCalories.toLocaleString()} Calories & {macros.proteinGrams}g Protein Breakdown
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Body weight {weightKg} kg {selectedGainer !== 'none' ? `+ ${gainer.name} (${gainerCalories} kcal)` : ''} ke hisaab se 4 meals me protein aur calories ko scientifically divide kiya gaya ha.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTab('ai_advisor');
                void handleAskAi(undefined, `Mujhe ${weightKg}kg wazan aur ${goal.replace('_', ' ')} target ke liye full customized Pakistani Desi meal plan aur exact timing detail se samjhao.`);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-2 shrink-0 shadow-md shadow-purple-600/30"
            >
              <Sparkles size={16} />
              <span>Ask AI To Personalize Diet</span>
            </button>
            <button
              type="button"
              onClick={handleCopyDietSummary}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-2 shrink-0 shadow-md shadow-blue-600/30"
            >
              {copiedPlan ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedPlan ? 'Copied to Clipboard' : 'Copy Full Plan'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* The 4 Meals Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mealDistribution.map((m, idx) => (
          <Card key={m.name} className="p-5 border-t-4 border-t-indigo-500 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Meal #{idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">{m.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{m.time}</p>
                </div>
                <span className="text-lg font-black text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-800 px-3 py-1 rounded-xl">
                  {m.calories} <span className="text-xs font-medium text-gray-400">kcal</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-center">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">Protein</span>
                  <span className="text-sm font-black text-rose-700 dark:text-rose-300">{m.protein}g</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block uppercase">Carbs</span>
                  <span className="text-sm font-black text-amber-700 dark:text-amber-300">{m.carbs}g</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Fats</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{m.fats}g</span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block uppercase">
                  Recommended Pakistani / Gym Diet Foods:
                </span>
                <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mt-1 leading-relaxed">
                  {m.foodIdea}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Hydration & Supplement Suggestions */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-3">
          <Droplets size={16} className="text-cyan-600 dark:text-cyan-400" />
          Daily Hydration & Supplement Timings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-900 dark:text-cyan-300">
            <strong className="block font-bold mb-1">Water Target: {macros.waterLiters} Liters</strong>
            Workout se pehle 500ml aur workout ke doraan sip-by-sip paani piyen taake dehydration aur muscle cramps na hon.
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-900 dark:text-purple-300">
            <strong className="block font-bold mb-1">Creatine Monohydrate: 5g</strong>
            Rozana 5g kisi b waqt (subah ya post-workout) paani ke sath len taake muscle strength aur ATP boost ho.
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
            <strong className="block font-bold mb-1">Stack Timing</strong>
            Pre-workout gym se 25 min pehle, aur {gainer.name} workout k 20 min baad len.
          </div>
        </div>
      </Card>
    </div>
  );
}
