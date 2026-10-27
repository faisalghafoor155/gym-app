import { useState } from 'react';
import {
  Dumbbell, AlertTriangle, CheckCircle2,
  ShieldAlert, Sparkles, Compass, X, Play, Pause, Activity
} from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { useLanguage } from '../../context/LanguageContext';

/** Every text field is English and doubles as its `t()` key; the Roman Urdu
 *  lives in i18n/ur/fitness-exercises.ts. */
export interface ExerciseAngleGuide {
  id: string;
  name: string;
  muscle: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';
  primaryTarget: string;
  comparisonImage?: string; // High-detail side-by-side real lifter infographic
  benchAngle?: string;
  elbowAngle?: string;
  bodyTorsoAngle?: string;
  wristGripAngle?: string;
  idealAngleDegree: number; // for SVG visualization
  dangerAngleDegree?: number;
  angleCategory: 'bench' | 'elbow' | 'torso' | 'foot';
  summary: string;
  proFormTips: string[];
  mistakesToAvoid: string[];
  safeZoneText: string;
  dangerZoneText: string;
}

export const EXERCISE_ANGLES_DATA: ExerciseAngleGuide[] = [
  // CHEST EXERCISES (Primary focus requested by user)
  {
    id: 'incline_bench_press',
    name: 'Incline Bench Press (Barbell / Dumbbell)',
    muscle: 'chest',
    primaryTarget: 'Upper Chest (Clavicular Head)',
    comparisonImage: '/exercises/incline_bench_guide.jpg',
    benchAngle: '30° to 45° (2nd or 3rd Notch)',
    elbowAngle: '45° to 60° (Arrowhead angle relative to torso)',
    wristGripAngle: '90° Vertical Forearms at bottom',
    idealAngleDegree: 35,
    dangerAngleDegree: 60,
    angleCategory: 'bench',
    summary: 'To build the upper chest, the bench angle should only be 30° to 45° (2nd or 3rd notch). If the angle goes to 60° or higher, all the weight shifts from the chest onto the front shoulders!',
    proFormTips: [
      'Set the bench at 30° (45° at most). This activates the upper chest muscle fibers perfectly.',
      'Keep the elbows tucked in at a 45° angle to the body so the rotator cuff takes no pressure on the shoulder.',
      'Keep a slight 45° tilt (semi-neutral grip) while lowering the dumbbells for the best chest stretch.',
      'Always touch the barbell with control between the collarbone and the upper chest.',
    ],
    mistakesToAvoid: [
      'Setting the bench at 60°: This is the biggest mistake, it turns a chest workout into a shoulder workout.',
      'Flaring the elbows out to 90°: This puts severe stress on the shoulder joint.',
      'Dropping the weight fast and bouncing it off the chest.',
    ],
    safeZoneText: '✅ 30° - 45° Bench Incline (Perfect Upper Chest Squeeze)',
    dangerZoneText: '❌ 60°+ Incline (Front Delts / Shoulders takeover)',
  },
  {
    id: 'flat_bench_press',
    name: 'Flat Barbell Bench Press',
    muscle: 'chest',
    primaryTarget: 'Mid & Overall Chest Mass (Sternal Head)',
    comparisonImage: '/exercises/flat_bench_guide.jpg',
    benchAngle: '0° (Completely Flat)',
    elbowAngle: '45° to 60° (Arrowhead shape, NOT 90° T-shape)',
    wristGripAngle: '90° Straight Wrists (Bulldog Grip over palm heel)',
    bodyTorsoAngle: '15° to 20° Natural Arch in Lower Back with Retracted Scapula',
    idealAngleDegree: 45,
    dangerAngleDegree: 90,
    angleCategory: 'elbow',
    summary: 'The most important angle on the flat bench is the elbow angle! Keep the elbows at 45°–60° from the body (an arrowhead shape). If you bench with your elbows flared out to 90°, you risk shoulder impingement and a rotator cuff tear!',
    proFormTips: [
      'Scapula Retraction: Lying on the bench, squeeze both shoulder blades back together and lock them into the bench.',
      'Lower Back Arch: Keep a slight 15°–20° arch in the lower back, with the hips and upper back pressed into the bench.',
      'Bar Path: The bar does not come straight down at 90°; it travels in a slight J-curve and touches the nipple line / lower sternum.',
      'Leg Drive: Plant both feet firmly on the floor at 90° to draw power from the ground.',
    ],
    mistakesToAvoid: [
      '❌ 90° Flared Elbows (T-Bone Style): This grinds the shoulder joint instead of working the chest.',
      'Bending the wrists back: Rest the bar on the lower base of the palm so the wrists do not hurt.',
      'Lifting the hips off the bench (butt lifting off bench).',
    ],
    safeZoneText: '✅ 45° - 60° Tucked Elbows (Arrowhead Power & Shoulder Safety)',
    dangerZoneText: '❌ 90° Flared Elbows (Rotator Cuff Impingement Risk)',
  },
  {
    id: 'chest_dips',
    name: 'Chest Dips (Parallel Bars)',
    muscle: 'chest',
    primaryTarget: 'Lower Chest Line & Outer Pec Sweep',
    comparisonImage: '/exercises/dips_guide.jpg',
    bodyTorsoAngle: '30° Forward Lean (tilt the chest forward)',
    elbowAngle: '45° Flared slightly outward during descent',
    idealAngleDegree: 30,
    dangerAngleDegree: 90,
    angleCategory: 'torso',
    summary: 'In dips, the body angle decides whether the exercise works the chest or the triceps! If you dip with a 30° forward lean, all the load goes to the lower chest. If the body stays 90° upright, only the triceps work!',
    proFormTips: [
      'Lean the body forward roughly 30 degrees (forward torso angle).',
      "Fold the knees back and cross them slightly so the body's center of gravity stays forward.",
      'Go down to 90° elbow depth (going lower can overstretch the shoulder).',
      'Squeeze the lower pecs hard on the way up.',
    ],
    mistakesToAvoid: [
      'Dipping completely 90° upright (it becomes a triceps exercise).',
      'Going so deep that the shoulders roll forward.',
      'Throwing the body up with momentum.',
    ],
    safeZoneText: '✅ 30° Forward Lean (Maximum Lower Pec Activation)',
    dangerZoneText: '❌ 90° Upright Body (Transfers load entirely to Triceps)',
  },
  {
    id: 'decline_bench_press',
    name: 'Decline Bench Press / Pushups',
    muscle: 'chest',
    primaryTarget: 'Lower Chest Underline (Abdominal Head)',
    benchAngle: '-15° to -20° (Slight Decline)',
    elbowAngle: '45° Tucked',
    idealAngleDegree: 15,
    angleCategory: 'bench',
    summary: 'The decline bench angle should only be -15° to -20°. Too steep a decline raises the blood pressure in the head. This angle builds the lower edge and rounded look of the chest.',
    proFormTips: [
      'Set the bench at -15° or -20° and lock your feet into the leg pads.',
      'Touch the bar at the lower chest / top of the abs.',
      'If your gym has no decline bench, Incline Pushups or High-to-Low Cable Crossovers are great alternatives.',
    ],
    mistakesToAvoid: [
      'Do not go steeper than -30°, so your blood pressure does not spike.',
      'Do not lift your neck to look forward.',
    ],
    safeZoneText: '✅ -15° to -20° Decline (Optimal Lower Pec Shelf)',
    dangerZoneText: '❌ -35°+ Steep Decline (Head rush & poor mechanical leverage)',
  },
  {
    id: 'cable_crossover',
    name: 'Cable Chest Flyes / Crossovers',
    muscle: 'chest',
    primaryTarget: 'Inner Chest Cleavage & Chest Isolation',
    benchAngle: 'High-to-Low (45° Downward Arc) | Low-to-High (30° Upward Arc)',
    elbowAngle: '15° Constant Soft Bend (never fully lock the elbow)',
    idealAngleDegree: 45,
    angleCategory: 'torso',
    summary: 'Cable crossovers have 2 main angles: (1) High-to-Low (bringing it down at 45°): for the lower & inner chest. (2) Low-to-High (raising it up at 30°): for the upper inner chest. Always keep a constant slight 15° bend in the elbow!',
    proFormTips: [
      'Freeze the elbows rock-solid at a 15° bend; this is a fly movement, not a press.',
      'Squeeze the chest hard for 1 second as the hands cross.',
      'Put one foot forward and one back and lean the body 15°–20° forward for a stable balance.',
    ],
    mistakesToAvoid: [
      'Moving the elbows and turning it into a dumbbell press.',
      'Overstretching the shoulders on the way back.',
      'Lifting more weight than you can handle and jerking it.',
    ],
    safeZoneText: '✅ 45° High-to-Low Arc (Lower/Inner Cut) | 30° Low-to-High Arc (Upper Line)',
    dangerZoneText: '❌ 0° Locked Straight Elbows (Excessive bicep tendon strain)',
  },
  {
    id: 'dumbbell_flyes',
    name: 'Flat / Incline Dumbbell Flyes',
    muscle: 'chest',
    primaryTarget: 'Chest Outer Width & Deep Stretch',
    benchAngle: '0° Flat or 30° Incline',
    elbowAngle: '15° to 20° Fixed Arc (as if hugging a big tree)',
    idealAngleDegree: 20,
    angleCategory: 'elbow',
    summary: 'During dumbbell flyes, never lock the elbow completely straight at 0°; keep a 15°–20° bend. On the way down, the elbow should not drop much below shoulder level, or you risk tearing the pectoral tendon!',
    proFormTips: [
      'Imagine you are hugging a big tree or cylinder ("Hug a tree" cue).',
      'Feel a deep stretch on the way down, but stop the elbows at bench level.',
      'Do not clash the dumbbells together at the top; squeeze with the chest muscle instead.',
    ],
    mistakesToAvoid: [
      'Keeping the elbows completely straight (elbow hyperextension).',
      'Going too heavy (the fly is an isolation exercise; use the Bench Press for heavy lifts).',
    ],
    safeZoneText: '✅ 15° - 20° Constant Elbow Curve (Safe Deep Muscle Stretch)',
    dangerZoneText: '❌ Over-dropping elbows below bench plane (Pec Tear Danger)',
  },

  // BACK EXERCISES
  {
    id: 'bent_over_barbell_row',
    name: 'Bent-Over Barbell Row',
    muscle: 'back',
    primaryTarget: 'Lats Thickness, Mid Back & Rhomboids',
    bodyTorsoAngle: '45° to 70° Torso Hip Hinge (Never completely upright)',
    elbowAngle: 'Pull to hip crease at 45°',
    idealAngleDegree: 45,
    angleCategory: 'torso',
    summary: 'Bend the torso forward between 45° and 70° (by pushing the hips back). Pull the bar straight to the belly button, not to the chest!',
    proFormTips: [
      'Keep the back completely straight (flat spine); never let it round (cat arch).',
      'When pulling the bar, drive the elbows back as if elbowing someone behind you.',
    ],
    mistakesToAvoid: [
      'Standing too upright at 80°-90° (it turns into shrugs).',
      'Rounding the lower back.',
    ],
    safeZoneText: '✅ 45° - 60° Torso Angle (Deep Lat Activation)',
    dangerZoneText: '❌ 80° Upright or Rounded Lower Back (Spinal Disc Danger)',
  },

  {
    id: 'wide_grip_lat_pulldown',
    name: 'Wide-Grip Lat Pulldown',
    muscle: 'back',
    primaryTarget: 'Lats Width (V-Taper)',
    bodyTorsoAngle: '10° to 15° Slight Backward Lean (Never 45° swing)',
    elbowAngle: 'Drive elbows down and back into back pockets',
    idealAngleDegree: 15,
    dangerAngleDegree: 45,
    angleCategory: 'torso',
    summary: 'During lat pulldowns, lean back only a slight 10°–15°. Swinging back as far as 45° is wrong. Pull the bar straight to the collarbone / upper chest.',
    proFormTips: [
      'Keep the grip 1.5 times shoulder width.',
      'Pull with the elbows and squeeze the lats for 1 second at the bottom.',
      'Feel the full stretch on the way up.',
    ],
    mistakesToAvoid: [
      'Swinging back as far as 45° (using momentum).',
      'Pulling the bar down to the belly.',
    ],
    safeZoneText: '✅ 10° - 15° Controlled Lean & Collarbone Touch',
    dangerZoneText: '❌ 45° Excessive Backward Swing',
  },

  // SHOULDERS EXERCISES
  {
    id: 'dumbbell_lateral_raise',
    name: 'Dumbbell Lateral Raises (Side Delts)',
    muscle: 'shoulders',
    primaryTarget: 'Side Shoulder Width (3D Delts)',
    bodyTorsoAngle: '15° to 30° Forward in Scapular Plane (NOT completely 90° lateral)',
    elbowAngle: '10° Slight Bend',
    idealAngleDegree: 25,
    angleCategory: 'torso',
    summary: 'Do not raise the dumbbells straight out to the side at exactly 90°! Always raise them 15°–30° slightly forward (the scapular plane). This avoids friction in the shoulder joint and keeps the load directly on the side delts.',
    proFormTips: [
      'Keep the hands 15° forward (V-shape upward motion).',
      'Always keep the elbow slightly above the wrist (as if pouring water from a jug).',
    ],
    mistakesToAvoid: [
      'Raising straight out to the side at 90° (causes impingement).',
      'Shrugging the shoulders up to the ears (the traps take over).',
    ],
    safeZoneText: '✅ 20° - 30° Scapular Plane (Safe Lateral Delt Growth)',
    dangerZoneText: '❌ 90° Exact Side Raise (Supraspinatus Tendon Friction)',
  },
  {
    id: 'overhead_military_press',
    name: 'Overhead Barbell Military Press',
    muscle: 'shoulders',
    primaryTarget: 'Front & Side Delts & Core',
    bodyTorsoAngle: 'Torso locked upright with braced glutes and core',
    elbowAngle: 'Elbows slightly in front of bar (Scapular plane)',
    idealAngleDegree: 90,
    angleCategory: 'torso',
    summary: 'When doing a standing military press, do not make a big arch in your lower back! Keep the core and glutes tight and lock the bar straight overhead.',
    proFormTips: [
      'Press the barbell straight up from the upper chest.',
      'Move the head slightly back as the bar passes, then bring it forward to neutral.',
    ],
    mistakesToAvoid: [
      'Leaning the lower back too far back (spine injury risk).',
      'Jerking a push-press with the knees.',
    ],
    safeZoneText: '✅ Vertical Overhead Path with Braced Core',
    dangerZoneText: '❌ Hyper-extended Lower Back Arch',
  },

  // LEGS EXERCISES
  {
    id: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    muscle: 'legs',
    primaryTarget: 'Quads, Glutes & Core',
    bodyTorsoAngle: 'Torso stays 60°-75° upright depending on anatomy',
    wristGripAngle: 'Feet flared outward at 15° to 30°',
    idealAngleDegree: 25,
    angleCategory: 'foot',
    summary: 'In a shoulder-width stance, point your shoes 15° to 30° outward (flared out)! The knees should travel forward exactly in the direction of the toes so they do not cave inward.',
    proFormTips: [
      'Knees must track in line with 2nd/3rd toe at 15°-30° outward angle.',
      'Depth: Take the hip crease down to 90° knee level (parallel) or slightly below.',
      'Shoes should have a flat sole (e.g. Converse or dedicated lifting shoes).',
    ],
    mistakesToAvoid: [
      'Knees caving inward (Knee Valgus / collapse).',
      'Squatting in running shoes with a puffy soft sole.',
    ],
    safeZoneText: '✅ 15° - 30° Outward Shoe Flare & 90° Knee Depth',
    dangerZoneText: '❌ 0° Straight Feet with Inward Knee Collapse',
  },

  // ARMS EXERCISES
  {
    id: 'barbell_bicep_curl',
    name: 'Standing Barbell Bicep Curls',
    muscle: 'arms',
    primaryTarget: 'Bicep Peak & Arm Thickness',
    bodyTorsoAngle: 'Strict upright posture (Zero torso momentum)',
    elbowAngle: 'Pinned strictly to ribcage sides',
    idealAngleDegree: 90,
    angleCategory: 'elbow',
    summary: 'During bicep curls, the elbows should stay pinned to the body! If you move the elbows back and forth or jerk with your back, the load leaves the biceps and goes to the front delts.',
    proFormTips: [
      'Freeze the elbows against the ribs.',
      'Squeeze the bicep hard at the top and lower it with control.',
    ],
    mistakesToAvoid: [
      'Jerking with the back (ego lifting).',
      'Lifting the elbows forward into the air.',
    ],
    safeZoneText: '✅ Pinned Elbows with Controlled Negative',
    dangerZoneText: '❌ Swinging Back & Flared Elbows',
  },
  {
    id: 'ez_bar_skullcrushers',
    name: 'EZ-Bar Lying Skullcrushers',
    muscle: 'arms',
    primaryTarget: 'Triceps Long Head Mass',
    bodyTorsoAngle: 'Flat on bench, feet planted',
    elbowAngle: '75° Backward slant (Never 90° straight vertical)',
    idealAngleDegree: 75,
    angleCategory: 'elbow',
    summary: 'In skullcrushers, instead of keeping the elbows straight at 90°, slant them slightly back toward the head at 75°. This keeps constant tension on the triceps long head through the whole exercise, and the elbows do not hurt!',
    proFormTips: [
      'Lower the barbell to slightly behind the forehead.',
      'Only the forearms should move; the upper arm stays completely frozen.',
    ],
    mistakesToAvoid: [
      'Flaring the elbows out.',
      'Dropping the bar on the forehead.',
    ],
    safeZoneText: '✅ 75° Backward Slant for Constant Tricep Tension',
    dangerZoneText: '❌ Flared Elbows causing Joint Inflammation',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultMuscle?: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';
  initialExerciseId?: string;
}

export default function ExerciseAnglesModal({
  isOpen,
  onClose,
  defaultMuscle = 'chest',
  initialExerciseId,
}: Props) {
  const { t } = useLanguage();
  const [selectedMuscle, setSelectedMuscle] = useState<'chest' | 'back' | 'shoulders' | 'legs' | 'arms'>(defaultMuscle);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    initialExerciseId || (defaultMuscle === 'chest' ? 'incline_bench_press' : EXERCISE_ANGLES_DATA[0]!.id)
  );
  const [displayMode, setDisplayMode] = useState<'real_comparison' | 'animated_biomechanics'>('animated_biomechanics');

  const filteredExercises = EXERCISE_ANGLES_DATA.filter(e => e.muscle === selectedMuscle);
  const activeExercise =
    EXERCISE_ANGLES_DATA.find(e => e.id === selectedExerciseId) ||
    filteredExercises[0] ||
    EXERCISE_ANGLES_DATA[0]!;

  const handleMuscleChange = (muscle: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms') => {
    setSelectedMuscle(muscle);
    const firstInMuscle = EXERCISE_ANGLES_DATA.find(e => e.muscle === muscle);
    if (firstInMuscle) setSelectedExerciseId(firstInMuscle.id);
  };

  const [isAnimated, setIsAnimated] = useState(true);

  // Animated Lifter Biomechanics Visual Canvas ("Man Game Lagata Hua Aur Us Ka Angle")
  const renderLifterVisual = (guide: ExerciseAngleGuide) => {
    const isPressing = isAnimated;

    // 1. INCLINE BENCH PRESS (Lifter on 35° Incline Bench)
    if (guide.id === 'incline_bench_press') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('35° Incline Press') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes barbellIncline {
                  0%, 100% { transform: translate(0px, 0px); }
                  50% { transform: translate(-22px, -30px); }
                }
                .barbell-incline-anim {
                  animation: ${isPressing ? 'barbellIncline 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>

            {/* Gym Floor line */}
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
            <text x="315" y="188" fill="#64748b" fontSize="9" textAnchor="end">{t('Floor')}</text>

            {/* Incline Bench Frame */}
            {/* Base leg & supports */}
            <line x1="90" y1="175" x2="90" y2="135" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            <line x1="175" y1="175" x2="175" y2="105" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            <line x1="70" y1="175" x2="200" y2="175" stroke="#334155" strokeWidth="5" />

            {/* Seat Pad */}
            <line x1="75" y1="140" x2="110" y2="135" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
            <line x1="75" y1="140" x2="110" y2="135" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />

            {/* Incline Backrest Pad (35° tilt) */}
            <line x1="108" y1="135" x2="215" y2="60" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
            <line x1="108" y1="135" x2="215" y2="60" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />

            {/* Bench Incline Angle Arc & Lines */}
            {/* Horizontal baseline for angle reference */}
            <line x1="108" y1="135" x2="215" y2="135" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="215" y="146" fill="#94a3b8" fontSize="9" textAnchor="end">{t('0° Baseline')}</text>

            {/* 35° Ideal Angle Arc */}
            <path
              d="M 155 135 A 48 48 0 0 0 148 108"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />
            <text x="165" y="122" fill="#34d399" fontSize="11" fontWeight="900">{t('35° Incline')}</text>

            {/* 60° Danger dashed line */}
            <line x1="108" y1="135" x2="175" y2="25" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="180" y="32" fill="#f43f5e" fontSize="9" fontWeight="bold">{t('60° ❌ Shoulder Danger')}</text>

            {/* THE LIFTER (Man lying on 35° Incline) */}
            {/* Legs: Thigh & Shin down to floor */}
            <polyline
              points="105,130 130,118 135,175"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Shoe flat on floor */}
            <rect x="125" y="172" width="22" height="6" rx="2" fill="#3b82f6" />

            {/* Torso lying on backrest (Hips to Shoulder) */}
            <line x1="108" y1="130" x2="190" y2="72" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            {/* Highlighted Upper Pecs (Clavicular Head) */}
            <path d="M 165 85 Q 172 75 180 82" stroke="#38bdf8" strokeWidth="5" fill="none" strokeLinecap="round" />

            {/* Lifter Head resting on pad */}
            <circle cx="205" cy="62" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />
            {/* Hair/cap */}
            <path d="M 197 58 Q 206 50 213 58" stroke="#1e293b" strokeWidth="3" fill="#1e293b" />

            {/* Animated Arms & Barbell Press */}
            <g className="barbell-incline-anim">
              {/* Arm: Shoulder (185, 75) -> Elbow (165, 95) -> Hand (168, 65) */}
              <polyline
                points="185,75 165,95 168,65"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Barbell Bar */}
              <line x1="120" y1="95" x2="215" y2="35" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
              {/* Weight Plates */}
              <rect x="128" y="82" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
              <rect x="202" y="22" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />

              {/* Hand Grip Callout */}
              <circle cx="168" cy="65" r="4" fill="#38bdf8" />
            </g>

            {/* Biomechanical Cues On Figure */}
            <g transform="translate(195, 100)">
              <rect x="0" y="0" width="125" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ Bench: 30° - 45°')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9" fontWeight="bold">{t('✅ Elbows: 45° Tucked')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ 60°: Shoulder Takeover')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('Target: 30° - 45° Incline (Upper Chest)')}
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle size={13} /> {t('60° Flared Shoulder Danger')}
            </span>
          </div>
        </div>
      );
    }

    // 2. FLAT BARBELL BENCH PRESS (Lifter on 0° Flat Bench)
    if (guide.id === 'flat_bench_press') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Flat Bench Press') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes barbellFlat {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-34px); }
                }
                .barbell-flat-anim {
                  animation: ${isPressing ? 'barbellFlat 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>

            {/* Floor */}
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Flat Bench (0° Horizontal) */}
            <line x1="85" y1="135" x2="235" y2="135" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
            <line x1="85" y1="135" x2="235" y2="135" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            {/* Bench legs */}
            <line x1="105" y1="175" x2="105" y2="140" stroke="#475569" strokeWidth="6" />
            <line x1="215" y1="175" x2="215" y2="140" stroke="#475569" strokeWidth="6" />

            {/* Barbell Rack Uprights */}
            <line x1="230" y1="175" x2="230" y2="60" stroke="#64748b" strokeWidth="4" />
            <path d="M 226 70 L 234 70 L 234 65" stroke="#f8fafc" strokeWidth="2" fill="none" />

            {/* LIFTER: Leg Drive (90° knee angle flat on floor) */}
            <polyline
              points="110,130 80,140 80,175"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Shoe */}
            <rect x="70" y="172" width="22" height="6" rx="2" fill="#3b82f6" />
            <text x="65" y="160" fill="#94a3b8" fontSize="8">{t('90° Knee')}</text>

            {/* LIFTER TORSO: With 15° Lumbar Arch & Retracted Scapula */}
            {/* Hips on bench at 110, arch lifting off bench at 140, upper back on bench at 180 */}
            <path
              d="M 110 130 Q 140 120 180 130"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Chest pecs highlighted */}
            <circle cx="165" cy="118" r="8" fill="#38bdf8" opacity="0.8" />
            <text x="135" y="112" fill="#34d399" fontSize="8" fontWeight="bold">{t('15° Back Arch')}</text>

            {/* Lifter Head on bench */}
            <circle cx="210" cy="128" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />
            <path d="M 205 120 Q 214 116 218 124" stroke="#1e293b" strokeWidth="3" fill="#1e293b" />

            {/* Animated Barbell & Arm Press */}
            <g className="barbell-flat-anim">
              {/* Forearm & Upper Arm from shoulder (180, 130) to hands (165, 85) */}
              <polyline
                points="180,130 155,120 165,85"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Barbell Bar (Touches lower chest/nipples) */}
              <line x1="120" y1="85" x2="210" y2="85" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
              {/* Weight Plates */}
              <rect x="125" y="70" width="7" height="30" rx="2" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
              <rect x="198" y="70" width="7" height="30" rx="2" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
            </g>

            {/* INSET: Top-Down Elbow Angle View (Arrowhead 45° vs Flared 90°) */}
            <g transform="translate(15, 20)">
              <rect x="0" y="0" width="115" height="52" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="13" fill="#94a3b8" fontSize="8" fontWeight="bold">{t('ELBOW ANGLE:')}</text>
              <text x="6" y="26" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 45°-60° Arrowhead')}</text>
              <text x="6" y="38" fill="#f43f5e" fontSize="9" fontWeight="bold">{t('❌ 90° Flared Danger')}</text>
              <text x="6" y="48" fill="#cbd5e1" fontSize="7">{t('Rotator Cuff Protected')}</text>
            </g>

            {/* Bench 0° indicator */}
            <text x="245" y="138" fill="#38bdf8" fontSize="10" fontWeight="bold">{t('0° Flat')}</text>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('45°–60° Elbow Arrowhead (Safe Power)')}
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle size={13} /> {t('90° T-Bone Flared Elbows = Injury Risk')}
            </span>
          </div>
        </div>
      );
    }

    // 3. CHEST DIPS (Parallel Bars with 30° Forward Torso Lean)
    if (guide.id === 'chest_dips') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Chest Dips - 30° Lean') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes dipRep {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(22px); }
                }
                .dip-anim {
                  animation: ${isPressing ? 'dipRep 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>

            {/* Floor */}
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Dip Bar Frame */}
            <line x1="100" y1="175" x2="100" y2="95" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            <line x1="210" y1="175" x2="210" y2="95" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            <line x1="90" y1="95" x2="220" y2="95" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

            {/* Angle Guide Lines from Hips */}
            {/* 90° Vertical Line (Triceps only) */}
            <line x1="145" y1="140" x2="145" y2="35" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="142" y="32" fill="#94a3b8" fontSize="8" textAnchor="end">{t('90° (Triceps Only)')}</text>

            {/* 30° Forward Torso Line (Chest Focus) */}
            <line x1="145" y1="140" x2="185" y2="45" stroke="#10b981" strokeWidth="2.5" />
            {/* Arc */}
            <path d="M 145 80 A 60 60 0 0 1 168 85" fill="none" stroke="#10b981" strokeWidth="2" />
            <text x="175" y="75" fill="#34d399" fontSize="10" fontWeight="900">{t('30° Chest Lean')}</text>

            {/* ANIMATED LIFTER PERFORMING DIPS */}
            <g className="dip-anim">
              {/* Crossed Legs (bent backwards for forward lean stability) */}
              <polyline
                points="145,135 115,145 125,170"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="125" cy="170" r="4" fill="#3b82f6" />

              {/* Torso Leaning Forward at 30° */}
              <line x1="145" y1="135" x2="175" y2="65" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
              {/* Lower Pec Highlight */}
              <path d="M 160 85 Q 170 85 174 75" stroke="#38bdf8" strokeWidth="5" fill="none" strokeLinecap="round" />

              {/* Head facing forward/down */}
              <circle cx="188" cy="52" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M 183 45 Q 192 42 195 50" stroke="#1e293b" strokeWidth="3" fill="#1e293b" />

              {/* Arms on Dip Handle (hands locked on bar at 155, 95) */}
              <polyline
                points="172,68 152,95 155,95"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="155" cy="95" r="5" fill="#38bdf8" />
            </g>

            {/* Callout box */}
            <g transform="translate(205, 115)">
              <rect x="0" y="0" width="125" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 30° Lean = Chest')}</text>
              <text x="6" y="26" fill="#f43f5e" fontSize="9">{t('❌ 90° Upright = Triceps')}</text>
              <text x="6" y="37" fill="#94a3b8" fontSize="8">{t('Knees bent & crossed back')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('30° Torso Forward Lean = Lower Chest Activation')}
            </span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <AlertTriangle size={13} /> {t('Standing upright does not work the chest!')}
            </span>
          </div>
        </div>
      );
    }

    // 4. CABLE CHEST FLYES (Standing Crossover with 45° Downward Arc)
    if (guide.id === 'cable_crossover') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Cable Crossover 45°') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes cableFlyMotion {
                  0%, 100% { transform: scale(1); }
                  50% { transform: translate(6px, 12px); }
                }
                .cable-anim {
                  animation: ${isPressing ? 'cableFlyMotion 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>

            {/* Floor */}
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Dual Cable Towers */}
            <line x1="40" y1="175" x2="40" y2="35" stroke="#475569" strokeWidth="6" />
            <circle cx="40" cy="45" r="7" fill="#38bdf8" />
            <line x1="300" y1="175" x2="300" y2="35" stroke="#475569" strokeWidth="6" />
            <circle cx="300" cy="45" r="7" fill="#38bdf8" />

            {/* 45° Trajectory Arrow lines */}
            <line x1="40" y1="45" x2="160" y2="140" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="75" y="85" fill="#34d399" fontSize="9" fontWeight="bold">{t('45° Downward Arc')}</text>

            {/* LIFTER: Standing in center with staggered stance */}
            <polyline
              points="155,145 140,175"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <polyline
              points="165,145 185,175"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Shoes */}
            <rect x="130" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <rect x="180" y="172" width="18" height="6" rx="2" fill="#3b82f6" />

            {/* Torso with slight 15° forward lean */}
            <line x1="160" y1="145" x2="165" y2="85" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
            <circle cx="166" cy="72" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />
            {/* Chest squeeze center */}
            <circle cx="165" cy="100" r="7" fill="#38bdf8" opacity="0.8" />

            {/* ANIMATED ARMS & CABLES */}
            <g className="cable-anim">
              {/* Cable from left pulley */}
              <line x1="40" y1="45" x2="145" y2="115" stroke="#94a3b8" strokeWidth="2" />
              {/* Cable from right pulley */}
              <line x1="300" y1="45" x2="185" y2="115" stroke="#94a3b8" strokeWidth="2" />

              {/* Left Arm with 15° soft curved elbow */}
              <path d="M 160 88 Q 130 95 145 115" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" />
              {/* Right Arm with 15° soft curved elbow */}
              <path d="M 170 88 Q 200 95 185 115" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" />

              {/* Meeting hands squeezing together at bottom */}
              <circle cx="145" cy="115" r="4" fill="#38bdf8" />
              <circle cx="185" cy="115" r="4" fill="#38bdf8" />
            </g>

            {/* Callout Info */}
            <g transform="translate(195, 125)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 45° High-to-Low Arc')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ 15° Soft Elbow Curve')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ Never lock straight 0°')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('45° Trajectory = Inner & Lower Chest Cleavage Squeeze')}
            </span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              {t('15° Constant Elbow Curve')}
            </span>
          </div>
        </div>
      );
    }

    // 5. DECLINE BENCH PRESS (Lifter on -20° Decline Bench)
    if (guide.id === 'decline_bench_press') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('-20° Decline Press') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes declineBarbellPress {
                  0%, 100% { transform: translate(0px, 0px); }
                  50% { transform: translate(-20px, -24px); }
                }
                .decline-anim {
                  animation: ${isPressing ? 'declineBarbellPress 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
            {/* Decline Bench Pad (-20° slant) */}
            <line x1="80" y1="145" x2="220" y2="95" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
            <line x1="80" y1="145" x2="220" y2="95" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            {/* Roller Pads for legs */}
            <circle cx="225" cy="85" r="9" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="215" cy="70" r="9" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            {/* Supports */}
            <line x1="85" y1="175" x2="85" y2="145" stroke="#475569" strokeWidth="6" />
            <line x1="195" y1="175" x2="195" y2="105" stroke="#475569" strokeWidth="6" />

            {/* -20° Angle Arc */}
            <line x1="80" y1="145" x2="190" y2="145" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M 140 145 A 50 50 0 0 1 148 120" fill="none" stroke="#10b981" strokeWidth="2" />
            <text x="155" y="132" fill="#34d399" fontSize="10" fontWeight="bold">{t('-20° Decline')}</text>

            {/* LIFTER: Head down at left, legs hooked into rollers at right */}
            <polyline points="180,105 215,80 220,70" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <line x1="180" y1="105" x2="95" y2="135" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            {/* Lower Pec Highlight */}
            <path d="M 125 125 Q 135 120 145 110" stroke="#38bdf8" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="85" cy="140" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* Barbell Press */}
            <g className="decline-anim">
              <polyline points="125,125 145,100 135,75" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
              <line x1="100" y1="90" x2="175" y2="60" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
              <rect x="105" y="78" width="6" height="24" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
              <rect x="165" y="48" width="6" height="24" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            </g>

            <g transform="translate(195, 115)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ -15° to -20° Decline')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Lower Pec Cut Squeeze')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ -35°+ Head pressure')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('-20° Decline = Lower Pec Shelf Line')}
            </span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              {t('Bar touches bottom ribs')}
            </span>
          </div>
        </div>
      );
    }

    // 6. DUMBBELL FLYES (15°-20° Soft Curved Elbow Arc)
    if (guide.id === 'dumbbell_flyes') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('15°–20° Elbow Flye Arc') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes flyeOpenClose {
                  0%, 100% { transform: translate(0px, 0px); }
                  50% { transform: translate(14px, 18px); }
                }
                .flye-left-anim {
                  animation: ${isPressing ? 'flyeOpenClose 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
            {/* Flat Bench */}
            <line x1="85" y1="135" x2="235" y2="135" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
            <line x1="85" y1="135" x2="235" y2="135" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <line x1="105" y1="175" x2="105" y2="140" stroke="#475569" strokeWidth="6" />
            <line x1="215" y1="175" x2="215" y2="140" stroke="#475569" strokeWidth="6" />

            {/* Lifter Body */}
            <polyline points="110,130 80,140 80,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="70" y="172" width="22" height="6" rx="2" fill="#3b82f6" />
            <line x1="110" y1="130" x2="180" y2="130" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            <circle cx="210" cy="128" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* Animated Dumbbell Flye Arms (Hug A Tree Movement) */}
            <g className="flye-left-anim">
              {/* Soft curved arm at 15°-20° */}
              <path d="M 165 125 Q 135 110 145 75" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" />
              {/* Dumbbell */}
              <line x1="135" y1="75" x2="155" y2="75" stroke="#94a3b8" strokeWidth="3" />
              <rect x="130" y="67" width="5" height="16" rx="2" fill="#38bdf8" />
              <rect x="155" y="67" width="5" height="16" rx="2" fill="#38bdf8" />
            </g>

            {/* Bench Plane Danger Line (Do not drop elbows below bench) */}
            <line x1="85" y1="135" x2="235" y2="135" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="240" y="125" fill="#f43f5e" fontSize="8" fontWeight="bold">{t('❌ Stop at bench level')}</text>

            <g transform="translate(15, 20)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 15°-20° Elbow Curve')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('"Hug A Big Tree" Cue')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ Never lock straight 0°')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('15°–20° Elbow Curve = Deep Chest Fiber Stretch')}
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle size={13} /> {t('Do not take the elbows below the bench!')}
            </span>
          </div>
        </div>
      );
    }

    // 7. BENT-OVER BARBELL ROW (45°-70° Torso Hip Hinge)
    if (guide.id === 'bent_over_barbell_row') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('45° Barbell Row') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes rowBarPull {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translate(-8px, -26px); }
                }
                .row-anim {
                  animation: ${isPressing ? 'rowBarPull 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* 45° Torso Angle Guideline from Hips (115, 120) */}
            <line x1="115" y1="120" x2="210" y2="120" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="115" y1="120" x2="190" y2="65" stroke="#10b981" strokeWidth="2" />
            <path d="M 155 120 A 40 40 0 0 0 148 95" fill="none" stroke="#10b981" strokeWidth="2" />
            <text x="160" y="105" fill="#34d399" fontSize="10" fontWeight="bold">{t('45° Hip Hinge')}</text>

            {/* LIFTER: Standing hinged at hips, knees soft */}
            <polyline points="105,175 105,145 115,120" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="95" y="172" width="22" height="6" rx="2" fill="#3b82f6" />
            {/* Flat Torso Spine */}
            <line x1="115" y1="120" x2="185" y2="70" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            <circle cx="198" cy="60" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* Lats Highlight */}
            <path d="M 135 105 Q 145 95 160 85" stroke="#38bdf8" strokeWidth="5" fill="none" strokeLinecap="round" />

            {/* ANIMATED BARBELL ROW PULL */}
            <g className="row-anim">
              {/* Arms pulling to belly button */}
              <polyline points="175,75 155,100 145,130" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Barbell */}
              <line x1="120" y1="130" x2="175" y2="130" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="122" y="117" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
              <rect x="168" y="117" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            </g>

            <g transform="translate(195, 115)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 45° Torso Flat Spine')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Pull to Belly Button')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ Never round lower back')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('45° Hip Hinge & Pull to Navel = Massive Lat Thickness')}
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle size={13} /> {t('Rounding the back can slip a disc!')}
            </span>
          </div>
        </div>
      );
    }

    // 8. WIDE-GRIP LAT PULLDOWN (15° Torso Lean & Pull to Collarbone)
    if (guide.id === 'wide_grip_lat_pulldown') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Wide Lat Pulldown') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes latPulldownAnim {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(32px); }
                }
                .lat-anim {
                  animation: ${isPressing ? 'latPulldownAnim 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
            {/* Lat Machine Frame */}
            <line x1="165" y1="175" x2="165" y2="25" stroke="#475569" strokeWidth="6" />
            <line x1="140" y1="25" x2="190" y2="25" stroke="#475569" strokeWidth="6" />
            <circle cx="165" cy="30" r="7" fill="#38bdf8" />

            {/* Seat & Thigh Pad */}
            <rect x="135" y="130" width="55" height="8" rx="2" fill="#1e293b" />
            <circle cx="175" cy="115" r="7" fill="#475569" />

            {/* LIFTER: Seated with 15° slight backward lean */}
            <polyline points="150,130 175,115 175,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="170" y="172" width="20" height="6" rx="2" fill="#3b82f6" />
            <line x1="150" y1="130" x2="140" y2="65" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            <circle cx="138" cy="52" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />
            <text x="100" y="90" fill="#34d399" fontSize="9" fontWeight="bold">{t('15° Lean')}</text>

            {/* ANIMATED CABLE BAR PULL */}
            <g className="lat-anim">
              <line x1="165" y1="30" x2="155" y2="60" stroke="#94a3b8" strokeWidth="2" />
              {/* Wide Bar */}
              <line x1="105" y1="60" x2="205" y2="60" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
              {/* Angled handles */}
              <line x1="105" y1="60" x2="95" y2="70" stroke="#f8fafc" strokeWidth="3" />
              <line x1="205" y1="60" x2="215" y2="70" stroke="#f8fafc" strokeWidth="3" />
              {/* Arms pulling bar */}
              <polyline points="140,68 115,75 110,62" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
              <polyline points="140,68 185,75 195,62" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
            </g>

            <g transform="translate(205, 115)">
              <rect x="0" y="0" width="125" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 10° - 15° Controlled Lean')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Pull to Collarbone')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ No 45° body swinging')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('15° Lean & Collarbone Touch = V-Taper Back Width')}
            </span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              {t('Drive the elbows back toward your pockets')}
            </span>
          </div>
        </div>
      );
    }

    // 9. DUMBBELL LATERAL RAISES (25° Scapular Plane V-Shape)
    if (guide.id === 'dumbbell_lateral_raise') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('25° Scapular Lateral Raise') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes latRaiseAnim {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translate(0px, -30px); }
                }
                .lat-raise-anim {
                  animation: ${isPressing ? 'latRaiseAnim 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Standing Lifter Torso & Legs */}
            <polyline points="155,120 145,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <polyline points="165,120 175,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="135" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <rect x="170" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <line x1="160" y1="120" x2="160" y2="65" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
            <circle cx="160" cy="52" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* ANIMATED ARMS RAISING DUMBBELLS */}
            <g className="lat-raise-anim">
              {/* Left Arm in 25° Scapular Plane */}
              <polyline points="152,70 120,80 100,105" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="92" y="98" width="6" height="16" rx="2" fill="#38bdf8" />

              {/* Right Arm in 25° Scapular Plane */}
              <polyline points="168,70 200,80 220,105" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="222" y="98" width="6" height="16" rx="2" fill="#38bdf8" />
            </g>

            {/* Inset Cues */}
            <g transform="translate(195, 20)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 25° Scapular Plane')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Raise Slightly Forward')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ Never 90° straight side')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('25° Scapular Plane = 3D Boulder Shoulders Without Joint Friction')}
            </span>
          </div>
        </div>
      );
    }

    // 10. OVERHEAD MILITARY PRESS (Standing Vertical Press)
    if (guide.id === 'overhead_military_press') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Overhead Military Press') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes ohpPressAnim {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-38px); }
                }
                .ohp-anim {
                  animation: ${isPressing ? 'ohpPressAnim 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Standing Lifter */}
            <polyline points="155,125 145,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <polyline points="165,125 175,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="135" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <rect x="170" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <line x1="160" y1="125" x2="160" y2="70" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
            <circle cx="160" cy="56" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* ANIMATED BARBELL PRESS OVERHEAD */}
            <g className="ohp-anim">
              <polyline points="152,72 135,82 138,62" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
              <polyline points="168,72 185,82 182,62" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
              <line x1="110" y1="62" x2="210" y2="62" stroke="#f8fafc" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="115" y="49" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
              <rect x="199" y="49" width="6" height="26" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
            </g>

            <g transform="translate(195, 115)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ Strict Vertical Lockout')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Glutes & Core Tight')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ No excessive lower back arch')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('Lock out straight overhead and keep the core tight')}
            </span>
          </div>
        </div>
      );
    }

    // 11. BARBELL BACK SQUAT (Deep Parallel Knee Crease & Shoe Flare)
    if (guide.id === 'barbell_back_squat') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Barbell Back Squat') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes squatLifterRep {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(28px); }
                }
                .squat-anim {
                  animation: ${isPressing ? 'squatLifterRep 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Squat Rack Uprights */}
            <line x1="80" y1="175" x2="80" y2="45" stroke="#475569" strokeWidth="5" />
            <line x1="240" y1="175" x2="240" y2="45" stroke="#475569" strokeWidth="5" />

            {/* 90° Parallel Knee Depth line */}
            <line x1="120" y1="140" x2="200" y2="140" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="205" y="143" fill="#34d399" fontSize="8">{t('90° Parallel Depth')}</text>

            {/* Fixed Shoes on Floor with 15°-30° Flare */}
            <rect x="125" y="172" width="22" height="6" rx="2" fill="#3b82f6" transform="rotate(-15, 135, 175)" />
            <rect x="175" y="172" width="22" height="6" rx="2" fill="#3b82f6" transform="rotate(15, 185, 175)" />
            <text x="160" y="188" fill="#38bdf8" fontSize="8" textAnchor="middle">{t('15°-30° Shoe Flare')}</text>

            {/* ANIMATED SQUATTING LIFTER & BARBELL */}
            <g className="squat-anim">
              {/* Lower Body: Shins & Thighs */}
              <polyline points="135,170 125,135 155,115" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="185,170 195,135 165,115" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

              {/* Upright Torso at 70° */}
              <line x1="160" y1="115" x2="160" y2="65" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
              <circle cx="160" cy="52" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

              {/* Barbell Across Traps */}
              <line x1="95" y1="62" x2="225" y2="62" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
              <rect x="100" y="47" width="8" height="30" rx="2" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
              <rect x="212" y="47" width="8" height="30" rx="2" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />

              {/* Hands gripping bar */}
              <polyline points="155,65 140,62" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
              <polyline points="165,65 180,62" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            </g>

            <g transform="translate(15, 20)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 90° Parallel Depth')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ 15°-30° Shoe Flare')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ Do not let the knees cave in')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('90° Parallel Knee Depth & 15°-30° Shoe Angle')}
            </span>
          </div>
        </div>
      );
    }

    // 12. BARBELL BICEP CURL (Strict Pinned Elbows)
    if (guide.id === 'barbell_bicep_curl') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('Barbell Bicep Curl') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes curlBarAnim {
                  0%, 100% { transform: translate(0px, 0px); }
                  50% { transform: translate(-8px, -36px); }
                }
                .curl-anim {
                  animation: ${isPressing ? 'curlBarAnim 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

            {/* Standing Lifter */}
            <polyline points="155,125 145,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <polyline points="165,125 175,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="135" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <rect x="170" y="172" width="18" height="6" rx="2" fill="#3b82f6" />
            <line x1="160" y1="125" x2="160" y2="70" stroke="#e2e8f0" strokeWidth="15" strokeLinecap="round" />
            <circle cx="160" cy="56" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* Pinned Elbow Marker at Ribs */}
            <circle cx="150" cy="95" r="5" fill="#10b981" />
            <text x="100" y="98" fill="#34d399" fontSize="8" fontWeight="bold">{t('Pinned Elbows')}</text>

            {/* ANIMATED BARBELL CURL */}
            <g className="curl-anim">
              <polyline points="152,75 150,95 165,130" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Barbell in hands */}
              <line x1="135" y1="130" x2="195" y2="130" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
              <rect x="135" y="120" width="5" height="20" rx="2" fill="#ef4444" />
              <rect x="195" y="120" width="5" height="20" rx="2" fill="#ef4444" />
            </g>

            <g transform="translate(195, 115)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ Pinned Elbows (No Swing)')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('✅ Peak Bicep Squeeze')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ No jerking with the back')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('Freeze the Elbows and Pull with the Bicep')}
            </span>
          </div>
        </div>
      );
    }

    // 13. EZ-BAR SKULLCRUSHERS (75° Backward Slant for Long Head Triceps)
    if (guide.id === 'ez_bar_skullcrushers') {
      return (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <Activity size={14} className={isPressing ? 'animate-pulse text-emerald-400' : 'text-slate-500'} />
              <span>{isPressing ? `🏋️‍♂️ ${t('Lifter In Action ({name})', { name: t('75° Slant Skullcrushers') })}` : `⏸️ ${t('Motion Paused')}`}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 border border-slate-700"
            >
              {isPressing ? <Pause size={10} /> : <Play size={10} />}
              <span>{isPressing ? t('Pause') : t('Play')}</span>
            </button>
          </div>

          <svg width="100%" height="185" viewBox="0 0 340 195" className="overflow-visible select-none">
            <style>
              {`
                @keyframes skullcrushAnim {
                  0%, 100% { transform: translate(0px, 0px); }
                  50% { transform: translate(-14px, -24px); }
                }
                .skull-anim {
                  animation: ${isPressing ? 'skullcrushAnim 2.4s ease-in-out infinite' : 'none'};
                }
              `}
            </style>
            <line x1="20" y1="175" x2="320" y2="175" stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="85" y1="135" x2="235" y2="135" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
            <line x1="85" y1="135" x2="235" y2="135" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <line x1="105" y1="175" x2="105" y2="140" stroke="#475569" strokeWidth="6" />
            <line x1="215" y1="175" x2="215" y2="140" stroke="#475569" strokeWidth="6" />

            {/* Lifter Body on Bench */}
            <polyline points="110,130 80,140 80,175" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
            <rect x="70" y="172" width="22" height="6" rx="2" fill="#3b82f6" />
            <line x1="110" y1="130" x2="180" y2="130" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            <circle cx="210" cy="128" r="10" fill="#fbcfe8" stroke="#cbd5e1" strokeWidth="2" />

            {/* 75° Backward Slant Guideline */}
            <line x1="180" y1="130" x2="205" y2="75" stroke="#10b981" strokeWidth="2" />
            <text x="210" y="80" fill="#34d399" fontSize="9" fontWeight="bold">{t('75° Slant')}</text>

            {/* ANIMATED TRICEPS EXTENSION */}
            <g className="skull-anim">
              <polyline points="180,130 200,85 220,105" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              {/* EZ Bar */}
              <line x1="205" y1="105" x2="235" y2="105" stroke="#f8fafc" strokeWidth="3" />
              <rect x="202" y="97" width="5" height="16" rx="2" fill="#38bdf8" />
              <rect x="235" y="97" width="5" height="16" rx="2" fill="#38bdf8" />
            </g>

            <g transform="translate(15, 20)">
              <rect x="0" y="0" width="135" height="42" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x="6" y="14" fill="#10b981" fontSize="9" fontWeight="bold">{t('✅ 75° Backward Slant')}</text>
              <text x="6" y="26" fill="#38bdf8" fontSize="9">{t('Continuous Tricep Tension')}</text>
              <text x="6" y="37" fill="#f43f5e" fontSize="8">{t('❌ No 90° straight vertical')}</text>
            </g>
          </svg>

          <div className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {t('75° Backward Slant = Triceps Long Head Continuous Burn')}
            </span>
          </div>
        </div>
      );
    }

    // Default Fallback
    return null;
  };

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="angles-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[92dvh] flex flex-col z-10"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Compass size={18} />
            </div>
            <div>
              <h2 id="angles-modal-title" className="text-base font-bold text-gray-900 dark:text-slate-100">
                {t('Workout Angles & Biomechanics Guide')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('Correct bench incline, elbow tuck, and joint safety angles')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Top Muscle Group Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
            {(
              [
                { key: 'chest', label: '🔥 Chest (6 Games)' },
                { key: 'back', label: '🛡️ Back (2 Games)' },
                { key: 'shoulders', label: '⚡ Shoulders (2 Games)' },
                { key: 'legs', label: '🦵 Legs (1 Game)' },
                { key: 'arms', label: '💪 Arms (2 Games)' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleMuscleChange(tab.key)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedMuscle === tab.key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{t(tab.label)}</span>
              </button>
            ))}
          </div>

          {/* Exercise Quick Selector for Active Muscle */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
              {t('Select Exercise to View Precise Angles:')}
            </label>
            <div className="flex flex-wrap gap-2">
              {filteredExercises.map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExerciseId(ex.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    selectedExerciseId === ex.id
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                  }`}
                >
                  <Dumbbell size={13} className="shrink-0" />
                  <span>{t(ex.name)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Exercise Detail Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 space-y-4 shadow-xs">
            {/* Header & Target */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-200/60 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {t(activeExercise.primaryTarget)}
                </span>
                <h2 className="text-lg font-black text-gray-900 dark:text-slate-100 mt-1.5">
                  {t(activeExercise.name)}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t('Target: {degree}°', { degree: activeExercise.idealAngleDegree })}
                </span>
              </div>
            </div>

            {/* Visual Display Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDisplayMode('animated_biomechanics')}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
                  displayMode === 'animated_biomechanics'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('🏋️‍♂️ Animated Rep Motion & Live Angles (Lifter In Action)')}</span>
              </button>
              {activeExercise.comparisonImage && (
                <button
                  type="button"
                  onClick={() => setDisplayMode('real_comparison')}
                  className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
                    displayMode === 'real_comparison'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{t('🖼️ Right vs Wrong Photo (Real Lifter Infographic)')}</span>
                </button>
              )}
            </div>

            {/* REAL COMPARISON MODE: High-Res Infographic Photo + Sahi vs Ghalat Checklist */}
            {displayMode === 'real_comparison' && activeExercise.comparisonImage ? (
              <div className="space-y-4">
                {/* Comparison Image Container */}
                <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl group">
                  <img
                    src={activeExercise.comparisonImage}
                    alt={t('{name} Correct vs Wrong Form', { name: t(activeExercise.name) })}
                    className="w-full h-auto object-cover max-h-[360px] sm:max-h-[440px]"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/20">
                    {t('High-Res Biomechanics Comparison')}
                  </div>
                </div>

                {/* Sahi vs Ghalat Form Direct Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Sahi Tareeqa (Correct Execution) */}
                  <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/25 border-2 border-emerald-500/30 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm uppercase tracking-wide border-b border-emerald-500/20 pb-2">
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      <span>{t('Correct Form ✅')}</span>
                    </div>
                    <ul className="space-y-2 text-emerald-950 dark:text-emerald-200 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-black">✓</span>
                        <span><strong>{t('Bench Angle:')}</strong> {t(activeExercise.benchAngle || '0° Flat')} — {t('Directly targets the pectoral fibers.')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-black">✓</span>
                        <span><strong>{t('Elbows:')}</strong> {t(activeExercise.elbowAngle || '45° Arrowhead')} — {t('The rotator cuff stays completely safe.')}</span>
                      </li>
                      {activeExercise.bodyTorsoAngle && (
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-black">✓</span>
                          <span><strong>{t('Body Posture:')}</strong> {t(activeExercise.bodyTorsoAngle)}.</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-black">✓</span>
                        <span><strong>{t('Bar Path:')}</strong> {t('Touches the nipple line / lower sternum with control.')}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Ghalat Tareeqa (Wrong Execution / Injury Risk) */}
                  <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/25 border-2 border-rose-500/30 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black text-sm uppercase tracking-wide border-b border-rose-500/20 pb-2">
                      <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                      <span>{t('Wrong Form ❌')}</span>
                    </div>
                    <ul className="space-y-2 text-rose-950 dark:text-rose-200 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600 font-black">✗</span>
                        <span><strong>{t('Flared 90° Elbows:')}</strong> {t('Flaring the elbows out can pinch and tear the shoulder joint.')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600 font-black">✗</span>
                        <span><strong>{t('Steep 60° Angle:')}</strong> {t('Standing the bench upright switches off the chest and the shoulders lift all the weight.')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600 font-black">✗</span>
                        <span><strong>{t('Bouncing Bar:')}</strong> {t('Bouncing the barbell off the chest or dropping it toward the neck.')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-600 font-black">✗</span>
                        <span><strong>{t('Unstable Legs:')}</strong> {t('Moving the feet in the air or not planting them firmly on the floor.')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              /* ANIMATED BIOMECHANICS MODE */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual Animated Lifter Biomechanics Canvas */}
                {renderLifterVisual(activeExercise)}

                {/* Quick Angle Metrics Breakdown */}
                <div className="space-y-2.5 flex flex-col justify-center">
                  {activeExercise.benchAngle && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block">
                        {t('Bench Angle:')}
                      </span>
                      <span className="text-sm font-black text-gray-900 dark:text-slate-100">
                        {t(activeExercise.benchAngle)}
                      </span>
                    </div>
                  )}

                  {activeExercise.elbowAngle && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block">
                        {t('Elbow Tuck Angle:')}
                      </span>
                      <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                        {t(activeExercise.elbowAngle)}
                      </span>
                    </div>
                  )}

                  {activeExercise.bodyTorsoAngle && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block">
                        {t('Body & Torso Lean Angle:')}
                      </span>
                      <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                        {t(activeExercise.bodyTorsoAngle)}
                      </span>
                    </div>
                  )}

                  {activeExercise.wristGripAngle && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block">
                        {t('Wrist & Grip Alignment:')}
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {t(activeExercise.wristGripAngle)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Coach Explanation */}
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-900 dark:text-amber-300 text-xs leading-relaxed">
              <strong className="block font-black text-amber-950 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> {t('AI Coach Biomechanics Guide:')}
              </strong>
              {t(activeExercise.summary)}
            </div>

            {/* Safe Zone vs Danger Alert Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300 font-medium">
                <strong className="block font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">
                  {t(activeExercise.safeZoneText)}
                </strong>
                {t('The chest gets maximum stretch and pump, and the joints stay safe.')}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300 font-medium">
                <strong className="block font-bold text-rose-900 dark:text-rose-200 mb-0.5">
                  {t(activeExercise.dangerZoneText)}
                </strong>
                {t('The risk of shoulder rotator cuff and joint injury goes up.')}
              </div>
            </div>

            {/* Pro Form Checkpoints */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" /> {t('Correct Form & Angle Checkpoints:')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {activeExercise.proFormTips.map((tip, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{t(tip)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mistakes to Avoid */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} /> {t('Never Make These Mistakes:')}
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-400">
                {activeExercise.mistakesToAvoid.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold shrink-0">•</span>
                    <span>{t(m)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Close Button */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              {t('Close Angle Guide')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
