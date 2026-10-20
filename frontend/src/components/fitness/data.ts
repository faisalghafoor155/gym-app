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
