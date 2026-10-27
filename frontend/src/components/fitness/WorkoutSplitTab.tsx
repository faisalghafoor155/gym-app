import { Dumbbell, Award, Activity, CheckCircle2, ChevronRight, Calendar, Layers, Compass, Image as ImageIcon } from 'lucide-react';
import { Card, FieldLabel, inputClass } from '../ui';
import { WORKOUT_SPLIT_DAYS, type Muscle, type MacroResult, type OneRmResult } from './data';
import { WORKOUT_GAMES_PHOTOS } from './ExercisePhotoModal';
import { useLanguage } from '../../context/LanguageContext';

interface WorkoutSplitTabProps {
  exercise: string;
  setExercise: React.Dispatch<React.SetStateAction<string>>;
  liftWeight: number;
  setLiftWeight: React.Dispatch<React.SetStateAction<number>>;
  liftReps: number;
  setLiftReps: React.Dispatch<React.SetStateAction<number>>;
  setShowAngleModal: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAngleExercise: React.Dispatch<React.SetStateAction<string>>;
  setSelectedAngleMuscle: React.Dispatch<React.SetStateAction<Muscle>>;
  setShowPhotoModal: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedPhotoExercise: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPhotoMuscle: React.Dispatch<React.SetStateAction<Muscle>>;
  exerciseSelectId: string;
  liftWeightInputId: string;
  liftRepsInputId: string;
  macros: MacroResult;
  oneRm: OneRmResult;
  selectedPhotoMuscle: Muscle;
  selectedPhotoExercise: string;
}

export default function WorkoutSplitTab({
  selectedPhotoExercise,
  selectedPhotoMuscle,
  exercise,
  setExercise,
  liftWeight,
  setLiftWeight,
  liftReps,
  setLiftReps,
  setShowAngleModal,
  setSelectedAngleExercise,
  setSelectedAngleMuscle,
  setShowPhotoModal,
  setSelectedPhotoExercise,
  setSelectedPhotoMuscle,
  exerciseSelectId,
  liftWeightInputId,
  liftRepsInputId,
  macros,
  oneRm,
}: WorkoutSplitTabProps) {
  const { lang, t } = useLanguage();
  return (
    <div className="space-y-6">
      {/* Top Split Header */}
      <Card className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border-blue-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400">
              <Dumbbell size={28} />
            </div>
            <div>
              <span className="text-xs text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers size={14} /> {t('5-Day Hypertrophy & Mass Split Routine')}
              </span>
              <h2 className="text-xl font-black mt-1">
                {t('How Much Workout & How Many Exercises?')}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {t('If you are taking a Mass Gainer (Anabolic/Serious Mass), Pre-Workout and Creatine, your body gets plenty of protein and energy. To turn that energy into muscle, follow the 5-day workout split below:')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedPhotoMuscle('chest');
                setSelectedPhotoExercise('flat_bench');
                setShowPhotoModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <ImageIcon size={16} />
              <span>{t('🖼️ See Photos of All Exercises')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedAngleMuscle('chest');
                setSelectedAngleExercise('incline_bench_press');
                setShowAngleModal(true);
              }}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition flex items-center gap-1.5 border border-white/15"
            >
              <Compass size={14} />
              <span>{t('Angles Guide')}</span>
            </button>
            <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="text-[10px] text-blue-200 uppercase block font-semibold">{t('Volume Standard')}</span>
              <span className="text-sm font-black text-white">{t('5 Exercises · 16-18 Sets/Day')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* INTERACTIVE WORKOUT GAME PHOTO VIEWER (Instant picture on click) */}
      <Card className="p-4 sm:p-5 border-t-4 border-t-blue-600 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ImageIcon size={19} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <span>{t('🖼️ Pick an Exercise — Real Photo & How to Do It')}</span>
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                {t('Click any exercise to instantly see its real photo and correct form!')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 shrink-0 self-start sm:self-auto"
          >
            <span>{t('Full-Screen Gallery')}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Muscle Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
          {(
            [
              { key: 'chest', label: '🔥 Chest' },
              { key: 'back', label: '🛡️ Back' },
              { key: 'shoulders', label: '⚡ Shoulders' },
              { key: 'legs', label: '🦵 Legs' },
              { key: 'arms', label: '💪 Arms' },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSelectedPhotoMuscle(tab.key);
                const firstInMuscle = WORKOUT_GAMES_PHOTOS.find(e => e.muscle === tab.key);
                if (firstInMuscle) setSelectedPhotoExercise(firstInMuscle.id);
              }}
              className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition text-center ${
                selectedPhotoMuscle === tab.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

        {/* Exercise Selector Pills for Active Muscle */}
        <div className="flex flex-wrap gap-1.5">
          {WORKOUT_GAMES_PHOTOS.filter(e => e.muscle === selectedPhotoMuscle).map(ex => (
            <button
              key={ex.id}
              type="button"
              onClick={() => setSelectedPhotoExercise(ex.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                selectedPhotoExercise === ex.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-gray-300'
              }`}
            >
              <Dumbbell size={12} className="shrink-0" />
              <span>{t(ex.name)}</span>
            </button>
          ))}
        </div>

        {/* Real Photo & Form Guide Card */}
        {(() => {
          const activePhotoEx = WORKOUT_GAMES_PHOTOS.find(e => e.id === selectedPhotoExercise) || WORKOUT_GAMES_PHOTOS[0]!;
          return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-3.5 rounded-2xl bg-gray-50/80 dark:bg-slate-850 border border-gray-200 dark:border-slate-800 mt-1">
              <div
                className="md:col-span-5 relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md group cursor-pointer"
                onClick={() => setShowPhotoModal(true)}
              >
                <img
                  src={activePhotoEx.image}
                  alt={t(activePhotoEx.name)}
                  className="w-full h-48 sm:h-56 object-cover group-hover:scale-105 transition duration-300 select-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end p-2.5">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <ImageIcon size={13} className="text-blue-400" />
                    <span>{t('Click to see the full-screen photo')}</span>
                  </span>
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {lang === 'ur' ? activePhotoEx.muscleUrdu : activePhotoEx.muscleLabel}
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {t(activePhotoEx.sets)} · {t(activePhotoEx.reps)}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-gray-900 dark:text-slate-100 mt-1">
                    {t(activePhotoEx.name)}
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-slate-300 mt-1 leading-relaxed">
                    <strong>{t('How to Do It:')}</strong> {lang === 'ur' ? activePhotoEx.howToUrdu : activePhotoEx.howTo}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-950 dark:text-emerald-200">
                    <strong className="block text-emerald-700 dark:text-emerald-400 font-bold mb-0.5">{t('✓ Correct Form:')}</strong>
                    {t(activePhotoEx.goodFormTips[0] ?? '')}
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-950 dark:text-rose-200">
                    <strong className="block text-rose-700 dark:text-rose-400 font-bold mb-0.5">{t('✗ Avoid This Mistake:')}</strong>
                    {t(activePhotoEx.mistakesToAvoid[0] ?? '')}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPhotoModal(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-xs"
                  >
                    <ImageIcon size={13} />
                    <span>{t('See Big Photo & Full Form')}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* The 5 Workout Days Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {WORKOUT_SPLIT_DAYS.map((d, idx) => (
          <Card key={idx} className="p-5 border-t-4 border-t-blue-600 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {t(d.tag)}
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm mt-0.5">{t(d.day)}</h3>
                </div>
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                  {t(d.gamesCount)}
                </span>
              </div>

              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                {d.exercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    onClick={() => {
                      if (ex.photoId) {
                        setSelectedPhotoMuscle(ex.photoMuscle || 'chest');
                        setSelectedPhotoExercise(ex.photoId);
                        setShowPhotoModal(true);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-xs border border-transparent hover:border-blue-500/30 hover:bg-blue-50/30 dark:hover:bg-slate-800 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-slate-100">
                      <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{exIdx + 1}. {t(ex.name)}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{ex.sets}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                      <span>{t(ex.tip)}</span>
                      <span>{ex.reps}</span>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400">
                        {ex.reps}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ex.photoId) {
                            setSelectedPhotoMuscle(ex.photoMuscle || 'chest');
                            setSelectedPhotoExercise(ex.photoId);
                            setShowPhotoModal(true);
                          }
                        }}
                        className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-lg transition flex items-center gap-1 shadow-xs"
                      >
                        <ImageIcon size={11} />
                        <span>{t('🖼️ See Photo')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] font-medium text-blue-700 dark:text-blue-300">
              💡 {t(d.intensity)}
            </div>
          </Card>
        ))}

        {/* Rest & Recovery Card */}
        <Card className="p-5 border-t-4 border-t-emerald-500 flex flex-col justify-between bg-emerald-50/20 dark:bg-emerald-500/5">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-2">
              <Calendar size={16} /> {t('Day 6 & 7: Rest & Muscle Growth')}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
              {t('Rest Day Protocol (Recovery)')}
            </h3>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-2 leading-relaxed">
              {t('Muscle breaks down in the gym; it grows when you sleep and eat!')}
            </p>

            <ul className="space-y-2 text-xs text-gray-700 dark:text-slate-300 mt-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{t('Always get 7-8 hours of deep sleep.')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{t('Take 5g of creatine after breakfast on rest days too.')}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{t('Do not cut your protein intake ({protein}g) on rest days either.', { protein: macros.proteinGrams })}</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Interactive 1RM Calculator for Games / Exercises */}
      <Card className="p-5 sm:p-6 space-y-5 border-t-4 border-t-indigo-600">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">
              {t('1RM Strength Calculator (Working Weights for Each Exercise)')}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
            <Activity size={15} />
            <span>{t('BW Ratio: {ratio}x ({level})', { ratio: oneRm.bwRatio, level: t(oneRm.strengthLevel) })}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel htmlFor={exerciseSelectId}>{t('Target Exercise / Lift')}</FieldLabel>
            <select
              id={exerciseSelectId}
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              className={inputClass}
            >
              <option value="bench_press">{t('Flat Barbell Bench Press (Chest)')}</option>
              <option value="squat">{t('Barbell Back Squat (Legs)')}</option>
              <option value="deadlift">{t('Conventional Deadlift (Back)')}</option>
              <option value="overhead_press">{t('Overhead Military Press (Shoulders)')}</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor={liftWeightInputId}>{t('Weight Lifted (kg)')}</FieldLabel>
            <input
              id={liftWeightInputId}
              type="number"
              min="10"
              max="400"
              step="2.5"
              value={liftWeight}
              onChange={e => setLiftWeight(parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor={liftRepsInputId}>{t('Completed Reps (1-12)')}</FieldLabel>
            <input
              id={liftRepsInputId}
              type="number"
              min="1"
              max="12"
              value={liftReps}
              onChange={e => setLiftReps(parseInt(e.target.value, 10) || 1)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Working Sets Output */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
            <div className="flex justify-between items-center text-xs text-rose-700 dark:text-rose-400 font-bold uppercase">
              <span>{t('Power & Strength')}</span>
              <span>85% 1RM</span>
            </div>
            <p className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-1">{oneRm.strengthSet.weight} kg</p>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">{oneRm.strengthSet.reps} {t('(Rest 3 mins)')}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
            <div className="flex justify-between items-center text-xs text-blue-700 dark:text-blue-400 font-bold uppercase">
              <span>{t('Muscle Hypertrophy')}</span>
              <span>72% 1RM</span>
            </div>
            <p className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-1">{oneRm.hypertrophySet.weight} kg</p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">{oneRm.hypertrophySet.reps} {t('(Optimal Size)')}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <div className="flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase">
              <span>{t('Burnout / Pump')}</span>
              <span>55% 1RM</span>
            </div>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{oneRm.enduranceSet.weight} kg</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">{oneRm.enduranceSet.reps} {t('(Fast blood flow)')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
