import type { PhotoMuscle } from './data';

/**
 * The muscle label and the how-to come in both languages (`muscleLabel` /
 * `muscleUrdu`, `howTo` / `howToUrdu`); show the one for the current language.
 * Every other text field is English and doubles as its `t()` key, with the
 * Roman Urdu in i18n/ur/fitness-exercises.ts.
 */
export interface GalleryPhoto {
  src: string;
  /** The variation shown; English, doubles as its `t()` key. */
  variant: string;
  phase?: 'Start position' | 'End position';
}

export interface ExercisePhotoItem {
  id: string;
  name: string;
  muscle: PhotoMuscle;
  muscleLabel: string;
  muscleUrdu: string;
  targetArea: string;
  image: string;
  /** More angles of the same game: start and end photo of each variation. */
  gallery: GalleryPhoto[];
  sets: string;
  reps: string;
  howTo: string;
  howToUrdu: string;
  goodFormTips: string[];
  mistakesToAvoid: string[];
}

/**
 * The start and end photo of each variation, kept in
 * public/exercises/gallery/<game>/<file>_0.jpg and _1.jpg. The photos come
 * from free-exercise-db (github.com/yuhonas/free-exercise-db, public domain).
 */
const angles = (game: string, variants: Record<string, string>): GalleryPhoto[] =>
  Object.entries(variants).flatMap(([file, variant]) =>
    (['Start position', 'End position'] as const).map((phase, i) => ({
      src: `/exercises/gallery/${game}/${file}_${i}.jpg`,
      variant,
      phase,
    }))
  );

export interface GameVariation {
  /** English, doubles as its `t()` key. */
  name: string;
  photos: GalleryPhoto[];
}

/**
 * A game's variations, each with its start and end photo side by side. The
 * main photo leads as a variation of its own unless it is one of the gallery's.
 */
export const gameVariations = (ex: ExercisePhotoItem): GameVariation[] => {
  const byName = new Map<string, GalleryPhoto[]>();
  for (const p of ex.gallery) byName.set(p.variant, [...(byName.get(p.variant) ?? []), p]);
  const variations = [...byName].map(([name, photos]) => ({ name, photos }));
  return ex.gallery.some(p => p.src === ex.image)
    ? variations
    : [{ name: 'Main Photo', photos: [{ src: ex.image, variant: ex.name }] }, ...variations];
};

/** The muscle tabs of the photo guide, shared by the workout tab and this modal. */
export const PHOTO_MUSCLE_TABS = [
  { key: 'chest', label: '🔥 Chest' },
  { key: 'back', label: '🛡️ Back' },
  { key: 'shoulders', label: '⚡ Shoulders' },
  { key: 'legs', label: '🦵 Legs' },
  { key: 'arms', label: '💪 Arms' },
  { key: 'abs', label: '🧱 Abs' },
] as const satisfies readonly { key: PhotoMuscle; label: string }[];

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
    gallery: angles('flat_bench', {
      'Barbell_Bench_Press_-_Medium_Grip': 'Barbell Bench Press - Medium Grip',
      'Wide-Grip_Barbell_Bench_Press': 'Wide-Grip Barbell Bench Press',
      'Dumbbell_Bench_Press': 'Dumbbell Bench Press',
      'Smith_Machine_Bench_Press': 'Smith Machine Bench Press',
    }),
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
    gallery: angles('incline_bench', {
      'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Barbell Incline Bench Press - Medium Grip',
      'Incline_Dumbbell_Press': 'Incline Dumbbell Press',
      'Smith_Machine_Incline_Bench_Press': 'Smith Machine Incline Bench Press',
      'Hammer_Grip_Incline_DB_Bench_Press': 'Hammer Grip Incline DB Bench Press',
    }),
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
    gallery: angles('dips', {
      'Dips_-_Chest_Version': 'Dips - Chest Version',
      'Parallel_Bar_Dip': 'Parallel Bar Dip',
      'Dip_Machine': 'Dip Machine',
      'Ring_Dips': 'Ring Dips',
    }),
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
    gallery: angles('cable_flyes', {
      'Cable_Crossover': 'Cable Crossover',
      'Low_Cable_Crossover': 'Low Cable Crossover',
      'Flat_Bench_Cable_Flyes': 'Flat Bench Cable Flyes',
      'Incline_Cable_Flye': 'Incline Cable Flye',
    }),
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
    gallery: angles('deadlift', {
      'Barbell_Deadlift': 'Barbell Deadlift',
      'Sumo_Deadlift': 'Sumo Deadlift',
      'Romanian_Deadlift': 'Romanian Deadlift',
      'Trap_Bar_Deadlift': 'Trap Bar Deadlift',
    }),
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
    gallery: angles('lat_pulldown', {
      'Wide-Grip_Lat_Pulldown': 'Wide-Grip Lat Pulldown',
      'Close-Grip_Front_Lat_Pulldown': 'Close-Grip Front Lat Pulldown',
      'V-Bar_Pulldown': 'V-Bar Pulldown',
      'Underhand_Cable_Pulldowns': 'Underhand Cable Pulldowns',
    }),
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
    gallery: angles('bent_over_row', {
      'Bent_Over_Barbell_Row': 'Bent Over Barbell Row',
      'Reverse_Grip_Bent-Over_Rows': 'Reverse Grip Bent-Over Rows',
      'Bent_Over_Two-Dumbbell_Row': 'Bent Over Two-Dumbbell Row',
      'One-Arm_Dumbbell_Row': 'One-Arm Dumbbell Row',
    }),
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
    gallery: angles('overhead_press', {
      'Standing_Military_Press': 'Standing Military Press',
      'Seated_Barbell_Military_Press': 'Seated Barbell Military Press',
      'Dumbbell_Shoulder_Press': 'Dumbbell Shoulder Press',
      'Arnold_Dumbbell_Press': 'Arnold Dumbbell Press',
    }),
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
    gallery: angles('lateral_raise', {
      'Side_Lateral_Raise': 'Side Lateral Raise',
      'Seated_Side_Lateral_Raise': 'Seated Side Lateral Raise',
      'Cable_Seated_Lateral_Raise': 'Cable Seated Lateral Raise',
      'One-Arm_Incline_Lateral_Raise': 'One-Arm Incline Lateral Raise',
    }),
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
    gallery: angles('barbell_squats', {
      'Barbell_Squat': 'Barbell Squat',
      'Barbell_Full_Squat': 'Barbell Full Squat',
      'Front_Barbell_Squat': 'Front Barbell Squat',
      'Goblet_Squat': 'Goblet Squat',
    }),
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
    gallery: angles('leg_press', {
      'Leg_Press': 'Leg Press',
      'Narrow_Stance_Leg_Press': 'Narrow Stance Leg Press',
      'Smith_Machine_Leg_Press': 'Smith Machine Leg Press',
      'Hack_Squat': 'Hack Squat',
    }),
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
    gallery: angles('bicep_curl', {
      'Barbell_Curl': 'Barbell Curl',
      'Dumbbell_Bicep_Curl': 'Dumbbell Bicep Curl',
      'Hammer_Curls': 'Hammer Curls',
      'EZ-Bar_Curl': 'EZ-Bar Curl',
    }),
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
    gallery: angles('tricep_pushdown', {
      'Triceps_Pushdown_-_Rope_Attachment': 'Triceps Pushdown - Rope Attachment',
      'Triceps_Pushdown': 'Triceps Pushdown',
      'Triceps_Pushdown_-_V-Bar_Attachment': 'Triceps Pushdown - V-Bar Attachment',
      'Reverse_Grip_Triceps_Pushdown': 'Reverse Grip Triceps Pushdown',
    }),
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

  // ABS
  {
    id: 'crunches',
    name: 'Crunches',
    muscle: 'abs',
    muscleLabel: 'Upper Abs (Six Pack)',
    muscleUrdu: 'Pait ke Oopri Muscles (Six Pack)',
    targetArea: 'Upper Abs & Rectus Abdominis',
    image: '/exercises/gallery/crunches/Crunches_1.jpg',
    gallery: angles('crunches', {
      'Crunches': 'Crunches',
      'Weighted_Crunches': 'Weighted Crunches',
      'Cable_Crunch': 'Cable Crunch',
      'Decline_Crunch': 'Decline Crunch',
      'Oblique_Crunches_-_On_The_Floor': 'Oblique Crunches - On The Floor',
    }),
    sets: '3 Sets',
    reps: '15-20 Reps',
    howTo: 'Lie on your back with the knees bent, and curl the shoulders off the floor by squeezing the abs, not by pulling the neck.',
    howToUrdu: 'Kamar ke bal let kar ghutne mor lein, aur gardan kheenchne ke bajaye pait ko squeeze kar ke kandhay zameen se oopar uthayein.',
    goodFormTips: [
      'Keep the lower back pressed into the floor the whole time.',
      'Breathe out as you come up and squeeze the abs for 1 second at the top.',
      'Keep a fist of space between the chin and the chest.',
    ],
    mistakesToAvoid: [
      'Pulling the head up with the hands, which strains the neck.',
      'Swinging up with momentum instead of the abs.',
    ],
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    muscle: 'abs',
    muscleLabel: 'Lower Abs',
    muscleUrdu: 'Pait ke Nichle Muscles (Lower Abs)',
    targetArea: 'Lower Abs & Hip Flexors',
    image: '/exercises/gallery/hanging_leg_raise/Hanging_Leg_Raise_1.jpg',
    gallery: angles('hanging_leg_raise', {
      'Hanging_Leg_Raise': 'Hanging Leg Raise',
      'Flat_Bench_Lying_Leg_Raise': 'Flat Bench Lying Leg Raise',
      'Reverse_Crunch': 'Reverse Crunch',
      'Decline_Reverse_Crunch': 'Decline Reverse Crunch',
      'Flutter_Kicks': 'Flutter Kicks',
    }),
    sets: '3 Sets',
    reps: '10-15 Reps',
    howTo: 'Hang from the pull-up bar and raise the legs up by curling the hips toward the chest, then lower them slowly.',
    howToUrdu: 'Pull-up bar se latak kar hips ko seenay ki taraf mor kar taangein oopar uthayein, phir aahista niche layein.',
    goodFormTips: [
      'Tilt the pelvis up at the top so the lower abs do the work.',
      'Lower the legs slowly in 2-3 seconds without swinging.',
      'Beginners can start with bent knees.',
    ],
    mistakesToAvoid: [
      'Swinging the whole body back and forth.',
      'Only lifting the legs to 90° without curling the hips.',
    ],
  },
  {
    id: 'plank',
    name: 'Plank & Core Stability',
    muscle: 'abs',
    muscleLabel: 'Full Core',
    muscleUrdu: 'Poora Core (Pait aur Kamar)',
    targetArea: 'Deep Core, Obliques & Lower Back',
    image: '/exercises/gallery/plank/Plank_1.jpg',
    gallery: angles('plank', {
      'Plank': 'Plank',
      'Push_Up_to_Side_Plank': 'Push Up to Side Plank',
      'Ab_Roller': 'Ab Roller',
      'Barbell_Ab_Rollout_-_On_Knees': 'Barbell Ab Rollout - On Knees',
      'Russian_Twist': 'Russian Twist',
    }),
    sets: '3 Sets',
    reps: '30-60 Seconds',
    howTo: 'Rest on the forearms and toes and hold the body in one straight line from head to heels while squeezing the abs and glutes.',
    howToUrdu: 'Forearms aur panjon par tik kar sar se aeriyon tak jism ko aik seedhi line mein rakhein aur pait aur hips ko squeeze kar ke hold karein.',
    goodFormTips: [
      'Keep the elbows directly under the shoulders.',
      'Squeeze the glutes and abs so the hips stay level.',
      'Keep breathing normally; do not hold your breath.',
    ],
    mistakesToAvoid: [
      'Letting the hips sag down, which loads the lower back.',
      'Pushing the hips too high into the air.',
    ],
  },
];
