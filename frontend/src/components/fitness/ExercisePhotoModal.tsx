import { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Dumbbell, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { useLanguage } from '../../context/LanguageContext';

/**
 * The muscle label and the how-to come in both languages (`muscleLabel` /
 * `muscleUrdu`, `howTo` / `howToUrdu`); show the one for the current language.
 * Every other text field is English and doubles as its `t()` key, with the
 * Roman Urdu in i18n/ur/fitness-exercises.ts.
 */
export interface ExercisePhotoItem {
  id: string;
  name: string;
  muscle: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';
  muscleLabel: string;
  muscleUrdu: string;
  targetArea: string;
  image: string;
  sets: string;
  reps: string;
  howTo: string;
  howToUrdu: string;
  goodFormTips: string[];
  mistakesToAvoid: string[];
}

export const WORKOUT_GAMES_PHOTOS: ExercisePhotoItem[] = [
  // CHEST
  {
    id: 'flat_bench',
    name: 'Flat Barbell Bench Press',
    muscle: 'chest',
    muscleLabel: 'Overall Chest Mass',
    muscleUrdu: 'Seena (Overall Chest Mass)',
    targetArea: 'Mid Chest & Overall Thickness',
    image: '/exercises/flat_bench.jpg',
    sets: '4 Sets',
    reps: '6-10 Reps',
    howTo: 'Lie on the bench, lower the bar with control to between the collarbone and the nipple line, and press it up with the strength of your chest.',
    howToUrdu: 'Bench par let kar bar ko collarbone aur nipple ke darmiyan control se layein aur chest ki taqat se oopar dhakelein.',
    goodFormTips: [
      'Keep the elbows tucked in at a 45° angle to the body.',
      'Keep a slight natural arch in the lower back and plant both feet firmly on the floor.',
      'Always lower the barbell slowly with control and squeeze the chest to press it up.',
    ],
    mistakesToAvoid: [
      'Flaring the elbows out to 90°: This can wear down and injure the shoulder rotator cuff.',
      'Dropping the bar fast and bouncing it off the chest.',
      'Lifting the hips off the bench.',
    ],
  },
  {
    id: 'incline_bench',
    name: 'Incline Bench Press (Barbell / Dumbbell)',
    muscle: 'chest',
    muscleLabel: 'Upper Chest',
    muscleUrdu: 'Upper Chest (Seenay ka Oopri Hissa)',
    targetArea: 'Upper Clavicular Chest Shelf',
    image: '/exercises/incline_bench.jpg',
    sets: '3-4 Sets',
    reps: '8-10 Reps',
    howTo: 'Set the bench at a 30° to 45° incline. Lower the weight with control near the collarbone and push with the upper chest.',
    howToUrdu: 'Bench ko 30° se 45° incline par set karein. Wazan ko collarbone ke paas control se niche layein aur upper chest se push karein.',
    goodFormTips: [
      'Keep the bench at only 30° or 45° (2nd/3rd notch) so all the weight lands on the upper chest.',
      'Stretch the chest fully while lowering the dumbbells.',
      'Keep the elbows at 45° so the shoulders take no needless pressure.',
    ],
    mistakesToAvoid: [
      'Setting the bench upright at 60°: The chest switches off and it becomes a shoulder exercise.',
      'Flaring the elbows all the way out.',
    ],
  },
  {
    id: 'dips',
    name: 'Chest Dips (Parallel Bars)',
    muscle: 'chest',
    muscleLabel: 'Lower Chest & Triceps',
    muscleUrdu: 'Nichla Seena aur Triceps',
    targetArea: 'Lower Pec Line',
    image: '/exercises/dips.jpg',
    sets: '3 Sets',
    reps: '10-12 Reps',
    howTo: 'On the parallel bars, lean the body slightly forward and go down so the load lands on the lower chest.',
    howToUrdu: 'Parallel bars par body ko thora aagay jhuka kar (forward lean) niche jayein taake lower chest par load aaye.',
    goodFormTips: [
      'Lean the body forward roughly 30° (Forward lean).',
      'Fold the knees back and cross them to keep the body stable.',
      'Go down slowly to 90° elbow depth and squeeze.',
    ],
    mistakesToAvoid: [
      'Staying completely upright: If the body is 90° upright, all the load goes to the triceps and the chest will not grow.',
      'Going down too deep so the shoulders hurt.',
    ],
  },
  {
    id: 'cable_flyes',
    name: 'Cable Crossover Chest Flyes',
    muscle: 'chest',
    muscleLabel: 'Chest Cleavage (Inner & Outer Pecs)',
    muscleUrdu: 'Seenay ki Lakeer (Inner & Outer Pecs)',
    targetArea: 'Chest Line & Blood Pump',
    image: '/exercises/cable_flyes.jpg',
    sets: '3 Sets',
    reps: '12-15 Reps',
    howTo: 'Hold the handles of both pulleys, bring the hands together in front of the chest and squeeze the chest tight.',
    howToUrdu: 'Dono pulleys ke handles pakar kar seenay ke aagay hath aapas me milayein aur chest ko tight squeeze karein.',
    goodFormTips: [
      'Freeze the elbows with a slight 15° curve, as if hugging a tree.',
      'Squeeze the chest tight for 1 second as the hands meet in front.',
      'Lean slightly forward with one foot forward and one back.',
    ],
    mistakesToAvoid: [
      'Keeping the arms completely straight (locking the elbows).',
      'Jerking with the back to throw the weight forward.',
    ],
  },

  // BACK
  {
    id: 'deadlift',
    name: 'Conventional Barbell Deadlift',
    muscle: 'back',
    muscleLabel: 'Back & Spine (Back Thickness & Power)',
    muscleUrdu: 'Peeth aur Spine (Back Thickness & Power)',
    targetArea: 'Overall Back, Spinal Erectors, Traps & Glutes',
    image: '/exercises/deadlift.jpg',
    sets: '4 Sets',
    reps: '5-6 Reps (Heavy)',
    howTo: 'Stand right next to the barbell, keep the back straight and the chest up, and lift the weight by pushing the floor away with your feet.',
    howToUrdu: 'Barbell ke bilkul qareeb kharay ho kar kamar seedhi rakhein, chest oopar, aur paon se zameen push kar ke wazan uthayein.',
    goodFormTips: [
      'The back (spine) must be completely straight and flat, never rounded.',
      'The barbell should always travel up close against the shins and thighs.',
      'Lock the hips at the top; there is no need to lean back further.',
    ],
    mistakesToAvoid: [
      'Rounding the back (cat back): This is the most dangerous mistake and can cause a slipped disc!',
      'Lifting the bar while holding it away from the body.',
    ],
  },
  {
    id: 'lat_pulldown',
    name: 'Wide-Grip Lat Pulldown',
    muscle: 'back',
    muscleLabel: 'Lats (Back Width / V-Taper)',
    muscleUrdu: 'Lats (Peeth ki Choorai / V-Taper)',
    targetArea: 'Upper Lats & V-Shape Width',
    image: '/exercises/lat_pulldown.jpg',
    sets: '4 Sets',
    reps: '8-12 Reps',
    howTo: 'Sit on the machine, take the bar with a wide grip and pull it to the top of the chest (collarbone).',
    howToUrdu: 'Machine par baith kar bar ko wide grip se pakrein aur chest ke oopri hissay (collarbone) tak kheinchein.',
    goodFormTips: [
      'Lean back a slight 15° so the bar targets the lats directly.',
      'Pull the bar down by driving the elbows and squeeze the lats.',
      'Let it stretch fully with control on the way up.',
    ],
    mistakesToAvoid: [
      'Pulling the bar behind the neck - raises the risk of shoulder injury.',
      'Jerking back and forth with the back.',
    ],
  },
  {
    id: 'bent_over_row',
    name: 'Bent-Over Barbell Row',
    muscle: 'back',
    muscleLabel: 'Back Thickness (Mid-Back & Rhomboids)',
    muscleUrdu: 'Peeth ki Motai (Mid-Back & Rhomboids)',
    targetArea: 'Middle Back Density & Thickness',
    image: '/exercises/bent_over_row.jpg',
    sets: '3-4 Sets',
    reps: '8-10 Reps',
    howTo: 'Bend 45° forward at the waist, pull the bar toward the belly button and squeeze both sides of the back together.',
    howToUrdu: 'Kamar 45° aagay jhuka kar bar ko naaf (belly button) ki taraf kheinchein aur back ke dono hisson ko aapas me milayein.',
    goodFormTips: [
      'Bend the knees slightly and push the hips back (hip hinge).',
      'Keep the back flat and the core tight.',
      'Pull the bar with the elbows and hold for 1 second at the top.',
    ],
    mistakesToAvoid: [
      'Lifting the weight with a rounded back.',
      'Standing up too straight.',
    ],
  },

  // SHOULDERS
  {
    id: 'overhead_press',
    name: 'Standing Overhead Military Press',
    muscle: 'shoulders',
    muscleLabel: 'Shoulders (Front Deltoids & Shoulder Power)',
    muscleUrdu: 'Kandhay (Front Deltoids & Shoulder Power)',
    targetArea: 'Overall Shoulder Mass & Overhead Strength',
    image: '/exercises/overhead_press.jpg',
    sets: '4 Sets',
    reps: '6-8 Reps',
    howTo: 'Press the barbell from the upper chest to a lockout straight overhead, and lower it slowly with control to the chin.',
    howToUrdu: 'Barbell ko upper chest se seedha sar ke oopar lockout karein aur aahista control ke sath chin tak niche layein.',
    goodFormTips: [
      'Keep the hips and core tight so the lower back does not lean back.',
      'The barbell should travel overhead in a straight vertical line.',
      'The elbows should be directly under the bar.',
    ],
    mistakesToAvoid: [
      'Bending the lower back too far back (spine injury risk).',
      'Jerking with the knees and turning it into a push press.',
    ],
  },
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    muscle: 'shoulders',
    muscleLabel: 'Side Delts (Shoulder Width / Boulders)',
    muscleUrdu: 'Side Delts (Kandhon ki Choorai / Boulders)',
    targetArea: 'Side Lateral Deltoid Width',
    image: '/exercises/lateral_raise.jpg',
    sets: '4 Sets',
    reps: '12-15 Reps',
    howTo: 'Hold a dumbbell in each hand, raise them out to both sides up to shoulder height and lower them with control.',
    howToUrdu: 'Dono hathon me dumbbells pakar kar dono taraf kandhay ki barabar height tak uthayein aur control se niche layein.',
    goodFormTips: [
      'Instead of raising the dumbbells straight out to the side at 90°, raise them 20° forward (scapular plane).',
      'The elbow should always be level with or slightly above the wrist.',
      'Use a light weight and do more reps so the side delts burn.',
    ],
    mistakesToAvoid: [
      'Lifting a very heavy weight and jerking it up.',
      'Lifting the weight with the traps (neck).',
    ],
  },

  // LEGS
  {
    id: 'barbell_squats',
    name: 'Barbell Back Squats',
    muscle: 'legs',
    muscleLabel: 'Legs (Quads, Hamstrings & Glutes)',
    muscleUrdu: 'Taangein (Quads, Hamstrings & Glutes)',
    targetArea: 'Overall Lower Body Mass & Testosterone Booster',
    image: '/exercises/barbell_squats.jpg',
    sets: '4 Sets',
    reps: '8-10 Reps',
    howTo: 'With the barbell on your upper back, slowly sit down until the thighs are parallel to the floor, then stand back up.',
    howToUrdu: 'Barbell ko upper back par rakh kar aahista niche baithein jab tak thighs zameen ke barabar (parallel) na ho jayein, phir wapis kharay hon.',
    goodFormTips: [
      'Always keep the chest up and the back flat.',
      'On the way down, open the knees outward in the direction of the toes.',
      'The thighs should come down to at least 90°, parallel to the floor.',
    ],
    mistakesToAvoid: [
      'Letting the knees cave inward (knee cave) - risk of ligament injury.',
      'Lifting the heels off the floor.',
      'Doing half squats (quarter squats).',
    ],
  },
  {
    id: 'leg_press',
    name: '45-Degree Leg Press Machine',
    muscle: 'legs',
    muscleLabel: 'Quads & Thighs (Thigh Strength)',
    muscleUrdu: 'Quads & Thighs (Raan ki Mazbooti)',
    targetArea: 'Quad Sweep & Leg Thickness',
    image: '/exercises/leg_press.jpg',
    sets: '4 Sets',
    reps: '10-12 Reps',
    howTo: 'Sit on the machine, place the feet shoulder-width apart on the platform, lower the weight with control and push.',
    howToUrdu: 'Machine par baith kar paon platform par shoulder-width par rakhein aur wazan ko control se niche la kar push karein.',
    goodFormTips: [
      'Keep the lower back and hips pressed firmly into the seat.',
      'Let the knees come down to 90° while lowering the platform.',
      'Always push through the heels and the balls of the feet.',
    ],
    mistakesToAvoid: [
      'Snapping the knees into a hard lockout at the top: This is a very dangerous mistake!',
      'Lifting the hips off the seat.',
    ],
  },

  // ARMS
  {
    id: 'bicep_curl',
    name: 'Standing Barbell / Dumbbell Bicep Curl',
    muscle: 'arms',
    muscleLabel: 'Biceps (Upper Arm)',
    muscleUrdu: 'Biceps (Dola / Baazu ka Oopri Hissa)',
    targetArea: 'Bicep Peak & Arm Thickness',
    image: '/exercises/bicep_curl.jpg',
    sets: '4 Sets',
    reps: '8-12 Reps',
    howTo: 'Keeping the elbows pinned to the body, curl the barbell toward the shoulders and squeeze the bicep for 1 second at the top.',
    howToUrdu: 'Kohniyan body ke sath chipka kar barbell ko shoulder ki taraf curl karein aur oopar bicep ko 1 second squeeze karein.',
    goodFormTips: [
      'Freeze the elbows against the ribs; do not move them back and forth.',
      'Squeeze the bicep fully at the top and control the negative slowly.',
      'Keep the back completely straight and steady.',
    ],
    mistakesToAvoid: [
      'Jerking the back back and forth to lift the weight (ego lifting).',
      'Raising the elbows up into the air.',
    ],
  },
  {
    id: 'tricep_pushdown',
    name: 'Cable Rope Tricep Pushdown',
    muscle: 'arms',
    muscleLabel: 'Triceps (Back of the Arm - 60% of the Arm)',
    muscleUrdu: 'Triceps (Baazu ka Pichla Hissa - Baazu ka 60%)',
    targetArea: 'Tricep Horseshoe & Lateral Head',
    image: '/exercises/tricep_pushdown.jpg',
    sets: '4 Sets',
    reps: '10-12 Reps',
    howTo: 'Hold the rope on the cable machine, push straight down and spread the rope out to both sides at the end.',
    howToUrdu: 'Cable machine par rope pakar kar niche seedha push karein aur aakhri hissay me rope ko dono taraf bahar khol dein.',
    goodFormTips: [
      'The elbows should be frozen at both sides of the body; only the forearms move.',
      'At the bottom, spread the rope out to both sides and squeeze the triceps hard.',
      'On the way back up, let it come to 90° with control.',
    ],
    mistakesToAvoid: [
      'Moving the elbows back and forth.',
      'Pushing the weight down with the shoulders.',
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExerciseId?: string;
  initialMuscle?: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';
}

export default function ExercisePhotoModal({
  isOpen,
  onClose,
  initialExerciseId,
  initialMuscle = 'chest',
}: Props) {
  const { lang, t } = useLanguage();
  const [selectedMuscle, setSelectedMuscle] = useState<'chest' | 'back' | 'shoulders' | 'legs' | 'arms'>(initialMuscle);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    initialExerciseId || 'flat_bench'
  );

  useEffect(() => {
    if (initialExerciseId) {
      setSelectedExerciseId(initialExerciseId);
      const found = WORKOUT_GAMES_PHOTOS.find(e => e.id === initialExerciseId);
      if (found) {
        setSelectedMuscle(found.muscle);
      }
    } else if (initialMuscle) {
      setSelectedMuscle(initialMuscle);
      const firstInMuscle = WORKOUT_GAMES_PHOTOS.find(e => e.muscle === initialMuscle);
      if (firstInMuscle) setSelectedExerciseId(firstInMuscle.id);
    }
  }, [initialExerciseId, initialMuscle, isOpen]);

  const filteredExercises = WORKOUT_GAMES_PHOTOS.filter(e => e.muscle === selectedMuscle);
  const activeExercise =
    WORKOUT_GAMES_PHOTOS.find(e => e.id === selectedExerciseId) ||
    filteredExercises[0] ||
    WORKOUT_GAMES_PHOTOS[0]!;

  const handleMuscleChange = (muscle: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms') => {
    setSelectedMuscle(muscle);
    const firstInMuscle = WORKOUT_GAMES_PHOTOS.find(e => e.muscle === muscle);
    if (firstInMuscle) setSelectedExerciseId(firstInMuscle.id);
  };

  const handleNext = () => {
    const currentIndex = WORKOUT_GAMES_PHOTOS.findIndex(e => e.id === activeExercise.id);
    const nextIndex = (currentIndex + 1) % WORKOUT_GAMES_PHOTOS.length;
    const nextExercise = WORKOUT_GAMES_PHOTOS[nextIndex]!;
    setSelectedMuscle(nextExercise.muscle);
    setSelectedExerciseId(nextExercise.id);
  };

  const handlePrev = () => {
    const currentIndex = WORKOUT_GAMES_PHOTOS.findIndex(e => e.id === activeExercise.id);
    const prevIndex = (currentIndex - 1 + WORKOUT_GAMES_PHOTOS.length) % WORKOUT_GAMES_PHOTOS.length;
    const prevExercise = WORKOUT_GAMES_PHOTOS[prevIndex]!;
    setSelectedMuscle(prevExercise.muscle);
    setSelectedExerciseId(prevExercise.id);
  };

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[94dvh] flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 id="photo-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>{t('Workout Game Photo & Form Guide')}</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {lang === 'ur' ? activeExercise.muscleUrdu : activeExercise.muscleLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {t('The real exercise photo and an easy way to do it')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Top Muscle Group Selector */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
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
                onClick={() => handleMuscleChange(tab.key)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition text-center ${
                  selectedMuscle === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          {/* Exercise Quick Pills in this Muscle */}
          <div className="flex flex-wrap gap-1.5">
            {filteredExercises.map(ex => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedExerciseId(ex.id)}
                className={`py-1 px-3 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                  selectedExerciseId === ex.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-gray-300'
                }`}
              >
                <Dumbbell size={12} className="shrink-0" />
                <span>{t(ex.name)}</span>
              </button>
            ))}
          </div>

          {/* MAIN PHOTO DISPLAY CARD */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-xl group">
            {/* The Exercise Photo */}
            <img
              src={activeExercise.image}
              alt={t(activeExercise.name)}
              className="w-full h-auto object-cover max-h-[380px] sm:max-h-[440px] mx-auto select-none"
              loading="eager"
            />

            {/* Photo Overlay Badges */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 shadow-md">
              <span className="text-blue-400 font-extrabold uppercase mr-1.5">{t('Game:')}</span>
              <span>{t(activeExercise.name)}</span>
            </div>

            <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5">
              <span>{t(activeExercise.sets)} · {t(activeExercise.reps)}</span>
            </div>

            {/* Next / Previous Overlay Arrows */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label={t('Previous Exercise')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label={t('Next Exercise')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
            >
              <ChevronRight size={22} />
            </button>

            <div className="absolute bottom-2 right-3 text-[11px] text-slate-300 bg-black/70 px-2.5 py-1 rounded-md backdrop-blur-xs">
              {t('Target: {area}', { area: t(activeExercise.targetArea) })}
            </div>
          </div>

          {/* HOW TO PERFORM GUIDE */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-950 dark:text-blue-200 space-y-1">
            <strong className="block font-black text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
              {t('How to Do It (Simple Instructions):')}
            </strong>
            <p className="leading-relaxed font-medium">
              {lang === 'ur' ? activeExercise.howToUrdu : activeExercise.howTo}
            </p>
          </div>

          {/* Sahi vs Ghalat Form Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Sahi Form */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-950 dark:text-emerald-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide border-b border-emerald-500/20 pb-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t('Correct Form ✅')}</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.goodFormTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-black shrink-0">✓</span>
                    <span>{t(tip)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ghalat Form */}
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-950 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide border-b border-rose-500/20 pb-1.5">
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{t('Mistakes (Avoid These ❌)')}</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.mistakesToAvoid.map((mistake, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-600 font-black shrink-0">✗</span>
                    <span>{t(mistake)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer with Quick Switch and Close */}
        <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-900/80 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold hover:bg-gray-100 transition flex items-center gap-1 text-gray-700 dark:text-slate-300"
            >
              <ChevronLeft size={14} />
              <span>{t('Previous Game')}</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold hover:bg-gray-100 transition flex items-center gap-1 text-gray-700 dark:text-slate-300"
            >
              <span>{t('Next Game')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            {t('Close Photo')}
          </button>
        </div>
      </div>
    </div>
  );
}
