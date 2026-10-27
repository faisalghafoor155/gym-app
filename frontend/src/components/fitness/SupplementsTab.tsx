import { Sparkles, Zap, Bot, Package, Clock, ShieldAlert, Dumbbell as WorkoutIcon } from 'lucide-react';
import { Card, FieldLabel, inputClass } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { MacroResult, GainerProfile, CalcTab } from './data';

interface SupplementsTabProps {
  weightKg: number;
  selectedGainer: string;
  setSelectedGainer: React.Dispatch<React.SetStateAction<string>>;
  gainerServing: 'half' | 'full';
  setGainerServing: React.Dispatch<React.SetStateAction<'half' | 'full'>>;
  takingPreworkout: boolean;
  setTakingPreworkout: React.Dispatch<React.SetStateAction<boolean>>;
  takingCreatine: boolean;
  setTakingCreatine: React.Dispatch<React.SetStateAction<boolean>>;
  macros: MacroResult;
  gainer: GainerProfile;
  gainerCalories: number;
  foodCaloriesNeeded: number;
  foodProteinNeeded: number;
  handleAskAi: (e?: React.FormEvent, customQuestion?: string) => Promise<void>;
  setTab: React.Dispatch<React.SetStateAction<CalcTab>>;
}

export default function SupplementsTab({
  weightKg,
  selectedGainer,
  setSelectedGainer,
  gainerServing,
  setGainerServing,
  takingPreworkout,
  setTakingPreworkout,
  takingCreatine,
  setTakingCreatine,
  macros,
  gainer,
  gainerCalories,
  foodCaloriesNeeded,
  foodProteinNeeded,
  handleAskAi,
  setTab,
}: SupplementsTabProps) {
  const { t } = useLanguage();
  const gainerName = t(gainer.name);
  return (
    <div className="space-y-6">
      {/* Top Gainer Banner */}
      <Card className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-400">
              <Package size={30} />
            </div>
            <div>
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Zap size={14} /> {t('Custom Supplement Stack & Diet Adjustment')}
              </span>
              <h2 className="text-xl font-black mt-1">
                {t('{gainer} Stack Guide ({weight} kg Lifter)', { gainer: gainerName, weight: weightKg })}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {t(gainer.features)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('workout_split')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow"
            >
              <WorkoutIcon size={14} />
              <span>{t('View 5-Day Workout Routine')}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Gainer Configurator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 space-y-3">
          <FieldLabel>{t('Select Gainer / Protein')}</FieldLabel>
          <select
            value={selectedGainer}
            onChange={e => setSelectedGainer(e.target.value)}
            className={inputClass}
          >
            <option value="anabolic_mass">Kevin Levrone Anabolic Mass</option>
            <option value="serious_mass">ON Serious Mass</option>
            <option value="carnivor_mass">MuscleMeds Carnivor Beef Mass</option>
            <option value="super_mass">Dymatize Super Mass Gainer</option>
            <option value="whey_gold">ON Whey Gold Standard / ISO-100</option>
            <option value="none">{t('None (Natural Food Only)')}</option>
          </select>
          <div className="text-xs text-gray-500 dark:text-slate-400 pt-1">
            <strong>{t('Best for:')}</strong> {t(gainer.bestFor)}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <FieldLabel>{t('Daily Serving Dose')}</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGainerServing('half')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                gainerServing === 'half'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300'
              }`}
            >
              {t('Half Serving (Recommended)')}
            </button>
            <button
              type="button"
              onClick={() => setGainerServing('full')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                gainerServing === 'full'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300'
              }`}
            >
              {t('Full Serving (Heavy Bulk)')}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            {t('A half serving keeps fat off your belly, and a tub lasts a whole month.')}
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <FieldLabel>{t('Additional Stacks')}</FieldLabel>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={takingPreworkout}
                onChange={e => setTakingPreworkout(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>{t('Pre-Workout (C4 / Psychotic / Curse)')}</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={takingCreatine}
                onChange={e => setTakingCreatine(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>{t('Creatine Monohydrate (5g Daily)')}</span>
            </label>
          </div>
        </Card>
      </div>

      {/* Quick Action: Ask AI About This Stack */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Bot size={22} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-purple-950 dark:text-purple-200">
              {t('Want a Live AI Protocol for the {gainer} Stack?', { gainer: gainerName })}
            </h4>
            <p className="text-[11px] text-purple-700 dark:text-purple-300">
              {t('The AI Coach will analyze dosages, digestion safety and belly-fat prevention specifically for your {weight}kg bodyweight.', { weight: weightKg })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab('ai_advisor');
            void handleAskAi(undefined, t('Give me a protocol for avoiding belly fat and gaining muscle fast at {weight}kg bodyweight with a {gainer} {creatine} {preworkout} stack.', { gainer: gainerName, creatine: takingCreatine ? '+ Creatine 5g' : '', preworkout: takingPreworkout ? '+ Pre-workout' : '', weight: weightKg }));
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <Sparkles size={14} />
          <span>{t('Ask AI About This Stack')}</span>
        </button>
      </div>

      {/* Precise Timings & Diet Protocol when taking this stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Timing Protocol */}
        <Card className="p-5 border-t-4 border-t-amber-500 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            {t('Stack Timing & Schedule (What to Take When)')}
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-amber-700 dark:text-amber-300 block mb-1">
                {t('1. Two Hours After Breakfast (11:00 AM):')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {t('If you are taking {gainer}, mix 1 scoop (half serving) in 350ml of fresh milk or water. This keeps a steady supply of amino acids and calories going until lunch.', { gainer: gainerName })}
              </p>
            </div>

            {takingPreworkout && (
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                <strong className="text-purple-700 dark:text-purple-300 block mb-1">
                  {t('2. 25 Minutes Before the Workout (Pre-Workout Timing):')}
                </strong>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                  {t('Drink 1 scoop of pre-workout (C4 / Psychotic / Curse) in 200ml of cold water. Take it at least 1.5 hours after a meal so blood flows to the muscles and you get the maximum pump.')}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                {t('3. Right After the Workout (Anabolic Window - Golden Time):')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {t('Within 20-30 min of the workout, shake 1 scoop of {gainer} {creatine} with cold water and drink it straight away. This stops muscle breakdown right away.', { gainer: gainerName, creatine: takingCreatine ? '+ 5g Creatine Monohydrate' : '' })}
              </p>
            </div>

            {takingCreatine && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <strong className="text-blue-700 dark:text-blue-300 block mb-1">
                  {t('4. Creatine 5g Rule:')}
                </strong>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                  {t('Take 5 grams of creatine every day, rest day or gym day. On rest days, dissolve it in water after breakfast. No loading phase is needed.')}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Diet Adjustment to Prevent Belly Fat */}
        <Card className="p-5 border-t-4 border-t-rose-500 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400" />
            {t('What Should Your Diet Be With a Gainer? (No Belly Fat)')}
          </h3>

          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-900 dark:text-rose-300">
            <strong className="block font-bold mb-1">⚠️ {t('The Biggest Mistake Pakistani Lifters Make:')}</strong>
            <strong>{t('The gainer already has {calories} calories.', { calories: gainerCalories })}</strong>{' '}
            {t('If you also eat oily, ghee-heavy curries, parathas and sweets at home, your surplus goes past 3500+ and instead of muscle you will gain belly and side fat!')}
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">{t('Take Only Clean Calories From Food:')}</strong>
              {t('From the rest of the day\'s meals you only need {calories} kcal and {protein}g protein.', { calories: foodCaloriesNeeded, protein: foodProteinNeeded })}{' '}
              {t('Eat plain roti, boiled rice, and add eggs/chicken.')}
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">{t('Water Target ({liters} Liters):', { liters: macros.waterLiters })}</strong>
              {t('Creatine and a mass gainer both pull water into the muscles. If you drink too little, your digestion suffers and you can get acne/pimples. At least {liters} liters of water a day is a must!', { liters: macros.waterLiters })}
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">{t('15 Minutes of Cardio 1-2 Days a Week:')}</strong>
              {t('Do a 10-15 minute incline walk on the treadmill to keep your heart strong and stop extra calories being stored as fat.')}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
