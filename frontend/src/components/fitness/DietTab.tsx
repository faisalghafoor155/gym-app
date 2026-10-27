import { Flame, Droplets, Scale, Sparkles, Info, Package, ChevronRight } from 'lucide-react';
import { Card, FieldLabel, inputClass } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { Gender, Goal, DietPreference, MacroResult, GainerProfile, CalcTab } from './data';

interface DietTabProps {
  gender: Gender;
  setGender: React.Dispatch<React.SetStateAction<Gender>>;
  weightKg: number;
  setWeightKg: React.Dispatch<React.SetStateAction<number>>;
  heightCm: number;
  setHeightCm: React.Dispatch<React.SetStateAction<number>>;
  age: number;
  setAge: React.Dispatch<React.SetStateAction<number>>;
  activityLevel: number;
  setActivityLevel: React.Dispatch<React.SetStateAction<number>>;
  goal: Goal;
  setGoal: React.Dispatch<React.SetStateAction<Goal>>;
  dietPreference: DietPreference;
  setDietPreference: React.Dispatch<React.SetStateAction<DietPreference>>;
  selectedGainer: string;
  setSelectedGainer: React.Dispatch<React.SetStateAction<string>>;
  gainerServing: 'half' | 'full';
  takingCreatine: boolean;
  genderMaleId: string;
  genderFemaleId: string;
  weightInputId: string;
  heightInputId: string;
  ageInputId: string;
  activityInputId: string;
  goalInputId: string;
  dietPrefId: string;
  gainerSelectId: string;
  macros: MacroResult;
  gainer: GainerProfile;
  gainerCalories: number;
  gainerProtein: number;
  foodCaloriesNeeded: number;
  foodProteinNeeded: number;
  setTab: React.Dispatch<React.SetStateAction<CalcTab>>;
}

export default function DietTab({
  gender,
  setGender,
  weightKg,
  setWeightKg,
  heightCm,
  setHeightCm,
  age,
  setAge,
  activityLevel,
  setActivityLevel,
  goal,
  setGoal,
  dietPreference,
  setDietPreference,
  selectedGainer,
  setSelectedGainer,
  gainerServing,
  takingCreatine,
  genderMaleId,
  genderFemaleId,
  weightInputId,
  heightInputId,
  ageInputId,
  activityInputId,
  goalInputId,
  dietPrefId,
  gainerSelectId,
  macros,
  gainer,
  gainerCalories,
  gainerProtein,
  foodCaloriesNeeded,
  foodProteinNeeded,
  setTab,
}: DietTabProps) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Input Form Panel */}
      <Card className="p-5 sm:p-6 lg:col-span-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
          <Scale size={18} className="text-blue-600 dark:text-blue-400" />
          {t('Body Profile & Goals')}
        </h2>

        {/* Gender selector */}
        <div>
          <FieldLabel>{t('Gender')}</FieldLabel>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Gender')}>
            <label
              htmlFor={genderMaleId}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold cursor-pointer transition ${
                gender === 'male'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/50'
                  : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-300'
              }`}
            >
              <input
                id={genderMaleId}
                type="radio"
                name="gender"
                value="male"
                checked={gender === 'male'}
                onChange={() => setGender('male')}
                className="sr-only"
              />
              <span>👨 {t('Male')}</span>
            </label>
            <label
              htmlFor={genderFemaleId}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold cursor-pointer transition ${
                gender === 'female'
                  ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/50'
                  : 'border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-300'
              }`}
            >
              <input
                id={genderFemaleId}
                type="radio"
                name="gender"
                value="female"
                checked={gender === 'female'}
                onChange={() => setGender('female')}
                className="sr-only"
              />
              <span>👩 {t('Female')}</span>
            </label>
          </div>
        </div>

        {/* Weight, Height, Age */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel htmlFor={weightInputId}>{t('Weight (kg)')}</FieldLabel>
            <input
              id={weightInputId}
              type="number"
              min="30"
              max="250"
              step="0.5"
              value={weightKg}
              onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor={heightInputId}>{t('Height (cm)')}</FieldLabel>
            <input
              id={heightInputId}
              type="number"
              min="100"
              max="230"
              value={heightCm}
              onChange={e => setHeightCm(parseInt(e.target.value, 10) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor={ageInputId}>{t('Age')}</FieldLabel>
            <input
              id={ageInputId}
              type="number"
              min="12"
              max="90"
              value={age}
              onChange={e => setAge(parseInt(e.target.value, 10) || 0)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Activity Level */}
        <div>
          <FieldLabel htmlFor={activityInputId}>{t('Gym & Daily Activity Level')}</FieldLabel>
          <select
            id={activityInputId}
            value={activityLevel}
            onChange={e => setActivityLevel(parseFloat(e.target.value))}
            className={inputClass}
          >
            <option value={1.2}>{t('Sedentary (Little or no workout, desk job)')}</option>
            <option value={1.375}>{t('Lightly Active (Gym 1-3 days / week)')}</option>
            <option value={1.55}>{t('Moderately Active (Gym 3-5 days / week)')}</option>
            <option value={1.725}>{t('Very Active (Hard training 6-7 days / week)')}</option>
            <option value={1.9}>{t('Extra Active (Heavy physical job + daily lifting)')}</option>
          </select>
        </div>

        {/* Goal */}
        <div>
          <FieldLabel htmlFor={goalInputId}>{t('Primary Fitness Goal')}</FieldLabel>
          <select
            id={goalInputId}
            value={goal}
            onChange={e => setGoal(e.target.value as typeof goal)}
            className={inputClass}
          >
            <option value="bulk_lean">{t('Lean Muscle Gain / Hypertrophy (+300 kcal, High Protein)')}</option>
            <option value="bulk_aggressive">{t('Mass Bulking (+500 kcal surplus)')}</option>
            <option value="maintenance">{t('Body Recomposition / Maintenance (TDEE)')}</option>
            <option value="cut_moderate">{t('Fat Loss / Cutting (-300 kcal, High Protein)')}</option>
            <option value="cut_aggressive">{t('Aggressive Fat Loss (-500 kcal, Very High Protein)')}</option>
          </select>
        </div>

        {/* Supplement Selection in Calc */}
        <div>
          <FieldLabel htmlFor={gainerSelectId}>{t('Supplement / Mass Gainer Used')}</FieldLabel>
          <select
            id={gainerSelectId}
            value={selectedGainer}
            onChange={e => setSelectedGainer(e.target.value)}
            className={inputClass}
          >
            <option value="none">{t('None (Natural Food Only)')}</option>
            <option value="anabolic_mass">Kevin Levrone Anabolic Mass (1070 kcal, 48g Protein)</option>
            <option value="serious_mass">ON Serious Mass (1250 kcal, 50g Protein)</option>
            <option value="carnivor_mass">MuscleMeds Carnivor Beef Mass (720 kcal, 50g Protein)</option>
            <option value="super_mass">Dymatize Super Mass Gainer (1280 kcal, 52g Protein)</option>
            <option value="whey_gold">Whey Gold Standard / Isolate (120 kcal, 24g Protein)</option>
          </select>
        </div>

        {/* Diet Preference */}
        <div>
          <FieldLabel htmlFor={dietPrefId}>{t('Food & Diet Preference')}</FieldLabel>
          <select
            id={dietPrefId}
            value={dietPreference}
            onChange={e => setDietPreference(e.target.value as typeof dietPreference)}
            className={inputClass}
          >
            <option value="pakistani_desi">{t('Pakistani / Desi Home Foods (Roti, Chawal, Chicken, Anday)')}</option>
            <option value="budget_friendly">{t('Budget / Student Friendly (Eggs, Milk, Dahi, Daal, Peanut Butter)')}</option>
            <option value="high_protein_bodybuilding">{t('Clean Pro Bodybuilding (Chicken Breast, Oats, Whey, Egg Whites)')}</option>
            <option value="vegetarian">{t('Vegetarian / Shakahari (Paneer, Soya, Dahi, Daalein)')}</option>
          </select>
        </div>

        {/* Quick Weight-Protein Info Note */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-semibold">{t('Automatic Weight-Based Rule:')}</p>
            <p className="mt-0.5 text-blue-800 dark:text-blue-300">
              {t('Based on your {weight} kg body weight, protein is calculated at', { weight: weightKg })}{' '}
              <strong>{macros.proteinRatio}g/kg</strong>{' '}
              {t('({total}g total). The maths is automatic and 100% accurate.', { total: macros.proteinGrams })}
            </p>
          </div>
        </div>
      </Card>

      {/* Results Output Panel */}
      <div className="lg:col-span-7 space-y-4">
        {/* Highlight Target Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-100">
                {t('Total Daily Calorie Target')}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl sm:text-5xl font-black tracking-tight">
                  {macros.targetCalories.toLocaleString()}
                </span>
                <span className="text-lg font-bold text-blue-200">{t('kcal / day')}</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
              <Flame size={28} className="text-amber-300" />
            </div>
          </div>

          {/* Breakdown with Gainer */}
          {selectedGainer !== 'none' && (
            <div className="mt-4 p-3 rounded-xl bg-white/10 border border-white/20 text-xs flex items-center justify-between">
              <div>
                <span className="text-blue-200 block text-[11px]">{t('Selected Supplement Contribution:')}</span>
                <strong className="text-white font-bold">{t(gainer.name)} ({gainerServing === 'half' ? t('Half Serving / 1-2 Scoops') : t('Full Serving')})</strong>
              </div>
              <div className="text-right">
                <span className="text-amber-300 font-bold block">{gainerCalories} kcal</span>
                <span className="text-rose-200 font-bold">{gainerProtein}g Protein</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20 text-center">
            <div>
              <p className="text-xs text-blue-100">{t('Calories From Food')}</p>
              <p className="text-lg font-bold mt-0.5">{foodCaloriesNeeded} <span className="text-xs font-normal">kcal</span></p>
            </div>
            <div>
              <p className="text-xs text-blue-100">{t('Protein From Food')}</p>
              <p className="text-lg font-bold mt-0.5">{foodProteinNeeded} <span className="text-xs font-normal">g</span></p>
            </div>
            <div>
              <p className="text-xs text-blue-100">{t('Water Target')}</p>
              <p className="text-lg font-bold mt-0.5">{macros.waterLiters} <span className="text-xs font-normal">{t('Liters')}</span></p>
            </div>
          </div>
        </div>

        {/* Macros Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Protein */}
          <Card className="p-4 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{t('🥩 Total Protein')}</span>
              <span>{Math.round((macros.proteinCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.proteinGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{t('grams')}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.proteinCalories} kcal {t('({ratio}g per kg BW)', { ratio: macros.proteinRatio })}
            </p>
          </Card>

          {/* Carbohydrates */}
          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t('🍚 Total Carbs')}</span>
              <span>{Math.round((macros.carbsCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.carbsGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{t('grams')}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.carbsCalories} kcal {t('(Energy for heavy gym sets)')}
            </p>
          </Card>

          {/* Fats */}
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t('🥑 Healthy Fats')}</span>
              <span>{Math.round((macros.fatCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.fatGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{t('grams')}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.fatCalories} kcal {t('(Hormones & joints)')}
            </p>
          </Card>
        </div>

        {/* Dedicated Water Intake Card */}
        <Card className="p-5 border-l-4 border-l-cyan-500 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Droplets size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{t('Daily Water Intake Target')}</span>
                  <span className="text-xs bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 px-2.5 py-0.5 rounded-full font-bold">
                    {t('{count} Glasses', { count: macros.waterGlasses })}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {t('Based on bodyweight {weight} kg {creatine} {gainer}', { weight: weightKg, creatine: takingCreatine ? '+ Creatine 5g' : '', gainer: selectedGainer !== 'none' ? '+ Mass Gainer' : '' })}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-1 sm:text-right">
              <span className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{macros.waterLiters}</span>
              <span className="text-sm font-bold text-gray-500 dark:text-slate-400">{t('Liters / day')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t('On Waking Up')}</span>
              <strong className="text-gray-800 dark:text-slate-200">{t('2 Glasses (500ml)')}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t('Pre-Workout')}</span>
              <strong className="text-gray-800 dark:text-slate-200">{t('2 Glasses (500ml)')}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t('During the Gym')}</span>
              <strong className="text-gray-800 dark:text-slate-200">{t('3-4 Glasses (Sip-by-sip)')}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">{t('Post-Workout & Day')}</span>
              <strong className="text-gray-800 dark:text-slate-200">{t('8-10 Glasses')}</strong>
            </div>
          </div>
        </Card>

        {/* Mass Gainer & Preworkout Direct Button */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Package size={24} className="text-white" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1">
                <Sparkles size={13} /> {t('Mass Gainer & Pre-Workout Protocol')}
              </span>
              <p className="text-sm font-bold mt-0.5">
                {t('How many exercises and what diet should go with Anabolic Mass, Serious Mass or Carnivor?')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab('supplements_routine')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-orange-700 hover:bg-orange-50 transition flex items-center gap-1.5 shrink-0 shadow"
          >
            <span>{t('Check Gainer Stack')}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
