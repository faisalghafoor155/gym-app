import { useState, useId } from 'react';
import {
  Calculator, Flame, Dumbbell, Droplets,
  Scale, Sparkles, Copy, Check, Info, Award,
  Activity, Zap, Bot, Package, Clock, ShieldAlert,
  AlertCircle, Send, HelpCircle, CheckCircle2, ChevronRight,
  Calendar, Layers, Dumbbell as WorkoutIcon
} from 'lucide-react';
import {
  Page, PageHeader, Card, SegmentedControl, FieldLabel,
  inputClass, secondaryButton,
} from '../components/ui';
import toast from 'react-hot-toast';

type CalcTab = 'diet' | 'supplements_routine' | 'workout_split' | 'ai_advisor' | 'meal_plan';

interface MacroResult {
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

interface OneRmResult {
  oneRm: number;
  strengthLevel: string;
  bwRatio: number;
  strengthSet: { weight: number; reps: string; percentage: number };
  hypertrophySet: { weight: number; reps: string; percentage: number };
  enduranceSet: { weight: number; reps: string; percentage: number };
}

interface GainerProfile {
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

const POPULAR_GAINERS: Record<string, GainerProfile> = {
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

export default function FitnessCalculator() {
  const [tab, setTab] = useState<CalcTab>('diet');

  // Input states for Diet & Calorie Calculator
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [weightKg, setWeightKg] = useState<number>(70);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [age, setAge] = useState<number>(25);
  const [activityLevel, setActivityLevel] = useState<number>(1.55); // Moderate (3-5 days gym)
  const [goal, setGoal] = useState<'cut_aggressive' | 'cut_moderate' | 'maintenance' | 'bulk_lean' | 'bulk_aggressive'>('bulk_lean');
  const [dietPreference, setDietPreference] = useState<'pakistani_desi' | 'high_protein_bodybuilding' | 'budget_friendly' | 'vegetarian'>('pakistani_desi');
  const [copiedPlan, setCopiedPlan] = useState(false);

  // Supplement Stack States
  const [selectedGainer, setSelectedGainer] = useState<string>('anabolic_mass');
  const [gainerServing, setGainerServing] = useState<'half' | 'full'>('half');
  const [takingPreworkout, setTakingPreworkout] = useState<boolean>(true);
  const [takingCreatine, setTakingCreatine] = useState<boolean>(true);

  // Input states for Workout & 1RM Calculator
  const [exercise, setExercise] = useState<string>('bench_press');
  const [liftWeight, setLiftWeight] = useState<number>(60);
  const [liftReps, setLiftReps] = useState<number>(8);

  // AI Chat Q&A State
  const [userQuery, setUserQuery] = useState('');
  const [aiAnswers, setAiAnswers] = useState<Array<{ question: string; answer: string; tag: string }>>([
    {
      question: 'Anabolic Mass ya Serious Mass k sath pet (belly fat) nikalne se kaise bachein?',
      answer: 'Bohat ahem sawal! Mass Gainer me 1000+ calories hoti hain. Agar aap uske sath ghar me 4-4 parathay aur meetha bhi khayenge to calorie surplus zyadah hone se pet nikal aayega. Iska behtareen hal ha: Gainer ki "Half Serving" (1 scoop) lein, junk food band karein, aur gym me heavy compound exercises (Squats, Deadlifts, Bench Press) karein taake calories muscle me lagien!',
      tag: 'Mass Gainer',
    },
    {
      question: 'Pre-workout aur Creatine dono ek sath le saktay hain?',
      answer: 'Jee haan! Pre-workout workout se 20-30 minute pehle focus aur pump ke liye lia jata ha, jabke Creatine 5g rozana muscles ki ATP energy aur taqat barhata ha. Creatine aap pre-workout me mix kar ke b le saktay hain ya workout ke foran baad gainer ke sath b le saktay hain.',
      tag: 'Stack',
    },
    {
      question: 'Mass gainer lene se liver ya kidney par bojh parta ha?',
      answer: 'Mass gainer sirf carbs aur milk protein ka powder ha. Agar aap rozana 3.5 se 4 Liter paani piyenge to digestion bilkul saaf rahegi aur kidney par koi bojh nahi parega. Kam paani peenay se dehydration aur kabz (constipation) ho sakti ha.',
      tag: 'Hydration',
    },
  ]);

  const genderMaleId = useId();
  const genderFemaleId = useId();
  const weightInputId = useId();
  const heightInputId = useId();
  const ageInputId = useId();
  const activityInputId = useId();
  const goalInputId = useId();
  const dietPrefId = useId();
  const gainerSelectId = useId();
  const exerciseSelectId = useId();
  const liftWeightInputId = useId();
  const liftRepsInputId = useId();

  // Diet & Macro Calculation Logic
  const calculateMacros = (): MacroResult => {
    const w = Number(weightKg) || 70;
    const h = Number(heightCm) || 175;
    const a = Number(age) || 25;

    // BMR (Basal Metabolic Rate)
    const bmr = gender === 'male'
      ? Math.round(10 * w + 6.25 * h - 5 * a + 5)
      : Math.round(10 * w + 6.25 * h - 5 * a - 161);

    // TDEE (Total Daily Energy Expenditure)
    const tdee = Math.round(bmr * activityLevel);

    // Goal Calorie Adjustments
    let calorieOffset = 0;
    let proteinPerKg = 2.0;

    switch (goal) {
      case 'cut_aggressive':
        calorieOffset = -500;
        proteinPerKg = 2.3;
        break;
      case 'cut_moderate':
        calorieOffset = -300;
        proteinPerKg = 2.2;
        break;
      case 'maintenance':
        calorieOffset = 0;
        proteinPerKg = 1.8;
        break;
      case 'bulk_lean':
        calorieOffset = 300;
        proteinPerKg = 2.0;
        break;
      case 'bulk_aggressive':
        calorieOffset = 500;
        proteinPerKg = 2.0;
        break;
    }

    const targetCalories = Math.max(1200, tdee + calorieOffset);

    // Protein grams based on body weight
    const proteinGrams = Math.round(w * proteinPerKg);
    const proteinCalories = proteinGrams * 4;

    // Fat: 0.9g per kg body weight
    const fatGrams = Math.max(35, Math.round(w * 0.9));
    const fatCalories = fatGrams * 9;

    // Carbs
    const remainingCalories = Math.max(200, targetCalories - (proteinCalories + fatCalories));
    const carbsGrams = Math.round(remainingCalories / 4);
    const carbsCalories = carbsGrams * 4;

    // Extra hydration if taking Creatine or Mass Gainer
    const baseWater = (w * 35 + 750) / 1000;
    const extraWater = (takingCreatine ? 0.75 : 0) + (selectedGainer !== 'none' ? 0.5 : 0);
    const waterLiters = Number((baseWater + extraWater).toFixed(1));
    const waterGlasses = Math.round(waterLiters * 4);

    // BMI
    const heightM = h / 100;
    const bmi = Number((w / (heightM * heightM)).toFixed(1));
    let bmiCategory = 'Normal Weight';
    let bmiColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';

    if (bmi < 18.5) {
      bmiCategory = 'Underweight';
      bmiColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
    } else if (bmi >= 25 && bmi < 29.9) {
      bmiCategory = 'Overweight';
      bmiColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
    } else if (bmi >= 30) {
      bmiCategory = 'Obese';
      bmiColor = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
    }

    return {
      bmr,
      tdee,
      targetCalories,
      proteinGrams,
      proteinCalories,
      proteinRatio: proteinPerKg,
      carbsGrams,
      carbsCalories,
      fatGrams,
      fatCalories,
      waterLiters,
      waterGlasses,
      bmi,
      bmiCategory,
      bmiColor,
    };
  };

  // Workout 1RM Calculation Logic (Epley Formula)
  const calculateOneRm = (): OneRmResult => {
    const w = Number(liftWeight) || 0;
    const r = Math.min(12, Math.max(1, Number(liftReps) || 1));
    const userWeight = Number(weightKg) || 70;

    const oneRm = r === 1 ? w : Math.round(w * (1 + r / 30));
    const bwRatio = Number((oneRm / userWeight).toFixed(2));

    let strengthLevel = 'Beginner';
    if (exercise === 'bench_press') {
      if (bwRatio >= 1.5) strengthLevel = 'Elite / Advanced';
      else if (bwRatio >= 1.1) strengthLevel = 'Intermediate';
      else if (bwRatio >= 0.8) strengthLevel = 'Novice';
      else strengthLevel = 'Beginner';
    } else if (exercise === 'squat') {
      if (bwRatio >= 2.0) strengthLevel = 'Elite / Advanced';
      else if (bwRatio >= 1.4) strengthLevel = 'Intermediate';
      else if (bwRatio >= 1.0) strengthLevel = 'Novice';
      else strengthLevel = 'Beginner';
    } else if (exercise === 'deadlift') {
      if (bwRatio >= 2.2) strengthLevel = 'Elite / Advanced';
      else if (bwRatio >= 1.6) strengthLevel = 'Intermediate';
      else if (bwRatio >= 1.2) strengthLevel = 'Novice';
      else strengthLevel = 'Beginner';
    } else {
      if (bwRatio >= 0.9) strengthLevel = 'Elite / Advanced';
      else if (bwRatio >= 0.7) strengthLevel = 'Intermediate';
      else if (bwRatio >= 0.5) strengthLevel = 'Novice';
      else strengthLevel = 'Beginner';
    }

    return {
      oneRm,
      strengthLevel,
      bwRatio,
      strengthSet: { weight: Math.round(oneRm * 0.85), reps: '3-5 reps', percentage: 85 },
      hypertrophySet: { weight: Math.round(oneRm * 0.72), reps: '8-12 reps', percentage: 72 },
      enduranceSet: { weight: Math.round(oneRm * 0.55), reps: '15-20 reps', percentage: 55 },
    };
  };

  const macros = calculateMacros();
  const oneRm = calculateOneRm();
  const gainer = POPULAR_GAINERS[selectedGainer] ?? POPULAR_GAINERS.none!;

  // Gainer actual consumed metrics (Full vs Half serving)
  const gainerMultiplier = gainerServing === 'full' ? 1.0 : 0.5;
  const gainerCalories = Math.round(gainer.fullCalories * gainerMultiplier);
  const gainerProtein = Math.round(gainer.fullProtein * gainerMultiplier);
  const gainerCarbs = Math.round(gainer.fullCarbs * gainerMultiplier);

  // Remaining food needed from meals so user doesn't get over-fat!
  const foodCaloriesNeeded = Math.max(800, macros.targetCalories - gainerCalories);
  const foodProteinNeeded = Math.max(30, macros.proteinGrams - gainerProtein);

  // 5-Day Hypertrophy "Games" / Workout Routine (Specially designed for Mass Gainers & Strength)
  const workoutSplitDays = [
    {
      day: 'Day 1: Chest & Triceps (Heavy Push)',
      tag: 'Upper Body',
      gamesCount: '5 Games / Exercises',
      exercises: [
        { name: 'Flat Barbell Bench Press', sets: '4 sets', reps: '6-8 reps (Heavy)', tip: 'Chest expansion & strength' },
        { name: 'Incline Dumbbell Press', sets: '3 sets', reps: '8-10 reps', tip: 'Upper chest shelf build' },
        { name: 'Dips (Weighted if possible)', sets: '3 sets', reps: '10-12 reps', tip: 'Lower chest & tricep power' },
        { name: 'Cable Chest Flyes', sets: '3 sets', reps: '12-15 reps (Squeeze)', tip: 'Chest pump & blood flow' },
        { name: 'Rope Tricep Pushdowns', sets: '4 sets', reps: '10-12 reps', tip: 'Tricep horseshoe pump' },
      ],
      intensity: 'Heavy Compound Lift. Pre-workout 25 min pehle len!',
    },
    {
      day: 'Day 2: Back & Biceps (Heavy Pull & Lats)',
      tag: 'Pull Power',
      gamesCount: '5 Games / Exercises',
      exercises: [
        { name: 'Deadlifts (Conventional)', sets: '4 sets', reps: '5-6 reps', tip: 'Overall spinal thickness & trap power' },
        { name: 'Wide Grip Lat Pulldown', sets: '4 sets', reps: '8-10 reps', tip: 'V-Taper back width' },
        { name: 'Bent-Over Barbell Row', sets: '3 sets', reps: '8-10 reps', tip: 'Middle back density' },
        { name: 'Seated Cable Row', sets: '3 sets', reps: '10-12 reps', tip: 'Lats contraction' },
        { name: 'Barbell Bicep Curls', sets: '4 sets', reps: '8-10 reps', tip: 'Bicep peak & mass' },
      ],
      intensity: 'High calorie burn day. Post-workout Mass Gainer foran len!',
    },
    {
      day: 'Day 3: Shoulders & Abs (Boulders & Core)',
      tag: 'Delts & Core',
      gamesCount: '5 Games / Exercises',
      exercises: [
        { name: 'Overhead Barbell Military Press', sets: '4 sets', reps: '6-8 reps', tip: 'Front delt power' },
        { name: 'Dumbbell Lateral Raises (Side)', sets: '4 sets', reps: '12-15 reps', tip: 'Shoulder width & 3D look' },
        { name: 'Face Pulls / Rear Delt Flyes', sets: '4 sets', reps: '15 reps', tip: 'Shoulder posture & rear head' },
        { name: 'Dumbbell Shrugs', sets: '3 sets', reps: '12 reps', tip: 'Traps growth' },
        { name: 'Hanging Leg Raises', sets: '3 sets', reps: '15 reps', tip: 'Lower abs control' },
      ],
      intensity: 'Moderate weight with strict form for rounded 3D delts.',
    },
    {
      day: 'Day 4: Legs & Calves (Mass Builder)',
      tag: 'Lower Body',
      gamesCount: '5 Games / Exercises',
      exercises: [
        { name: 'Barbell Back Squats', sets: '4 sets', reps: '6-8 reps', tip: 'Ultimate natural testosterone booster' },
        { name: 'Leg Press Machine', sets: '4 sets', reps: '10-12 reps (Heavy)', tip: 'Quad sweep & bulk' },
        { name: 'Romanian Deadlift (Hamstrings)', sets: '3 sets', reps: '8-10 reps', tip: 'Hamstrings & glutes stretch' },
        { name: 'Leg Extensions', sets: '3 sets', reps: '15 reps (Burnout)', tip: 'Quad separation' },
        { name: 'Standing Calf Raises', sets: '4 sets', reps: '15-20 reps', tip: 'Calf muscle volume' },
      ],
      intensity: 'Sab se zyada calorie burn hoti ha. Extra water & Mass Gainer zaroor len.',
    },
    {
      day: 'Day 5: Arms Special (Biceps & Triceps Blast)',
      tag: 'Arm Size',
      gamesCount: '5 Games / Exercises',
      exercises: [
        { name: 'Incline Dumbbell Bicep Curls', sets: '3 sets', reps: '10 reps', tip: 'Full bicep stretch' },
        { name: 'EZ-Bar Skullcrushers', sets: '3 sets', reps: '8-10 reps', tip: 'Tricep long head mass' },
        { name: 'Hammer Curls (Dumbbell)', sets: '3 sets', reps: '10 reps', tip: 'Brachialis & forearm thickness' },
        { name: 'Overhead Cable Tricep Extension', sets: '3 sets', reps: '12 reps', tip: 'Elbow safety & stretch' },
        { name: 'Preacher Curls / Concentration Curls', sets: '3 sets', reps: '12 reps', tip: 'Peak pump finish' },
      ],
      intensity: 'High rep supersets for maximum blood pump & arm growth.',
    },
  ];

  // AI Personalized Recommendations Generator based on diet preference and calculated targets
  const getAiDietGuidance = () => {
    const isFatLoss = goal.startsWith('cut');
    const isBulking = goal.startsWith('bulk');

    let gainerAdvice = '';
    if (selectedGainer !== 'none') {
      gainerAdvice = `Aap ${gainer.name} (${gainerCalories} kcal, ${gainerProtein}g protein) le rahe hain. Isliye aapko khane (food) se sirf ${foodCaloriesNeeded} kcal aur ${foodProteinNeeded}g protein lena ha taake fat na charhay!`;
    }

    if (dietPreference === 'pakistani_desi') {
      return {
        strategy: isFatLoss
          ? `Apka body weight ${weightKg}kg ha aur target ${macros.targetCalories} kcal (Fat Loss Deficit). Desi khano me ghee aur tail kam karein, plain roti aur chawal portion control ke sath len aur protein har meal me barhaein.`
          : isBulking
            ? `Apka target ${macros.targetCalories} kcal (Lean Muscle Gain) ha. ${gainerAdvice} Desi khano me dodh, dahi, anday, aur chicken shamil karein aur heavy compound lifts karein.`
            : `Apka target ${macros.targetCalories} kcal (Maintenance) ha taake weight maintain rahay aur body shape improve ho.`,
        morningMeal: '3-4 Ublay anday + 1 saadi roti / 1 pyali daliya (oats) doodh ke sath + 5 badam.',
        lunchMeal: '150g Chicken breast / seena (tikka style ya kam oil salan) + 1 cup ublay chawal / 1 roti + khoob sari salaad + 1 katori dahi.',
        preWorkout: takingPreworkout
          ? '1 Scoop Pre-workout (C4 / Psychotic) paani me workout se 25 min pehle + 1 kela.'
          : '1 Kela (Banana) + 1 cup Black Coffee bina cheeni ke workout se 30 min pehle.',
        postWorkout: selectedGainer !== 'none'
          ? `1 Scoop ${gainer.name} (${gainerCalories} kcal, ${gainerProtein}g protein) ${takingCreatine ? '+ 5g Creatine' : ''} paani/doodh me foran workout k baad.`
          : `4-5 Ublay andon ki safedi + 1 glass taaza doodh / whey ${takingCreatine ? '+ 5g Creatine' : ''}.`,
        dinnerMeal: '120g Machli (Fish) / Chicken kabab ya Daal (Moong/Masoor) + 1 roti + zaitoon ke tail ke drops ke sath salad.',
        supplements: [
          takingCreatine ? 'Creatine Monohydrate: 5g rozana (Muscle cell hydration & strength boost).' : 'Creatine: Optional',
          takingPreworkout ? 'Pre-Workout: Sirf workout walay din 1 scoop (raat ke waqt late workout ho to half scoop len taake neend kharab na ho).' : 'Pre-Workout: Natural black coffee/banana.',
          selectedGainer !== 'none' ? `${gainer.name}: ${gainer.doseRecommendation}` : 'Food First Whole Protein sources.',
          'Omega-3 Fish Oil: 1 capsule rozana joron (joints) ki lubrication k liye.',
        ],
        avoidList: [
          'Ghee me bhari hui biryani, nihari, aur oily parathay (gainer ke sath ye lenge to sirf pet niklega).',
          'Meethay drinks, bakery biscuits aur cold drinks.',
        ]
      };
    } else if (dietPreference === 'budget_friendly') {
      return {
        strategy: `Student / Low Budget High Protein Plan: ${gainerAdvice} Mehengay supplements ke baghair ghar ke saste aur behtareen protein sources (Anday, Dahi, Daalein, Safaid Chana, Doodh, Peanut Butter) se protein poori ki gayi ha.`,
        morningMeal: '4 Ublay anday + 2 slices brown bread / roti + 1 glass taaza doodh.',
        lunchMeal: 'Safaid / Kaala Chana chaat (boiled) ya Daal chawal + 1 cup dahi (dahi me 10g protein hota ha) + salad.',
        preWorkout: '1 Roti par 1 chamach Peanut Butter laga kar + 1 Kela + Black coffee.',
        postWorkout: selectedGainer !== 'none'
          ? `1 Scoop ${gainer.name} + 5g Creatine.`
          : '4 Ublay anday ki safedi + 1 glass sattu / doodh + 5g Creatine.',
        dinnerMeal: 'Ghar ka bana salan (Daal / Sabzi / Anda curry) + 2 roti + kheera.',
        supplements: [
          'Creatine Monohydrate: Sab se sasta aur sab se effective supplement ha (Rs. 3000-4000 me 2-3 maah chal jata ha).',
          selectedGainer !== 'none' ? `${gainer.name} (Budget Saver: Rozana sirf 1 scoop len taake dabba 1 mahina chalay).` : 'Anday aur dahi se protein poori karein.',
        ],
        avoidList: [
          'Bahar ki chaat, shawarma, aur meethay cold drinks jo pocket b kharab karein aur sehat b.'
        ]
      };
    } else {
      // Pro Bodybuilding
      return {
        strategy: `Pro Bodybuilding Clean Macro Plan: Maximum muscle definition, low body fat aur rapid recovery ke liye clean lean protein sources se protein aur calories distribute kiye gaye hain. ${gainerAdvice}`,
        morningMeal: '6 Egg whites + 2 whole eggs + 60g rolled oats cooked in water/skim milk + berries.',
        lunchMeal: '200g Grilled Chicken Breast + 150g Jasmine Rice + Steamed Broccoli / Asparagus.',
        preWorkout: takingPreworkout
          ? '1 Scoop High-Stim Pre-workout + 5g L-Citrulline Malate 30 mins before lifting.'
          : 'Cream of Rice with 1 tbsp peanut butter + black coffee.',
        postWorkout: selectedGainer !== 'none'
          ? `1 Scoop ${gainer.name} (${gainerProtein}g protein) + 5g Creatine Monohydrate.`
          : '1.5 Scoop Whey Isolate + 1 large banana + 5g Creatine Monohydrate.',
        dinnerMeal: '180g White Fish / Tilapia ya Lean Beef Mince + 100g Sweet potato + green salad.',
        supplements: [
          selectedGainer !== 'none' ? `${gainer.name}: Post workout recovery` : 'Whey Isolate: Fast digesting post workout.',
          'Creatine Monohydrate: 5g daily indefinitely.',
          'Omega 3 Fish Oil & Zinc/Magnesium (ZMA) raat ko gehri neend ke liye.'
        ],
        avoidList: ['Sodium loaded junk, refined sugars, vegetable seed oils.']
      };
    }
  };

  const aiGuidance = getAiDietGuidance();

  // Calculated Meal Breakdown for auto meal distribution
  const mealDistribution = [
    {
      name: 'Breakfast (Nashta)',
      time: '8:00 AM - 9:00 AM',
      portion: 25,
      calories: Math.round(foodCaloriesNeeded * 0.30),
      protein: Math.round(foodProteinNeeded * 0.30),
      carbs: Math.round(macros.carbsGrams * 0.25),
      fats: Math.round(macros.fatGrams * 0.30),
      foodIdea: aiGuidance.morningMeal,
    },
    {
      name: 'Lunch (Dopeher Ka Khana)',
      time: '1:00 PM - 2:00 PM',
      portion: 35,
      calories: Math.round(foodCaloriesNeeded * 0.40),
      protein: Math.round(foodProteinNeeded * 0.40),
      carbs: Math.round(macros.carbsGrams * 0.35),
      fats: Math.round(macros.fatGrams * 0.35),
      foodIdea: aiGuidance.lunchMeal,
    },
    {
      name: 'Workout Fuel & Supplements',
      time: '5:00 PM - 6:30 PM',
      portion: 15,
      calories: selectedGainer !== 'none' ? gainerCalories : Math.round(foodCaloriesNeeded * 0.10),
      protein: selectedGainer !== 'none' ? gainerProtein : Math.round(foodProteinNeeded * 0.10),
      carbs: selectedGainer !== 'none' ? gainerCarbs : 20,
      fats: 3,
      foodIdea: `Pre: ${aiGuidance.preWorkout} | Post: ${aiGuidance.postWorkout}`,
    },
    {
      name: 'Dinner (Raat Ka Khana)',
      time: '8:30 PM - 9:30 PM',
      portion: 25,
      calories: Math.round(foodCaloriesNeeded * 0.30),
      protein: Math.round(foodProteinNeeded * 0.30),
      carbs: Math.round(macros.carbsGrams * 0.25),
      fats: Math.round(macros.fatGrams * 0.35),
      foodIdea: aiGuidance.dinnerMeal,
    },
  ];

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const q = userQuery.toLowerCase();
    let reply = `Aap ke ${weightKg}kg wazan aur ${goal.replace('_', ' ')} target ke mutabiq: `;

    if (q.includes('anabolic') || q.includes('serious mass') || q.includes('carnivor') || q.includes('gainer')) {
      reply += `${gainer.name} lene ka behtareen tareeqa yeh ha ke pehle 1-2 hafte rozana sirf 1 scoop (half serving) lein. Is se aap ka pait kharab nahi hoga aur extra calories seedhi muscle build karengi. Rozana kam az kam 4 Liter paani zaroor piyen!`;
    } else if (q.includes('preworkout') || q.includes('pre workout') || q.includes('c4') || q.includes('psychotic')) {
      reply += 'Pre-workout hamesha gym se 20-30 minute pehle 250ml paani me lein. Khana khane ke foran baad na lein warna asar kam hoga. Hafte me 1-2 din bina pre-workout workout karein taake caffeine tolerance na barhay.';
    } else if (q.includes('creatine') || q.includes('createne')) {
      reply += 'Creatine Monohydrate rozana 5 gram paani ke sath len. Is se muscles me ATP energy barhti ha aur 3-4 hafte me strength aur muscle fullness me numayan farq parta ha. Loading phase zaroori nahi ha, 5g rozana kafi ha.';
    } else if (q.includes('game') || q.includes('exercise') || q.includes('workout') || q.includes('sets')) {
      reply += 'Mass gainer ke sath har roz 5 se 6 games (exercises) karein, har game ke 3-4 sets aur 8-10 reps heavy weight ke sath lagayein. Heavy compound exercises (Bench, Squat, Deadlift, Rows) zaroor karein taake calories muscles me utilize hon.';
    } else {
      reply += `Aap ke goal (${goal.replace('_', ' ')}) ke liye sab se zaroori ha ke aap rozana ${macros.targetCalories} calories aur ${macros.proteinGrams}g protein target discipline ke sath follow karein. Rozana ${macros.waterLiters} liter paani piyen aur 7-8 ghantay gehri neend len.`;
    }

    setAiAnswers(prev => [{ question: userQuery, answer: reply, tag: 'AI Coach' }, ...prev]);
    setUserQuery('');
    toast.success('AI Coach answered your question!');
  };

  const handleCopyDietSummary = () => {
    const summary = `🏋️‍♂️ AI FITNESS & DIET PLAN 🏋️‍♂️
Profile: ${gender.toUpperCase()} | Weight: ${weightKg} kg | Height: ${heightCm} cm | Age: ${age}
Goal: ${goal.replace('_', ' ').toUpperCase()} | Gainer/Stack: ${gainer.name}

🔥 DAILY TARGETS:
- Total Calories: ${macros.targetCalories} kcal (From Food: ${foodCaloriesNeeded} kcal | From Gainer: ${gainerCalories} kcal)
- Total Protein: ${macros.proteinGrams}g (${macros.proteinRatio}g per kg body weight)
- Daily Water Target: ${macros.waterLiters} Liters/day

💊 SUPPLEMENT STACK TIMINGS:
${aiGuidance.supplements.map(s => `- ${s}`).join('\n')}

🍽️ MEAL PLAN:
${mealDistribution.map(m => `• ${m.name}: ${m.calories} kcal (Protein: ${m.protein}g) -> ${m.foodIdea}`).join('\n')}

Generated via Gym App Fitness & AI Calculator`;

    void navigator.clipboard.writeText(summary);
    setCopiedPlan(true);
    toast.success('Complete Plan copied to clipboard!');
    setTimeout(() => setCopiedPlan(false), 2500);
  };

  const TABS = [
    { value: 'diet' as const, label: 'Calories & Diet' },
    { value: 'supplements_routine' as const, label: '💊 Mass Gainer & Stack' },
    { value: 'workout_split' as const, label: '🏋️‍♂️ Workout & Games' },
    { value: 'ai_advisor' as const, label: '✨ AI Nutrition Coach' },
    { value: 'meal_plan' as const, label: 'Auto Meal Plan' },
  ];

  return (
    <Page>
      <PageHeader
        icon={Calculator}
        title="Fitness, Mass Gainer & Workout Calculator"
        subtitle="Automatic calorie engine with Anabolic Mass, Serious Mass & Carnivor integration + Workout games guide"
      />

      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <SegmentedControl value={tab} onChange={setTab} options={TABS} />
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDietSummary}
              type="button"
              className={secondaryButton}
            >
              {copiedPlan ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copiedPlan ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DIET & CALORIE CALCULATOR */}
        {tab === 'diet' && (
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
        )}

        {/* TAB 2: MASS GAINER & SUPPLEMENT STACK PROTOCOL */}
        {tab === 'supplements_routine' && (
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
        )}

        {/* TAB 3: WORKOUT SPLIT & GAMES GUIDE */}
        {tab === 'workout_split' && (
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
                      <Layers size={14} /> 5-Day Hypertrophy & Mass Split Routine
                    </span>
                    <h2 className="text-xl font-black mt-1">
                      Kitna Workout & Kitni Games (Exercises) Lagani Hain?
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Agar aap Mass Gainer (Anabolic/Serious Mass), Pre-Workout aur Creatine le rahe hain to body ko high protein aur energy milti ha. Is energy ko muscle me tabdeel karne ke liye neeche diya gaya 5-Day Workout Split follow karein:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 px-4 py-2.5 rounded-xl shrink-0 text-center">
                  <div>
                    <span className="text-[10px] text-blue-200 uppercase block font-semibold">Volume Standard</span>
                    <span className="text-sm font-black text-white">5 Games · 16-18 Sets/Day</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* The 5 Workout Days Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workoutSplitDays.map((d, idx) => (
                <Card key={idx} className="p-5 border-t-4 border-t-blue-600 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          {d.tag}
                        </span>
                        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm mt-0.5">{d.day}</h3>
                      </div>
                      <span className="text-xs font-bold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                        {d.gamesCount}
                      </span>
                    </div>

                    <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                      {d.exercises.map((ex, exIdx) => (
                        <div key={exIdx} className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-xs">
                          <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-slate-100">
                            <span>{exIdx + 1}. {ex.name}</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">{ex.sets}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                            <span>{ex.tip}</span>
                            <span>{ex.reps}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                    💡 {d.intensity}
                  </div>
                </Card>
              ))}

              {/* Rest & Recovery Card */}
              <Card className="p-5 border-t-4 border-t-emerald-500 flex flex-col justify-between bg-emerald-50/20 dark:bg-emerald-500/5">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-2">
                    <Calendar size={16} /> Day 6 & 7: Rest & Muscle Growth
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                    Rest Day Protocol (Recovery)
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Gym me muscle break hota ha, muscle banta tab ha jab aap sote hain aur khate hain!
                  </p>

                  <ul className="space-y-2 text-xs text-gray-700 dark:text-slate-300 mt-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>7-8 Ghantay ki gehri neend laazmi len.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>Creatine 5g rest day par b nashte ke baad len.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>Protein intake ({macros.proteinGrams}g) rest day par b kam na karein.</span>
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
                    1RM Strength Calculator (Games K Working Weights)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  <Activity size={15} />
                  <span>BW Ratio: {oneRm.bwRatio}x ({oneRm.strengthLevel})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel htmlFor={exerciseSelectId}>Target Game / Lift</FieldLabel>
                  <select
                    id={exerciseSelectId}
                    value={exercise}
                    onChange={e => setExercise(e.target.value)}
                    className={inputClass}
                  >
                    <option value="bench_press">Flat Barbell Bench Press (Chest)</option>
                    <option value="squat">Barbell Back Squat (Legs)</option>
                    <option value="deadlift">Conventional Deadlift (Back)</option>
                    <option value="overhead_press">Overhead Military Press (Shoulders)</option>
                  </select>
                </div>

                <div>
                  <FieldLabel htmlFor={liftWeightInputId}>Weight Lifted (kg)</FieldLabel>
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
                  <FieldLabel htmlFor={liftRepsInputId}>Completed Reps (1-12)</FieldLabel>
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
                    <span>Power & Strength</span>
                    <span>85% 1RM</span>
                  </div>
                  <p className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-1">{oneRm.strengthSet.weight} kg</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">{oneRm.strengthSet.reps} (Rest 3 mins)</p>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                  <div className="flex justify-between items-center text-xs text-blue-700 dark:text-blue-400 font-bold uppercase">
                    <span>Muscle Hypertrophy</span>
                    <span>72% 1RM</span>
                  </div>
                  <p className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-1">{oneRm.hypertrophySet.weight} kg</p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">{oneRm.hypertrophySet.reps} (Optimal Size)</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                    <span>Burnout / Pump</span>
                    <span>55% 1RM</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{oneRm.enduranceSet.weight} kg</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">{oneRm.enduranceSet.reps} (Fast blood flow)</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: AI NUTRITION COACH & ADVISOR */}
        {tab === 'ai_advisor' && (
          <div className="space-y-6">
            {/* Top AI Summary Header */}
            <Card className="p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white border-purple-900/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-purple-300">
                    <Bot size={28} />
                  </div>
                  <div>
                    <span className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={14} /> AI Nutrition & Diet Advisor
                    </span>
                    <h2 className="text-xl font-black mt-1">
                      Custom Plan For: {weightKg} kg Lifter ({goal.replace('_', ' ').toUpperCase()})
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {aiGuidance.strategy}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-purple-300 uppercase block font-semibold">Target Calories</span>
                    <span className="text-base font-black text-white">{macros.targetCalories} kcal</span>
                  </div>
                  <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-purple-300 uppercase block font-semibold">Required Protein</span>
                    <span className="text-base font-black text-rose-300">{macros.proteinGrams}g</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Core Guidance Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kya Kya Lena Chaiye (What to eat) */}
              <Card className="p-5 border-t-4 border-t-emerald-500 space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  Kya Kya Lena Chaiye (Recommended Diet Items)
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                      🌅 Subah Nashta (Breakfast):
                    </strong>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                      {aiGuidance.morningMeal}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                      ☀️ Dopeher Ka Khana (Lunch):
                    </strong>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                      {aiGuidance.lunchMeal}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                      ⚡ Workout Fuel (Pre & Post Workout):
                    </strong>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                      <strong>Pre:</strong> {aiGuidance.preWorkout} <br />
                      <strong>Post:</strong> {aiGuidance.postWorkout}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                      🌙 Raat Ka Khana (Dinner):
                    </strong>
                    <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                      {aiGuidance.dinnerMeal}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Supplements & Dos/Don'ts */}
              <div className="space-y-6">
                {/* Supplements Advice */}
                <Card className="p-5 border-t-4 border-t-blue-500 space-y-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <Zap size={18} className="text-blue-600 dark:text-blue-400" />
                    Supplements: Kia Zaroori Hain?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    AI Analysis: Food first hamesha pehli tarjeeh ha. Neeche diye gaye supplements sirf tab len jab zaroorat ho:
                  </p>

                  <ul className="space-y-2 text-xs">
                    {aiGuidance.supplements.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Avoid List */}
                <Card className="p-5 border-t-4 border-t-rose-500 space-y-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <AlertCircle size={18} className="text-rose-600 dark:text-rose-400" />
                    Kia Nahi Lena Chaiye (Avoid List)
                  </h3>

                  <ul className="space-y-2 text-xs">
                    {aiGuidance.avoidList.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                        <span className="text-rose-600 font-bold">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>

            {/* Interactive Ask AI Section */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Ask AI Nutritionist Any Question
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Aap diet, mass gainer, pre-workout, creatine, fat loss ya exercises ke baray me koi bhi sawal pooch saktay hain:
              </p>

              <form onSubmit={handleAskAi} className="flex gap-2">
                <input
                  type="text"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  placeholder="e.g. Kia Anabolic Mass k sath pre-workout lena theek ha? Ya chest k kitne sets lagayein?"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={!userQuery.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition flex items-center gap-1.5 shrink-0"
                >
                  <Send size={14} />
                  <span>Ask AI</span>
                </button>
              </form>

              {/* Answers Feed */}
              <div className="space-y-3 pt-2">
                {aiAnswers.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/70 border border-gray-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                        <HelpCircle size={14} className="text-purple-600 dark:text-purple-400" />
                        {item.question}
                      </span>
                      <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-full">
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed pl-5 border-l-2 border-purple-500/40">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: AUTO MEAL PLAN & DIET DISTRIBUTION */}
        {tab === 'meal_plan' && (
          <div className="space-y-6">
            {/* Top Summary Banner */}
            <Card className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles size={14} /> Auto Calculated Meal Distribution
                  </div>
                  <h2 className="text-xl font-black mt-1">
                    {macros.targetCalories.toLocaleString()} Calories & {macros.proteinGrams}g Protein Breakdown
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Body weight {weightKg} kg {selectedGainer !== 'none' ? `+ ${gainer.name} (${gainerCalories} kcal)` : ''} ke hisaab se 4 meals me protein aur calories ko scientifically divide kiya gaya ha.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDietSummary}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-2 shrink-0 shadow-md shadow-blue-600/30"
                >
                  {copiedPlan ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedPlan ? 'Copied to Clipboard' : 'Copy Full Plan'}</span>
                </button>
              </div>
            </Card>

            {/* The 4 Meals Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mealDistribution.map((m, idx) => (
                <Card key={m.name} className="p-5 border-t-4 border-t-indigo-500 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          Meal #{idx + 1}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">{m.name}</h3>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{m.time}</p>
                      </div>
                      <span className="text-lg font-black text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-800 px-3 py-1 rounded-xl">
                        {m.calories} <span className="text-xs font-medium text-gray-400">kcal</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-center">
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">Protein</span>
                        <span className="text-sm font-black text-rose-700 dark:text-rose-300">{m.protein}g</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block uppercase">Carbs</span>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-300">{m.carbs}g</span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Fats</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{m.fats}g</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                      <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block uppercase">
                        Recommended Pakistani / Gym Diet Foods:
                      </span>
                      <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {m.foodIdea}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Hydration & Supplement Suggestions */}
            <Card className="p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-3">
                <Droplets size={16} className="text-cyan-600 dark:text-cyan-400" />
                Daily Hydration & Supplement Timings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-900 dark:text-cyan-300">
                  <strong className="block font-bold mb-1">Water Target: {macros.waterLiters} Liters</strong>
                  Workout se pehle 500ml aur workout ke doraan sip-by-sip paani piyen taake dehydration aur muscle cramps na hon.
                </div>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-900 dark:text-purple-300">
                  <strong className="block font-bold mb-1">Creatine Monohydrate: 5g</strong>
                  Rozana 5g kisi b waqt (subah ya post-workout) paani ke sath len taake muscle strength aur ATP boost ho.
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-300">
                  <strong className="block font-bold mb-1">Stack Timing</strong>
                  Pre-workout gym se 25 min pehle, aur {gainer.name} workout k 20 min baad len.
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}
