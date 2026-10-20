export type CalcTab = 'diet' | 'supplements_routine' | 'workout_split' | 'ai_advisor' | 'meal_plan';

export interface MacroResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  proteinCalories: number;
  proteinRatio: number;
  carbsGrams: number;
  carbsCalories: number;
  fatGrams: number;
  fatCalories: number;
  waterLiters: number;
  waterGlasses: number;
  bmi: number;
  bmiCategory: string;
  bmiColor: string;
}

export interface OneRmResult {
  oneRm: number;
  strengthLevel: string;
  bwRatio: number;
  strengthSet: { weight: number; reps: string; percentage: number };
  hypertrophySet: { weight: number; reps: string; percentage: number };
  enduranceSet: { weight: number; reps: string; percentage: number };
}

export interface GainerProfile {
  id: string;
  name: string;
  brand: string;
  type: 'mass_gainer' | 'lean_gainer' | 'whey';
  fullCalories: number;
  fullProtein: number;
  fullCarbs: number;
  features: string;
  bestFor: string;
  doseRecommendation: string;
}

export const POPULAR_GAINERS: Record<string, GainerProfile> = {
  none: {
    id: 'none',
    name: 'None (Natural Whole Foods Only)',
    brand: 'N/A',
    type: 'whey',
    fullCalories: 0,
    fullProtein: 0,
    fullCarbs: 0,
    features: 'Whole eggs, chicken, milk, beef, daal, rice.',
    bestFor: 'Lifters getting all nutrition from whole food.',
    doseRecommendation: 'Focus on 4-5 balanced whole meals.',
  },
  anabolic_mass: {
    id: 'anabolic_mass',
    name: 'Anabolic Mass',
    brand: 'Kevin Levrone Signature Series',
    type: 'mass_gainer',
    fullCalories: 1070,
    fullProtein: 48,
    fullCarbs: 216,
    features: 'Enriched with DAA, Fenugreek, Tribulus, Creatine & L-Arginine for natural testosterone support.',
    bestFor: 'Hardgainers, skinny body types, fast metabolism needing quick size & strength.',
    doseRecommendation: '1 Scoop (Half serving) between breakfast & lunch, 1 Scoop post-workout.',
  },
  serious_mass: {
    id: 'serious_mass',
    name: 'Serious Mass',
    brand: 'Optimum Nutrition (ON)',
    type: 'mass_gainer',
    fullCalories: 1250,
    fullProtein: 50,
    fullCarbs: 252,
    features: 'High calorie complex carbs blend, 25 vitamins & minerals, glutamine and creatine.',
    bestFor: 'Maximum weight gain, heavy bulking phase.',
    doseRecommendation: 'Start with 1 scoop (half serving) daily with 500ml milk/water to assess digestion.',
  },
  carnivor_mass: {
    id: 'carnivor_mass',
    name: 'Carnivor Beef Mass',
    brand: 'MuscleMeds',
    type: 'lean_gainer',
    fullCalories: 720,
    fullProtein: 50,
    fullCarbs: 125,
    features: '100% Hydrolyzed Beef Protein Isolate. 0% Lactose, 0% Sugar, 0% Cholesterol, 5g Creatine.',
    bestFor: 'Clean lean mass gain without stomach bloating, lactose-intolerant lifters.',
    doseRecommendation: '1 Full scoop post-workout with 400ml cold water.',
  },
  super_mass: {
    id: 'super_mass',
    name: 'Super Mass Gainer',
    brand: 'Dymatize',
    type: 'mass_gainer',
    fullCalories: 1280,
    fullProtein: 52,
    fullCarbs: 246,
    features: 'Rich in BCAAs, digestive enzyme blend (Zytrix) for smooth digestion.',
    bestFor: 'High calorie bulking for tall or ectomorph athletes.',
    doseRecommendation: '1 Scoop post-workout or as mid-day meal supplement.',
  },
  whey_gold: {
    id: 'whey_gold',
    name: '100% Whey Gold Standard / ISO',
    brand: 'Optimum Nutrition / Dymatize',
    type: 'whey',
    fullCalories: 120,
    fullProtein: 24,
    fullCarbs: 3,
    features: 'Pure Whey Isolate & Concentrate, ultra-fast absorbing, lean muscle repair.',
    bestFor: 'Lean bulking, fat loss, cutting without unwanted fat or calories.',
    doseRecommendation: '1 Scoop post-workout with water.',
  },
};

export type Gender = 'male' | 'female';
export type Goal = 'cut_aggressive' | 'cut_moderate' | 'maintenance' | 'bulk_lean' | 'bulk_aggressive';
export type DietPreference = 'pakistani_desi' | 'high_protein_bodybuilding' | 'budget_friendly' | 'vegetarian';
export type Muscle = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms';

export interface AiAnswer { question: string; answer: string; tag: string }

export interface AiDietGuidance {
  strategy: string;
  morningMeal: string;
  lunchMeal: string;
  preWorkout: string;
  postWorkout: string;
  dinnerMeal: string;
  supplements: string[];
  avoidList: string[];
}

export interface MealSlot {
  name: string;
  time: string;
  portion: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  foodIdea: string;
}

export interface WorkoutSplitDay {
  day: string;
  tag: string;
  gamesCount: string;
  exercises: Array<{
    name: string;
    sets: string;
    reps: string;
    tip: string;
    photoId?: string;
    photoMuscle?: Muscle;
    angleId?: string;
    angleBadge?: string;
    angleMuscle?: Muscle;
  }>;
  intensity: string;
}

// 5-Day Hypertrophy "Games" / Workout Routine (Specially designed for Mass Gainers & Strength)
export const WORKOUT_SPLIT_DAYS: WorkoutSplitDay[] = [
  {
    day: 'Day 1: Chest & Triceps (Heavy Push)',
    tag: 'Upper Body',
    gamesCount: '5 Games / Exercises',
    exercises: [
      {
        name: 'Flat Barbell Bench Press',
        sets: '4 sets',
        reps: '6-8 reps (Heavy)',
        tip: 'Chest expansion & strength',
        photoId: 'flat_bench',
        photoMuscle: 'chest',
        angleId: 'flat_bench_press',
        angleBadge: '📐 0° Bench · 45° Elbows',
        angleMuscle: 'chest',
      },
      {
        name: 'Incline Dumbbell Press',
        sets: '3 sets',
        reps: '8-10 reps',
        tip: 'Upper chest shelf build',
        photoId: 'incline_bench',
        photoMuscle: 'chest',
        angleId: 'incline_bench_press',
        angleBadge: '📐 30°-45° Incline (Upper Chest)',
        angleMuscle: 'chest',
      },
      {
        name: 'Dips (Weighted if possible)',
        sets: '3 sets',
        reps: '10-12 reps',
        tip: 'Lower chest & tricep power',
        photoId: 'dips',
        photoMuscle: 'chest',
        angleId: 'chest_dips',
        angleBadge: '📐 30° Torso Forward Lean',
        angleMuscle: 'chest',
      },
      {
        name: 'Cable Chest Flyes',
        sets: '3 sets',
        reps: '12-15 reps (Squeeze)',
        tip: 'Chest pump & blood flow',
        photoId: 'cable_flyes',
        photoMuscle: 'chest',
        angleId: 'cable_crossover',
        angleBadge: '📐 45° Downward Arc',
        angleMuscle: 'chest',
      },
      {
        name: 'Rope Tricep Pushdowns',
        sets: '4 sets',
        reps: '10-12 reps',
        tip: 'Tricep horseshoe pump',
        photoId: 'tricep_pushdown',
        photoMuscle: 'arms',
      },
    ],
    intensity: 'Heavy Compound Lift. Pre-workout 25 min pehle len!',
  },
  {
    day: 'Day 2: Back & Biceps (Heavy Pull & Lats)',
    tag: 'Pull Power',
    gamesCount: '5 Games / Exercises',
    exercises: [
      { name: 'Deadlifts (Conventional)', sets: '4 sets', reps: '5-6 reps', tip: 'Spine & trap thickness', photoId: 'deadlift', photoMuscle: 'back' },
      { name: 'Wide Grip Lat Pulldown', sets: '4 sets', reps: '8-10 reps', tip: 'V-Taper back width', photoId: 'lat_pulldown', photoMuscle: 'back' },
      {
        name: 'Bent-Over Barbell Row',
        sets: '3 sets',
        reps: '8-10 reps',
        tip: 'Middle back density',
        photoId: 'bent_over_row',
        photoMuscle: 'back',
        angleId: 'bent_over_barbell_row',
        angleBadge: '📐 45°-70° Torso Hinge',
        angleMuscle: 'back',
      },
      { name: 'Seated Cable Row', sets: '3 sets', reps: '10-12 reps', tip: 'Lats contraction', photoId: 'bent_over_row', photoMuscle: 'back' },
      { name: 'Barbell Bicep Curls', sets: '4 sets', reps: '8-10 reps', tip: 'Bicep peak & mass', photoId: 'bicep_curl', photoMuscle: 'arms' },
    ],
    intensity: 'High calorie burn day. Post-workout Mass Gainer foran len!',
  },
  {
    day: 'Day 3: Shoulders & Abs (Boulders & Core)',
    tag: 'Delts & Core',
    gamesCount: '5 Games / Exercises',
    exercises: [
      { name: 'Overhead Barbell Military Press', sets: '4 sets', reps: '6-8 reps', tip: 'Front delt power', photoId: 'overhead_press', photoMuscle: 'shoulders' },
      {
        name: 'Dumbbell Lateral Raises (Side)',
        sets: '4 sets',
        reps: '12-15 reps',
        tip: 'Shoulder width & 3D look',
        photoId: 'lateral_raise',
        photoMuscle: 'shoulders',
        angleId: 'dumbbell_lateral_raise',
        angleBadge: '📐 15°-30° Scapular Plane',
        angleMuscle: 'shoulders',
      },
      { name: 'Face Pulls / Rear Delt Flyes', sets: '4 sets', reps: '15 reps', tip: 'Shoulder posture & rear head', photoId: 'lateral_raise', photoMuscle: 'shoulders' },
      { name: 'Dumbbell Shrugs', sets: '3 sets', reps: '12 reps', tip: 'Traps growth', photoId: 'deadlift', photoMuscle: 'back' },
      { name: 'Hanging Leg Raises', sets: '3 sets', reps: '15 reps', tip: 'Lower abs control', photoId: 'barbell_squats', photoMuscle: 'legs' },
    ],
    intensity: 'Moderate weight with strict form for rounded 3D delts.',
  },
  {
    day: 'Day 4: Legs & Calves (Mass Builder)',
    tag: 'Lower Body',
    gamesCount: '5 Games / Exercises',
    exercises: [
      {
        name: 'Barbell Back Squats',
        sets: '4 sets',
        reps: '6-8 reps',
        tip: 'Ultimate natural testosterone booster',
        photoId: 'barbell_squats',
        photoMuscle: 'legs',
        angleId: 'barbell_back_squat',
        angleBadge: '📐 15°-30° Shoe Flare',
        angleMuscle: 'legs',
      },
      { name: 'Leg Press Machine', sets: '4 sets', reps: '10-12 reps (Heavy)', tip: 'Quad sweep & bulk', photoId: 'leg_press', photoMuscle: 'legs' },
      { name: 'Romanian Deadlift (Hamstrings)', sets: '3 sets', reps: '8-10 reps', tip: 'Hamstrings & glutes stretch', photoId: 'deadlift', photoMuscle: 'back' },
      { name: 'Leg Extensions', sets: '3 sets', reps: '15 reps (Burnout)', tip: 'Quad separation', photoId: 'leg_press', photoMuscle: 'legs' },
      { name: 'Standing Calf Raises', sets: '4 sets', reps: '15-20 reps', tip: 'Calf muscle volume', photoId: 'barbell_squats', photoMuscle: 'legs' },
    ],
    intensity: 'Sab se zyada calorie burn hoti ha. Extra water & Mass Gainer zaroor len.',
  },
  {
    day: 'Day 5: Arms Special (Biceps & Triceps Blast)',
    tag: 'Arm Size',
    gamesCount: '5 Games / Exercises',
    exercises: [
      { name: 'Incline Dumbbell Bicep Curls', sets: '3 sets', reps: '10 reps', tip: 'Full bicep stretch', photoId: 'bicep_curl', photoMuscle: 'arms' },
      { name: 'EZ-Bar Skullcrushers', sets: '3 sets', reps: '8-10 reps', tip: 'Tricep long head mass', photoId: 'tricep_pushdown', photoMuscle: 'arms' },
      { name: 'Hammer Curls (Dumbbell)', sets: '3 sets', reps: '10 reps', tip: 'Brachialis & forearm thickness', photoId: 'bicep_curl', photoMuscle: 'arms' },
      { name: 'Overhead Cable Tricep Extension', sets: '3 sets', reps: '12 reps', tip: 'Elbow safety & stretch', photoId: 'tricep_pushdown', photoMuscle: 'arms' },
      { name: 'Preacher Curls / Concentration Curls', sets: '3 sets', reps: '12 reps', tip: 'Peak pump finish', photoId: 'bicep_curl', photoMuscle: 'arms' },
    ],
    intensity: 'High rep supersets for maximum blood pump & arm growth.',
  },
];
