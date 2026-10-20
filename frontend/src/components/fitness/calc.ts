import {
  POPULAR_GAINERS,
  type AiDietGuidance, type DietPreference, type Gender, type GainerProfile, type Goal,
  type MacroResult, type MealSlot, type OneRmResult,
} from './data';

export interface MacroInputs {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: number;
  goal: Goal;
  takingCreatine: boolean;
  selectedGainer: string;
}

// Diet & Macro Calculation Logic
export const calculateMacros = ({
  gender, weightKg, heightCm, age, activityLevel, goal, takingCreatine, selectedGainer,
}: MacroInputs): MacroResult => {
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

export interface OneRmInputs {
  liftWeight: number;
  liftReps: number;
  weightKg: number;
  exercise: string;
}

// Workout 1RM Calculation Logic (Epley Formula)
export const calculateOneRm = ({ liftWeight, liftReps, weightKg, exercise }: OneRmInputs): OneRmResult => {
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

export interface GainerNumbers {
  gainer: GainerProfile;
  gainerCalories: number;
  gainerProtein: number;
  gainerCarbs: number;
  foodCaloriesNeeded: number;
  foodProteinNeeded: number;
}

export interface GuidanceInputs extends GainerNumbers {
  goal: Goal;
  selectedGainer: string;
  dietPreference: DietPreference;
  weightKg: number;
  macros: MacroResult;
  takingPreworkout: boolean;
  takingCreatine: boolean;
}

// AI Personalized Recommendations Generator based on diet preference and calculated targets
export const getAiDietGuidance = ({
  goal, selectedGainer, dietPreference, weightKg, macros, takingPreworkout, takingCreatine,
  gainer, gainerCalories, gainerProtein, foodCaloriesNeeded, foodProteinNeeded,
}: GuidanceInputs): AiDietGuidance => {
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

export interface MealInputs extends GainerNumbers {
  macros: MacroResult;
  selectedGainer: string;
  aiGuidance: AiDietGuidance;
}

// Calculated Meal Breakdown for auto meal distribution
export const buildMealDistribution = ({
  macros, selectedGainer, aiGuidance, gainerCalories, gainerProtein, gainerCarbs,
  foodCaloriesNeeded, foodProteinNeeded,
}: MealInputs): MealSlot[] => [
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

// Gainer actual consumed metrics (Full vs Half serving)
export const computeGainerNumbers = (
  selectedGainer: string,
  gainerServing: 'half' | 'full',
  targetCalories: number,
  proteinGrams: number,
): GainerNumbers => {
  const gainer = POPULAR_GAINERS[selectedGainer] ?? POPULAR_GAINERS.none!;
  const gainerMultiplier = gainerServing === 'full' ? 1.0 : 0.5;
  const gainerCalories = Math.round(gainer.fullCalories * gainerMultiplier);
  const gainerProtein = Math.round(gainer.fullProtein * gainerMultiplier);
  const gainerCarbs = Math.round(gainer.fullCarbs * gainerMultiplier);

  // Remaining food needed from meals so user doesn't get over-fat!
  const foodCaloriesNeeded = Math.max(800, targetCalories - gainerCalories);
  const foodProteinNeeded = Math.max(30, proteinGrams - gainerProtein);
  return { gainer, gainerCalories, gainerProtein, gainerCarbs, foodCaloriesNeeded, foodProteinNeeded };
};
