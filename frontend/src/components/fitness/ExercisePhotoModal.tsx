import { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Dumbbell, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

export interface ExercisePhotoItem {
  id: string;
  name: string;
  muscle: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';
  muscleUrdu: string;
  targetArea: string;
  image: string;
  sets: string;
  reps: string;
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
    muscleUrdu: 'Seena (Overall Chest Mass)',
    targetArea: 'Darmiyani Seena & Overall Motai',
    image: '/exercises/flat_bench.jpg',
    sets: '4 Sets',
    reps: '6-10 Reps',
    howToUrdu: 'Bench par let kar bar ko collarbone aur nipple ke darmiyan control se layein aur chest ki taqat se oopar dhakailen.',
    goodFormTips: [
      'Kohniyan (Elbows) body se 45° angle par andar ki taraf rakhein.',
      'Kamar me halka sa natural arch banayein, dono paon zameen par mazbooti se jamayein.',
      'Barbell ko hamesha aahista control ke sath niche layein aur seenay se squeeze kar ke oopar uthayein.',
    ],
    mistakesToAvoid: [
      'Kohniyan 90° bahar nikaalna: Is se kandhay ka rotator cuff ghis kar injure ho sakta hai.',
      'Bar ko tezi se gira kar chest par bounce karna.',
      'Bench se hips ko uthana.',
    ],
  },
  {
    id: 'incline_bench',
    name: 'Incline Bench Press (Barbell / Dumbbell)',
    muscle: 'chest',
    muscleUrdu: 'Upper Chest (Seenay Ka Oopri Hissa)',
    targetArea: 'Upper Clavicular Chest Shelf',
    image: '/exercises/incline_bench.jpg',
    sets: '3-4 Sets',
    reps: '8-10 Reps',
    howToUrdu: 'Bench ko 30° se 45° incline par set karein. Wazan ko collarbone ke paas control se niche layein aur upper chest se push karein.',
    goodFormTips: [
      'Bench ka angle sirf 30° ya 45° (2nd/3rd notch) rakhein taake saara wazan upper chest par aaye.',
      'Dumbbells ko niche laate waqt chest ko poora stretch karein.',
      'Kohniyan 45° par rakhein taake kandhon par be-wajah dabao na pare.',
    ],
    mistakesToAvoid: [
      'Bench ko 60° par seedha khara karna: Is se chest band ho kar kandhay ki exercise ban jati hai.',
      'Kohniyan poori tarah bahar phailana.',
    ],
  },
  {
    id: 'dips',
    name: 'Chest Dips (Parallel Bars)',
    muscle: 'chest',
    muscleUrdu: 'Lower Chest & Triceps',
    targetArea: 'Nichla Seena (Lower Pec Line)',
    image: '/exercises/dips.jpg',
    sets: '3 Sets',
    reps: '10-12 Reps',
    howToUrdu: 'Parallel bars par body ko thora aagay jhuka kar (forward lean) niche jayein taake lower chest par load aaye.',
    goodFormTips: [
      'Body ko taqreeban 30° aagay jhukayein (Forward lean).',
      'Ghutnay peechay fold kar ke cross kar lein taake body stable rahay.',
      'Niche aatay waqt 90° elbow depth tak aahista jayein aur squeeze karein.',
    ],
    mistakesToAvoid: [
      'Bilkul seedha khara rehna: Agar body 90° seedhi hogi to saara load Triceps par jaye ga, Chest nahi banegi.',
      'Zyada gehra niche jana jisse kandhay me dard ho.',
    ],
  },
  {
    id: 'cable_flyes',
    name: 'Cable Crossover Chest Flyes',
    muscle: 'chest',
    muscleUrdu: 'Chest Cleavage (Inner & Outer Pecs)',
    targetArea: 'Seenay Ki Lakeer & Blood Pump',
    image: '/exercises/cable_flyes.jpg',
    sets: '3 Sets',
    reps: '12-15 Reps',
    howToUrdu: 'Dono pulleys ke handles pakar kar seenay ke aagay hath aapas me milayein aur chest ko tight squeeze karein.',
    goodFormTips: [
      'Kohniyon ko halka sa curve (15°) rakh kar freeze rakhein jaisay darakht (tree) ko gale laga rahe hon.',
      'Aagay hath milatay waqt chest ko 1 second tight squeeze karein.',
      'Thora sa aagay jhuk kar ek paon aagay aur ek peechay rakhein.',
    ],
    mistakesToAvoid: [
      'Baazu bilkul seedhay rakhna (elbows lock karna).',
      'Kamar se jhatkay maar kar wazan aagay phenkna.',
    ],
  },

  // BACK
  {
    id: 'deadlift',
    name: 'Conventional Barbell Deadlift',
    muscle: 'back',
    muscleUrdu: 'Peeth & Spine (Back Thickness & Power)',
    targetArea: 'Overall Back, Spinal Erectors, Traps & Glutes',
    image: '/exercises/deadlift.jpg',
    sets: '4 Sets',
    reps: '5-6 Reps (Heavy)',
    howToUrdu: 'Barbell ke bilkul qareeb kharay ho kar kamar seedhi rakhein, chest oopar, aur paon se zameen push kar ke wazan uthayein.',
    goodFormTips: [
      'Kamar (spine) bilkul seedhi aur flat honi chahiye, hargiz gol na ho.',
      'Barbell hamesha pindliyon (shins) aur thighs ke sath chipak kar upar jaye.',
      'Upar pohnch kar hips ko lock karein, peechay zyada jhookne ki zaroorat nahi.',
    ],
    mistakesToAvoid: [
      'Kamar ko gol karna (Cat back): Yeh sab se khatarnak ghalti hai, is se disc slip ho sakti hai!',
      'Bar ko body se door rakh kar uthana.',
    ],
  },
  {
    id: 'lat_pulldown',
    name: 'Wide-Grip Lat Pulldown',
    muscle: 'back',
    muscleUrdu: 'Lats (Peeth Ki Choorai / V-Taper)',
    targetArea: 'Upper Lats & V-Shape Width',
    image: '/exercises/lat_pulldown.jpg',
    sets: '4 Sets',
    reps: '8-12 Reps',
    howToUrdu: 'Machine par baith kar bar ko wide grip se pakrein aur chest ke oopri hissay (collarbone) tak khenchein.',
    goodFormTips: [
      'Halka sa 15° peechay jhook rakhein taake bar direct lats ko target karay.',
      'Bar ko kohniyon (elbows) ke zariye niche khenchein aur lats ko squeeze karein.',
      'Upar jatay waqt control se poora stretch hone dein.',
    ],
    mistakesToAvoid: [
      'Bar ko gardan ke peechay (behind the neck) khenchna - kandha injury ka khatra barhta hai.',
      'Kamar se aagay peechay jhatkay marna.',
    ],
  },
  {
    id: 'bent_over_row',
    name: 'Bent-Over Barbell Row',
    muscle: 'back',
    muscleUrdu: 'Peeth Ki Motai (Mid-Back & Rhomboids)',
    targetArea: 'Middle Back Density & Thickness',
    image: '/exercises/bent_over_row.jpg',
    sets: '3-4 Sets',
    reps: '8-10 Reps',
    howToUrdu: 'Kamar 45° aagay jhuka kar bar ko naaf (belly button) ki taraf khenchein aur back ke dono hisson ko aapas me milayein.',
    goodFormTips: [
      'Ghutnay halkay se mor kar hips peechay dhakailen (hip hinge).',
      'Kamar flat aur pet (core) ko tight rakhein.',
      'Bar ko kohniyon se khenchein aur oopar 1 second hold karein.',
    ],
    mistakesToAvoid: [
      'Kamar gol kar ke wazan uthana.',
      'Bohat zyada seedha kharay ho jana.',
    ],
  },

  // SHOULDERS
  {
    id: 'overhead_press',
    name: 'Standing Overhead Military Press',
    muscle: 'shoulders',
    muscleUrdu: 'Kandhay (Front Deltoids & Shoulder Power)',
    targetArea: 'Overall Shoulder Mass & Overhead Strength',
    image: '/exercises/overhead_press.jpg',
    sets: '4 Sets',
    reps: '6-8 Reps',
    howToUrdu: 'Barbell ko upper chest se seedha sar ke oopar lockout karein aur aahista control ke sath chin tak niche layein.',
    goodFormTips: [
      'Hips aur pet ko tight rakhein taake lower back peechay na jhukay.',
      'Barbell seedhi amoodi (vertical) line me sar ke oopar jaye.',
      'Kohniyan bar ke bilkul niche honi chahiye.',
    ],
    mistakesToAvoid: [
      'Kamar ko bohot peechay bend karna (spine injury risk).',
      'Ghutnon se jhatkay maar kar push press banana.',
    ],
  },
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    muscle: 'shoulders',
    muscleUrdu: 'Side Delts (Kandhon Ki Chaorai / Boulders)',
    targetArea: 'Side Lateral Deltoid Width',
    image: '/exercises/lateral_raise.jpg',
    sets: '4 Sets',
    reps: '12-15 Reps',
    howToUrdu: 'Dono hathon me dumbbells pakar kar dono taraf kandhay ki barabar height tak uthayein aur control se niche layein.',
    goodFormTips: [
      'Dumbbells ko bilkul seedha 90° side me uthane ke bajaye 20° aagay (scapular plane) uthayein.',
      'Kohni hamesha kalai (wrist) ke barabar ya halki si oopar ho.',
      'Halka wazan le kar zyada reps lagayein taake side delts burn hon.',
    ],
    mistakesToAvoid: [
      'Bohot bhaari wazan utha kar jhatkay maar kar phenkna.',
      'Traps (gardan) se wazan uthana.',
    ],
  },

  // LEGS
  {
    id: 'barbell_squats',
    name: 'Barbell Back Squats (Baithak)',
    muscle: 'legs',
    muscleUrdu: 'Taangein (Quads, Hamstrings & Glutes)',
    targetArea: 'Overall Lower Body Mass & Testosterone Booster',
    image: '/exercises/barbell_squats.jpg',
    sets: '4 Sets',
    reps: '8-10 Reps',
    howToUrdu: 'Barbell ko upper back par rakh kar aahista niche baithain jab tak thighs zameen ke barabar (parallel) na ho jayein, phir wapis kharay hon.',
    goodFormTips: [
      'Chest hamesha oopar aur kamar flat rakhein.',
      'Niche aatay waqt ghutnay paon ki ungliyon ki simt me bahar ki taraf kholain.',
      'Thighs zameen ke kam az kam 90° barabar parallel honi chahiye.',
    ],
    mistakesToAvoid: [
      'Ghutnon ko andar ki taraf girana (knee cave) - ligament chot ka khatra.',
      'Heels (airian) ko zameen se uthana.',
      'Aadhe squats lagana (quarter squats).',
    ],
  },
  {
    id: 'leg_press',
    name: '45-Degree Leg Press Machine',
    muscle: 'legs',
    muscleUrdu: 'Quads & Thighs (Raan Ki Mazbooti)',
    targetArea: 'Quad Sweep & Leg Thickness',
    image: '/exercises/leg_press.jpg',
    sets: '4 Sets',
    reps: '10-12 Reps',
    howToUrdu: 'Machine par baith kar paon platform par shoulder-width par rakhein aur wazan ko control se niche la kar push karein.',
    goodFormTips: [
      'Kamar aur hips ko seat ke sath mazbooti se chipkay rakhein.',
      'Platform ko niche laate waqt ghutnay 90° tak aane dein.',
      'Hamesha heels aur panjay se zor lagayein.',
    ],
    mistakesToAvoid: [
      'Upar ja kar ghutnon ko bilkul jhatke se lock karna: Yeh bohot khatarnak ghalti hai!',
      'Hips ko seat se oopar uthana.',
    ],
  },

  // ARMS
  {
    id: 'bicep_curl',
    name: 'Standing Barbell / Dumbbell Bicep Curl',
    muscle: 'arms',
    muscleUrdu: 'Biceps (Dola / Baazu Ka Oopri Hissa)',
    targetArea: 'Bicep Peak & Arm Thickness',
    image: '/exercises/bicep_curl.jpg',
    sets: '4 Sets',
    reps: '8-12 Reps',
    howToUrdu: 'Kohniyan body ke sath chipka kar barbell ko shoulder ki taraf curl karein aur oopar bicep ko 1 second squeeze karein.',
    goodFormTips: [
      'Kohniyan (elbows) ko pasliyon ke sath freeze rakhein, aagay peechay na hilayein.',
      'Upar laa kar bicep ko poora nichorein aur aahista negative control karein.',
      'Kamar ko bilkul seedha aur steady rakhein.',
    ],
    mistakesToAvoid: [
      'Kamar se aagay peechay jhatkay maar kar wazan uthana (ego lifting).',
      'Kohniyon ko hawa me oopar uthana.',
    ],
  },
  {
    id: 'tricep_pushdown',
    name: 'Cable Rope Tricep Pushdown',
    muscle: 'arms',
    muscleUrdu: 'Triceps (Baazu Ka Pechla Hissa - 60% of Arm)',
    targetArea: 'Tricep Horseshoe & Lateral Head',
    image: '/exercises/tricep_pushdown.jpg',
    sets: '4 Sets',
    reps: '10-12 Reps',
    howToUrdu: 'Cable machine par rope pakar kar niche seedha push karein aur aakhri hissay me rope ko dono taraf bahar khol dein.',
    goodFormTips: [
      'Kohniyan body ke dono taraf freeze honi chahiye, sirf forearms move hon.',
      'Niche pohnch kar rope ko dono taraf bahar phaila kar tricep ko hard squeeze karein.',
      'Wapis upar aatay waqt control ke sath 90° tak aane dein.',
    ],
    mistakesToAvoid: [
      'Kohniyon ko aagay peechay hilana.',
      'Kandhon ke zor se wazan dabana.',
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
                <span>Workout Game Photo & Form Guide</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {activeExercise.muscleUrdu}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Exercise ki asali photo aur lagane ka aasan tareeqa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
                { key: 'chest', label: '🔥 Chest (Seena)' },
                { key: 'back', label: '🛡️ Back (Peeth)' },
                { key: 'shoulders', label: '⚡ Shoulders (Kandhay)' },
                { key: 'legs', label: '🦵 Legs (Taangein)' },
                { key: 'arms', label: '💪 Arms (Baazu)' },
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
                {tab.label}
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
                <span>{ex.name}</span>
              </button>
            ))}
          </div>

          {/* MAIN PHOTO DISPLAY CARD */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-xl group">
            {/* The Exercise Photo */}
            <img
              src={activeExercise.image}
              alt={activeExercise.name}
              className="w-full h-auto object-cover max-h-[380px] sm:max-h-[440px] mx-auto select-none"
              loading="eager"
            />

            {/* Photo Overlay Badges */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 shadow-md">
              <span className="text-blue-400 font-extrabold uppercase mr-1.5">Game:</span>
              <span>{activeExercise.name}</span>
            </div>

            <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5">
              <span>{activeExercise.sets} · {activeExercise.reps}</span>
            </div>

            {/* Next / Previous Overlay Arrows */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Exercise"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Exercise"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
            >
              <ChevronRight size={22} />
            </button>

            <div className="absolute bottom-2 right-3 text-[11px] text-slate-300 bg-black/70 px-2.5 py-1 rounded-md backdrop-blur-xs">
              Target: {activeExercise.targetArea}
            </div>
          </div>

          {/* HOW TO PERFORM GUIDE (In Plain Roman Urdu) */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-950 dark:text-blue-200 space-y-1">
            <strong className="block font-black text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
              Kaise Lagani Hai (Simple Instructions):
            </strong>
            <p className="leading-relaxed font-medium">
              {activeExercise.howToUrdu}
            </p>
          </div>

          {/* Sahi vs Ghalat Form Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Sahi Form */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-950 dark:text-emerald-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide border-b border-emerald-500/20 pb-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Sahi Tareeqa (Correct Form ✅)</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.goodFormTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-black shrink-0">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ghalat Form */}
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-950 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide border-b border-rose-500/20 pb-1.5">
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Ghaltiyan (In Se Bachen ❌)</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.mistakesToAvoid.map((mistake, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-600 font-black shrink-0">✗</span>
                    <span>{mistake}</span>
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
              <span>Previous Game</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold hover:bg-gray-100 transition flex items-center gap-1 text-gray-700 dark:text-slate-300"
            >
              <span>Next Game</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            Close Photo
          </button>
        </div>
      </div>
    </div>
  );
}
