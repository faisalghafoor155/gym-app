import { Flame, Droplets, Scale, Sparkles, Info, Package, ChevronRight } from 'lucide-react';
import { Card, FieldLabel, inputClass } from '../ui';
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Input Form Panel */}
      <Card className="p-5 sm:p-6 lg:col-span-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
          <Scale size={18} className="text-blue-600 dark:text-blue-400" />
          Body Profile & Goals
        </h2>

        {/* Gender selector */}
        <div>
          <FieldLabel>Gender</FieldLabel>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gender">
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
              <span>👨 Male</span>
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
              <span>👩 Female</span>
            </label>
          </div>
        </div>

        {/* Weight, Height, Age */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel htmlFor={weightInputId}>Weight (kg)</FieldLabel>
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
            <FieldLabel htmlFor={heightInputId}>Height (cm)</FieldLabel>
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
            <FieldLabel htmlFor={ageInputId}>Age</FieldLabel>
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
          <FieldLabel htmlFor={activityInputId}>Gym & Daily Activity Level</FieldLabel>
          <select
            id={activityInputId}
            value={activityLevel}
            onChange={e => setActivityLevel(parseFloat(e.target.value))}
            className={inputClass}
          >
            <option value={1.2}>Sedentary (Little or no workout, desk job)</option>
            <option value={1.375}>Lightly Active (Gym 1-3 days / week)</option>
            <option value={1.55}>Moderately Active (Gym 3-5 days / week)</option>
            <option value={1.725}>Very Active (Hard training 6-7 days / week)</option>
            <option value={1.9}>Extra Active (Heavy physical job + daily lifting)</option>
          </select>
        </div>

        {/* Goal */}
        <div>
          <FieldLabel htmlFor={goalInputId}>Primary Fitness Goal</FieldLabel>
          <select
            id={goalInputId}
            value={goal}
            onChange={e => setGoal(e.target.value as typeof goal)}
            className={inputClass}
          >
            <option value="bulk_lean">Lean Muscle Gain / Hypertrophy (+300 kcal, High Protein)</option>
            <option value="bulk_aggressive">Mass Bulking (+500 kcal surplus)</option>
            <option value="maintenance">Body Recomposition / Maintenance (TDEE)</option>
            <option value="cut_moderate">Fat Loss / Cutting (-300 kcal, High Protein)</option>
            <option value="cut_aggressive">Aggressive Fat Loss (-500 kcal, Very High Protein)</option>
          </select>
        </div>

        {/* Supplement Selection in Calc */}
        <div>
          <FieldLabel htmlFor={gainerSelectId}>Supplement / Mass Gainer Used</FieldLabel>
          <select
            id={gainerSelectId}
            value={selectedGainer}
            onChange={e => setSelectedGainer(e.target.value)}
            className={inputClass}
          >
            <option value="none">None (Natural Food Only)</option>
            <option value="anabolic_mass">Kevin Levrone Anabolic Mass (1070 kcal, 48g Protein)</option>
            <option value="serious_mass">ON Serious Mass (1250 kcal, 50g Protein)</option>
            <option value="carnivor_mass">MuscleMeds Carnivor Beef Mass (720 kcal, 50g Protein)</option>
            <option value="super_mass">Dymatize Super Mass Gainer (1280 kcal, 52g Protein)</option>
            <option value="whey_gold">Whey Gold Standard / Isolate (120 kcal, 24g Protein)</option>
          </select>
        </div>

        {/* Diet Preference */}
        <div>
          <FieldLabel htmlFor={dietPrefId}>Food & Diet Preference</FieldLabel>
          <select
            id={dietPrefId}
            value={dietPreference}
            onChange={e => setDietPreference(e.target.value as typeof dietPreference)}
            className={inputClass}
          >
            <option value="pakistani_desi">Pakistani / Desi Home Foods (Roti, Chawal, Chicken, Anday)</option>
            <option value="budget_friendly">Budget / Student Friendly (Eggs, Milk, Dahi, Daal, Peanut Butter)</option>
            <option value="high_protein_bodybuilding">Clean Pro Bodybuilding (Chicken Breast, Oats, Whey, Egg Whites)</option>
            <option value="vegetarian">Vegetarian / Shakahari (Paneer, Soya, Dahi, Daalein)</option>
          </select>
        </div>

        {/* Quick Weight-Protein Info Note */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-semibold">Automatic Weight-Based Rule:</p>
            <p className="mt-0.5 text-blue-800 dark:text-blue-300">
              Aap ke {weightKg} kg wazan ke mutabiq <strong>{macros.proteinRatio}g/kg</strong> protein multiply kiya gaya ha ({macros.proteinGrams}g total). Math automatic aur 100% accurate ha.
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
                Total Daily Calorie Target
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl sm:text-5xl font-black tracking-tight">
                  {macros.targetCalories.toLocaleString()}
                </span>
                <span className="text-lg font-bold text-blue-200">kcal / day</span>
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
                <span className="text-blue-200 block text-[11px]">Selected Supplement Contribution:</span>
                <strong className="text-white font-bold">{gainer.name} ({gainerServing === 'half' ? 'Half Serving / 1-2 Scoops' : 'Full Serving'})</strong>
              </div>
              <div className="text-right">
                <span className="text-amber-300 font-bold block">{gainerCalories} kcal</span>
                <span className="text-rose-200 font-bold">{gainerProtein}g Protein</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20 text-center">
            <div>
              <p className="text-xs text-blue-100">Khane Se Calories</p>
              <p className="text-lg font-bold mt-0.5">{foodCaloriesNeeded} <span className="text-xs font-normal">kcal</span></p>
            </div>
            <div>
              <p className="text-xs text-blue-100">Khane Se Protein</p>
              <p className="text-lg font-bold mt-0.5">{foodProteinNeeded} <span className="text-xs font-normal">g</span></p>
            </div>
            <div>
              <p className="text-xs text-blue-100">Water Target</p>
              <p className="text-lg font-bold mt-0.5">{macros.waterLiters} <span className="text-xs font-normal">Liters</span></p>
            </div>
          </div>
        </div>

        {/* Macros Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Protein */}
          <Card className="p-4 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">🥩 Total Protein</span>
              <span>{Math.round((macros.proteinCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.proteinGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">grams</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.proteinCalories} kcal ({macros.proteinRatio}g per kg BW)
            </p>
          </Card>

          {/* Carbohydrates */}
          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">🍚 Total Carbs</span>
              <span>{Math.round((macros.carbsCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.carbsGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">grams</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.carbsCalories} kcal (Energy for heavy gym sets)
            </p>
          </Card>

          {/* Fats */}
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">🥑 Healthy Fats</span>
              <span>{Math.round((macros.fatCalories / macros.targetCalories) * 100)}%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900 dark:text-slate-100">{macros.fatGrams}</span>
              <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">grams</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {macros.fatCalories} kcal (Hormones & joints)
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
                  <span>Daily Water Intake Target</span>
                  <span className="text-xs bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 px-2.5 py-0.5 rounded-full font-bold">
                    {macros.waterGlasses} Glasses
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Bodyweight {weightKg} kg {takingCreatine ? '+ Creatine 5g' : ''} {selectedGainer !== 'none' ? '+ Mass Gainer' : ''} ke hisaab se
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-1 sm:text-right">
              <span className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{macros.waterLiters}</span>
              <span className="text-sm font-bold text-gray-500 dark:text-slate-400">Liters / din</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Subah Uth Kar</span>
              <strong className="text-gray-800 dark:text-slate-200">2 Glasses (500ml)</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Pre-Workout</span>
              <strong className="text-gray-800 dark:text-slate-200">2 Glasses (500ml)</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Gym K Dauran</span>
              <strong className="text-gray-800 dark:text-slate-200">3-4 Glasses (Sip-by-sip)</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
              <span className="text-[10px] text-gray-400 block font-semibold uppercase">Post-Workout & Day</span>
              <strong className="text-gray-800 dark:text-slate-200">8-10 Glasses</strong>
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
                <Sparkles size={13} /> Mass Gainer & Pre-Workout Protocol
              </span>
              <p className="text-sm font-bold mt-0.5">
                Anabolic Mass, Serious Mass ya Carnivor ke sath kitni games aur kia diet honi chahiye?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab('supplements_routine')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-orange-700 hover:bg-orange-50 transition flex items-center gap-1.5 shrink-0 shadow"
          >
            <span>Check Gainer Stack</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
