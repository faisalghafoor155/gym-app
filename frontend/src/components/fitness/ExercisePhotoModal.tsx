import { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Dumbbell, Image as ImageIcon, Sparkles, Layers
} from 'lucide-react';
import { closeDialog, useDialog } from '../../hooks/useDialog';
import { useLanguage } from '../../context/LanguageContext';
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExerciseId?: string;
  initialMuscle?: PhotoMuscle;
}

export default function ExercisePhotoModal({
  isOpen,
  onClose,
  initialExerciseId,
  initialMuscle = 'chest',
}: Props) {
  const { lang, t } = useLanguage();
  const [selectedMuscle, setSelectedMuscle] = useState<PhotoMuscle>(initialMuscle);
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

  // The variation shown within the game; it goes back to the first one when the game changes.
  const [shownVariation, setShownVariation] = useState({ id: '', index: 0 });
  const variations = gameVariations(activeExercise);
  const variationIndex = shownVariation.id === activeExercise.id ? shownVariation.index : 0;
  const activeVariation = variations[variationIndex] ?? variations[0]!;
  const showVariation = (index: number) =>
    setShownVariation({ id: activeExercise.id, index: (index + variations.length) % variations.length });

  const handleMuscleChange = (muscle: PhotoMuscle) => {
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
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={() => closeDialog(dialogRef.current, onClose)} aria-hidden="true" />
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
            onClick={() => closeDialog(dialogRef.current, onClose)}
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
            {PHOTO_MUSCLE_TABS.map(tab => (
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
                className={`py-1 pl-1 pr-3 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${
                  selectedExerciseId === ex.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-gray-300'
                }`}
              >
                <img src={ex.image} alt="" loading="lazy" className="w-5 h-5 rounded-full object-cover bg-white shrink-0" />
                <span>{t(ex.name)}</span>
              </button>
            ))}
          </div>

          {/* MAIN PHOTO DISPLAY CARD: the variation's start and end photo side by side */}
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-blue-400 truncate">
                  {t('Game:')} {t(activeExercise.name)}
                </span>
                <h3 className="text-sm sm:text-base font-black text-white truncate">{t(activeVariation.name)}</h3>
              </div>
              <span className="shrink-0 bg-emerald-600/90 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5">
                <Dumbbell size={13} />
                <span>{t(activeExercise.sets)} · {t(activeExercise.reps)}</span>
              </span>
            </div>

            <div className="relative p-3">
              <div
                key={`${activeExercise.id}:${activeVariation.name}`}
                className={`relative grid gap-3 animate-fade-in ${activeVariation.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                {activeVariation.photos.length > 1 && (
                  <span
                    className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-slate-900 shadow-lg"
                    aria-hidden="true"
                  >
                    <ChevronRight size={20} />
                  </span>
                )}
                {activeVariation.photos.map((p, i) => (
                  <figure
                    key={p.src}
                    className={`relative rounded-xl overflow-hidden ${p.phase ? 'bg-white' : 'bg-slate-950'}`}
                  >
                    <img
                      src={p.src}
                      alt={p.phase ? `${t(activeVariation.name)} · ${t(p.phase)}` : t(activeExercise.name)}
                      className={`w-full object-contain select-none ${p.phase ? 'aspect-[4/3]' : 'h-64 sm:h-[400px]'}`}
                      loading="eager"
                    />
                    {p.phase && (
                      <figcaption className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg bg-black/75 text-white backdrop-blur-xs">
                        <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-black">{i + 1}</span>
                        {t(p.phase)}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>

              {variations.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => showVariation(variationIndex - 1)}
                    aria-label={t('Previous Variation')}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-blue-600 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showVariation(variationIndex + 1)}
                    aria-label={t('Next Variation')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-blue-600 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3 text-[11px] text-slate-300">
              <span className="font-bold text-white shrink-0">
                {t('Variation {n} of {total}', { n: variationIndex + 1, total: variations.length })}
              </span>
              <span className="truncate">{t('Target: {area}', { area: t(activeExercise.targetArea) })}</span>
            </div>
          </div>

          {/* Every variation of this game, each one separate */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-700 dark:text-slate-300 mb-2">
              <Layers size={14} className="text-blue-600 dark:text-blue-400" />
              {t('Variations ({count})', { count: variations.length })}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {variations.map((v, i) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => showVariation(i)}
                  aria-pressed={i === variationIndex}
                  className={`group text-left rounded-xl overflow-hidden border-2 bg-white dark:bg-slate-800 transition ${
                    i === variationIndex
                      ? 'border-blue-600 shadow-md shadow-blue-500/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className={`relative aspect-[4/3] bg-white overflow-hidden grid ${v.photos.length > 1 ? 'grid-cols-2 gap-px bg-gray-200' : ''}`}>
                    {v.photos.map(p => (
                      <img
                        key={p.src}
                        src={p.src}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover bg-white select-none group-hover:scale-105 transition duration-300"
                      />
                    ))}
                    {v.photos.length > 1 && (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-2 ring-white" aria-hidden="true">
                        <ChevronRight size={12} />
                      </span>
                    )}
                    <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center ${
                      i === variationIndex ? 'bg-blue-600' : 'bg-black/70'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                  <span className="block px-2 py-1.5 text-[11px] font-bold leading-tight text-gray-800 dark:text-slate-200 line-clamp-2">
                    {t(v.name)}
                  </span>
                </button>
              ))}
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
            onClick={() => closeDialog(dialogRef.current, onClose)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            {t('Close Photo')}
          </button>
        </div>
      </div>
    </div>
  );
}
