import { Sparkles, Zap, Bot, Package, Clock, ShieldAlert, Dumbbell as WorkoutIcon } from 'lucide-react';
import { Card, FieldLabel, inputClass } from '../ui';
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
                <Zap size={14} /> Custom Supplement Stack & Diet Adjustment
              </span>
              <h2 className="text-xl font-black mt-1">
                {gainer.name} Stack Guide ({weightKg} kg Lifter)
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {gainer.features}
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
              <span>View 5-Day Games Routine</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Gainer Configurator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 space-y-3">
          <FieldLabel>Select Gainer / Protein</FieldLabel>
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
            <option value="none">None (Natural Food Only)</option>
          </select>
          <div className="text-xs text-gray-500 dark:text-slate-400 pt-1">
            <strong>Best for:</strong> {gainer.bestFor}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <FieldLabel>Daily Serving Dose</FieldLabel>
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
              Half Serving (Recommended)
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
              Full Serving (Heavy Bulk)
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Half serving lene se pet par charbi nahi charhti aur dabba b 1 mahina chalta ha.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <FieldLabel>Additional Stacks</FieldLabel>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={takingPreworkout}
                onChange={e => setTakingPreworkout(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>Pre-Workout (C4 / Psychotic / Curse)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={takingCreatine}
                onChange={e => setTakingCreatine(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>Creatine Monohydrate (5g Daily)</span>
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
              Want Live AI Protocol for {gainer.name} Stack?
            </h4>
            <p className="text-[11px] text-purple-700 dark:text-purple-300">
              AI Coach will analyze dosages, digestion safety, and belly-fat prevention specifically for your {weightKg}kg bodyweight.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab('ai_advisor');
            void handleAskAi(undefined, `Mujhe ${gainer.name} ${takingCreatine ? '+ Creatine 5g' : ''} ${takingPreworkout ? '+ Pre-workout' : ''} stack ke sath ${weightKg}kg wazan par pet charbi se bachne aur fast muscle gain ka protocol batayein.`);
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <Sparkles size={14} />
          <span>Ask AI About This Stack</span>
        </button>
      </div>

      {/* Precise Timings & Diet Protocol when taking this stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Timing Protocol */}
        <Card className="p-5 border-t-4 border-t-amber-500 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            Stack Ki Timing & Schedule (Kab Kia Lena Ha)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-amber-700 dark:text-amber-300 block mb-1">
                1. Subah Nashte K 2 Ghantay Baad (11:00 AM):
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                Agar aap {gainer.name} le rahe hain to 1 scoop (half serving) 350ml taaza doodh ya paani me mix kar ke len. Is se body ko dopahar tak continuous amino acids aur calories milti rehti hain.
              </p>
            </div>

            {takingPreworkout && (
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                <strong className="text-purple-700 dark:text-purple-300 block mb-1">
                  2. Workout Se 25 Minute Pehle (Pre-Workout Timing):
                </strong>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                  1 Scoop Pre-workout (C4 / Psychotic / Curse) 200ml thanday paani me piyein. Khana khane ke kam az kam 1.5 ghantay baad lein taake blood flow muscles ki taraf jaye aur maximum pump miley.
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                3. Workout K Foran Baad (Anabolic Window - Golden Time):
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                Workout k 20-30 min k andar 1 Scoop {gainer.name} {takingCreatine ? '+ 5g Creatine Monohydrate' : ''} thanday paani me shaker me shake kar k foran pee lein. Yeh muscle breakdown ko foran roktay hain.
              </p>
            </div>

            {takingCreatine && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <strong className="text-blue-700 dark:text-blue-300 block mb-1">
                  4. Creatine 5g Rule:
                </strong>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                  Creatine rozana 5 gram lena zaroori ha, chahay rest day ho ya gym day. Rest day par nashtay ke baad paani me ghol kar pee lein. Loading phase ki zaroorat nahi.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Diet Adjustment to Prevent Belly Fat */}
        <Card className="p-5 border-t-4 border-t-rose-500 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400" />
            Gainer K Sath Diet Kesi Honi Chaiye? (Pet Na Nikle)
          </h3>

          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-900 dark:text-rose-300">
            <strong className="block font-bold mb-1">⚠️ Sab Se Badi Galti Jo Pakistani Lifters Kartay Hain:</strong>
            Gainer me pehle hi <strong>{gainerCalories} calories</strong> mojood hain. Agar aap iske sath ghar ka tail/ghee se bhara salan, parathay aur meetha b khayenge to surplus 3500+ par chala jayega aur <strong>muscles ke bajaye pet aur side ki charbi</strong> nikal aayegi!
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">Khane Se Sirf Clean Calories Lein:</strong>
              Aap ko baqi din ke khano se sirf <strong>{foodCaloriesNeeded} kcal</strong> aur <strong>{foodProteinNeeded}g protein</strong> lena ha. Roti sukhi khayein, chawal ublay hue lein, aur anday/chicken shamil karein.
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">Water Target ({macros.waterLiters} Liters):</strong>
              Creatine aur Mass Gainer dono muscles me paani pull kartay hain. Agar aap kam paani piyenge to digestion kharab hogi aur acne/pimples b ho saktay hain. Rozana kam az kam {macros.waterLiters} Liter paani laazmi ha!
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-gray-900 dark:text-slate-100 block mb-0.5">Hafte Me 1-2 Din 15 Minute Cardio:</strong>
              Treadmill par 10-15 minute incline walk karein taake dil mazboot rahay aur extra calories fat me store na hon.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
