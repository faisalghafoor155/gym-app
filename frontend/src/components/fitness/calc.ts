import {
  POPULAR_GAINERS,
  type AiDietGuidance, type DietPreference, type Gender, type GainerProfile, type Goal,
  type MacroResult, type MealSlot, type OneRmResult,
} from './data';
import { translate, type Language, type TVars } from '../../context/LanguageContext';

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
}: GuidanceInputs, lang: Language): AiDietGuidance => {
  const tr = (english: string, vars?: TVars) => translate(lang, english, vars);
  const isFatLoss = goal.startsWith('cut');
  const isBulking = goal.startsWith('bulk');
  const gainerName = tr(gainer.name);
  const creatine = takingCreatine ? '+ 5g Creatine' : '';

  let gainerAdvice = '';
  if (selectedGainer !== 'none') {
    gainerAdvice = tr(
      'You are taking {gainer} ({calories} kcal, {protein}g protein), so you only need {foodCalories} kcal and {foodProtein}g protein from food so that you do not gain fat!',
      { gainer: gainerName, calories: gainerCalories, protein: gainerProtein, foodCalories: foodCaloriesNeeded, foodProtein: foodProteinNeeded },
    );
  }

  if (dietPreference === 'pakistani_desi') {
    return {
      strategy: isFatLoss
        ? tr('Your body weight is {weight}kg and your target is {calories} kcal (fat loss deficit). Use less ghee and oil in desi food, keep roti and rice portions under control, and add protein to every meal.', { weight: weightKg, calories: macros.targetCalories })
        : isBulking
          ? tr('Your target is {calories} kcal (lean muscle gain). {advice} Add milk, yogurt, eggs and chicken to your desi meals and do heavy compound lifts.', { calories: macros.targetCalories, advice: gainerAdvice })
          : tr('Your target is {calories} kcal (maintenance), so your weight stays steady while your body shape improves.', { calories: macros.targetCalories }),
      morningMeal: tr('3-4 boiled eggs + 1 plain roti / 1 bowl of oats with milk + 5 almonds.'),
      lunchMeal: tr('150g chicken breast (tikka style or low-oil curry) + 1 cup boiled rice / 1 roti + plenty of salad + 1 bowl of yogurt.'),
      preWorkout: takingPreworkout
        ? tr('1 scoop pre-workout (C4 / Psychotic) in water 25 min before the workout + 1 banana.')
        : tr('1 banana + 1 cup black coffee without sugar, 30 min before the workout.'),
      postWorkout: selectedGainer !== 'none'
        ? tr('1 scoop {gainer} ({calories} kcal, {protein}g protein) {creatine} in water/milk right after the workout.', { gainer: gainerName, calories: gainerCalories, protein: gainerProtein, creatine })
        : tr('4-5 boiled egg whites + 1 glass of fresh milk / whey {creatine}.', { creatine }),
      dinnerMeal: tr('120g fish / chicken kebab or daal (moong/masoor) + 1 roti + salad with a few drops of olive oil.'),
      supplements: [
        takingCreatine ? tr('Creatine Monohydrate: 5g daily (muscle cell hydration & strength boost).') : tr('Creatine: Optional'),
        takingPreworkout ? tr('Pre-Workout: 1 scoop on workout days only (half a scoop for a late-night workout so your sleep is not disturbed).') : tr('Pre-Workout: Natural black coffee/banana.'),
        selectedGainer !== 'none' ? `${gainerName}: ${tr(gainer.doseRecommendation)}` : tr('Food first: whole protein sources.'),
        tr('Omega-3 Fish Oil: 1 capsule daily for joint lubrication.'),
      ],
      avoidList: [
        tr('Ghee-heavy biryani, nihari and oily parathas (with a gainer these only add belly fat).'),
        tr('Sugary drinks, bakery biscuits and cold drinks.'),
      ]
    };
  } else if (dietPreference === 'budget_friendly') {
    return {
      strategy: tr('Student / Low Budget High Protein Plan: {advice} Protein comes from cheap, excellent home sources (eggs, yogurt, daal, white chickpeas, milk, peanut butter) instead of expensive supplements.', { advice: gainerAdvice }),
      morningMeal: tr('4 boiled eggs + 2 slices brown bread / roti + 1 glass of fresh milk.'),
      lunchMeal: tr('White / black chickpea chaat (boiled) or daal chawal + 1 cup yogurt (yogurt has 10g protein) + salad.'),
      preWorkout: tr('1 roti with 1 spoon of peanut butter + 1 banana + black coffee.'),
      postWorkout: selectedGainer !== 'none'
        ? tr('1 scoop {gainer} + 5g Creatine.', { gainer: gainerName })
        : tr('4 boiled egg whites + 1 glass of sattu / milk + 5g Creatine.'),
      dinnerMeal: tr('Home-cooked curry (daal / vegetables / egg curry) + 2 roti + cucumber.'),
      supplements: [
        tr('Creatine Monohydrate: the cheapest and most effective supplement (Rs. 3000-4000 lasts 2-3 months).'),
        selectedGainer !== 'none' ? tr('{gainer} (budget saver: just 1 scoop a day so a tub lasts a month).', { gainer: gainerName }) : tr('Get your protein from eggs and yogurt.'),
      ],
      avoidList: [
        tr('Street chaat, shawarma and sugary cold drinks, which hurt both your pocket and your health.')
      ]
    };
  } else {
    // Pro Bodybuilding
    return {
      strategy: tr('Pro Bodybuilding Clean Macro Plan: protein and calories are spread across clean, lean protein sources for maximum muscle definition, low body fat and fast recovery. {advice}', { advice: gainerAdvice }),
      morningMeal: tr('6 egg whites + 2 whole eggs + 60g rolled oats cooked in water/skim milk + berries.'),
      lunchMeal: tr('200g grilled chicken breast + 150g jasmine rice + steamed broccoli / asparagus.'),
      preWorkout: takingPreworkout
        ? tr('1 scoop high-stim pre-workout + 5g L-Citrulline Malate 30 mins before lifting.')
        : tr('Cream of rice with 1 tbsp peanut butter + black coffee.'),
      postWorkout: selectedGainer !== 'none'
        ? tr('1 scoop {gainer} ({protein}g protein) + 5g Creatine Monohydrate.', { gainer: gainerName, protein: gainerProtein })
        : tr('1.5 scoop whey isolate + 1 large banana + 5g Creatine Monohydrate.'),
      dinnerMeal: tr('180g white fish / tilapia or lean beef mince + 100g sweet potato + green salad.'),
      supplements: [
        selectedGainer !== 'none' ? tr('{gainer}: Post workout recovery', { gainer: gainerName }) : tr('Whey Isolate: Fast digesting post workout.'),
        tr('Creatine Monohydrate: 5g daily indefinitely.'),
        tr('Omega 3 Fish Oil & Zinc/Magnesium (ZMA) at night for deep sleep.')
      ],
      avoidList: [tr('Sodium loaded junk, refined sugars, vegetable seed oils.')]
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
}: MealInputs, lang: Language): MealSlot[] => [
  {
    name: translate(lang, 'Breakfast'),
    time: '8:00 AM - 9:00 AM',
    portion: 25,
    calories: Math.round(foodCaloriesNeeded * 0.30),
    protein: Math.round(foodProteinNeeded * 0.30),
    carbs: Math.round(macros.carbsGrams * 0.25),
    fats: Math.round(macros.fatGrams * 0.30),
    foodIdea: aiGuidance.morningMeal,
  },
  {
    name: translate(lang, 'Lunch'),
    time: '1:00 PM - 2:00 PM',
    portion: 35,
    calories: Math.round(foodCaloriesNeeded * 0.40),
    protein: Math.round(foodProteinNeeded * 0.40),
    carbs: Math.round(macros.carbsGrams * 0.35),
    fats: Math.round(macros.fatGrams * 0.35),
    foodIdea: aiGuidance.lunchMeal,
  },
  {
    name: translate(lang, 'Workout Fuel & Supplements'),
    time: '5:00 PM - 6:30 PM',
    portion: 15,
    calories: selectedGainer !== 'none' ? gainerCalories : Math.round(foodCaloriesNeeded * 0.10),
    protein: selectedGainer !== 'none' ? gainerProtein : Math.round(foodProteinNeeded * 0.10),
    carbs: selectedGainer !== 'none' ? gainerCarbs : 20,
    fats: 3,
    foodIdea: translate(lang, 'Pre: {pre} | Post: {post}', { pre: aiGuidance.preWorkout, post: aiGuidance.postWorkout }),
  },
  {
    name: translate(lang, 'Dinner'),
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
