import { useEffect, useState, useId } from 'react';
import { Activity, Calculator, Copy, Check } from 'lucide-react';
import { Page, PageHeader, SegmentedControl, FieldLabel, inputClass, secondaryButton } from '../components/ui';
import Modal from '../components/Modal';
import ExerciseAnglesModal from '../components/fitness/ExerciseAnglesModal';
import ExercisePhotoModal from '../components/fitness/ExercisePhotoModal';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { Measurement } from '../types';
import toast from 'react-hot-toast';
import {
  type AiAnswer, type CalcTab, type DietPreference, type Gender, type Goal, type Muscle,
} from '../components/fitness/data';
import {
  calculateMacros, calculateOneRm, getAiDietGuidance, buildMealDistribution, computeGainerNumbers,
} from '../components/fitness/calc';
import DietTab from '../components/fitness/DietTab';
import SupplementsTab from '../components/fitness/SupplementsTab';
import WorkoutSplitTab from '../components/fitness/WorkoutSplitTab';
import AiAdvisorTab from '../components/fitness/AiAdvisorTab';
import MealPlanTab from '../components/fitness/MealPlanTab';
import SendDietModal from '../components/fitness/SendDietModal';
import { hasPermission } from '../utils/permissions';

export default function FitnessCalculator() {
  const { lang, t } = useLanguage();
  const [tab, setTab] = useState<CalcTab>('diet');

  // Input states for Diet & Calorie Calculator
  const [gender, setGender] = useState<Gender>('male');
  const [weightKg, setWeightKg] = useState<number>(70);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [age, setAge] = useState<number>(25);
  const [activityLevel, setActivityLevel] = useState<number>(1.55); // Moderate (3-5 days gym)
  const [goal, setGoal] = useState<Goal>('bulk_lean');

  // A member's own logged weight, so the numbers start from them rather than
  // from a 70 kg stranger. Staff use this page for walk-ins and get the default.
  const { user, isStaff, isOwner } = useAuth();
  // Sending a plan to a member is assigning one, so it needs the same
  // permission as the Plans page — the API refuses it otherwise.
  const canAssignPlans = isOwner
    || (isStaff && !!user?.staffPermission && hasPermission(user.role, user.staffPermission, 'canManagePlans'));
  const [sendingDiet, setSendingDiet] = useState(false);
  const [latestWeighIn, setLatestWeighIn] = useState<{ weightKg: number; measuredOn: string } | null>(null);
  useEffect(() => {
    if (!user?.memberId) return;
    void api.get<{ data: Measurement[] }>('/me/measurements')
      .then(r => {
        // Newest first from the API; the first with a weight is the latest.
        const row = r.data.data.find(m => m.weightKg != null);
        if (!row) return;
        setLatestWeighIn({ weightKg: row.weightKg!, measuredOn: row.measuredOn });
        setWeightKg(row.weightKg!);
      })
      .catch(() => { /* the calculator works fine on its defaults */ });
  }, [user?.memberId]);
  const [dietPreference, setDietPreference] = useState<DietPreference>('pakistani_desi');
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

  // Exercise Angle Guide Modal State
  const [showAngleModal, setShowAngleModal] = useState<boolean>(false);
  const [selectedAngleExercise, setSelectedAngleExercise] = useState<string>('incline_bench_press');
  const [selectedAngleMuscle, setSelectedAngleMuscle] = useState<Muscle>('chest');

  // Exercise Real Photo Modal & Viewer State ("Jo bhi game select karon pic dikha de")
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [selectedPhotoExercise, setSelectedPhotoExercise] = useState<string>('flat_bench');
  const [selectedPhotoMuscle, setSelectedPhotoMuscle] = useState<Muscle>('chest');

  // AI Chat Q&A State
  const [userQuery, setUserQuery] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedAnswerIdx, setCopiedAnswerIdx] = useState<number | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('gym_gemini_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState(() => localStorage.getItem('gym_gemini_api_key') || '');
  // The starter answers are English dictionary keys, shown through t() in the
  // feed, so they follow the language toggle; the coach's own replies pass
  // through t() unchanged.
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>([
    {
      question: 'How do I avoid belly fat while taking Anabolic Mass or Serious Mass?',
      answer: 'Very important question! A mass gainer has 1000+ calories. If you also eat 4 parathas and sweets at home, the calorie surplus gets too big and you gain belly fat. The best fix: take a "Half Serving" (1 scoop) of the gainer, stop junk food, and do heavy compound exercises in the gym (Squats, Deadlifts, Bench Press) so the calories go into muscle!',
      tag: 'Mass Gainer',
    },
    {
      question: 'Can I take pre-workout and creatine together?',
      answer: 'Yes! Pre-workout is taken 20-30 minutes before the workout for focus and pump, while 5g of creatine daily increases your muscles\' ATP energy and strength. You can mix creatine into your pre-workout, or take it with your gainer right after the workout.',
      tag: 'Stack',
    },
    {
      question: 'Does a mass gainer put strain on the liver or kidneys?',
      answer: 'A mass gainer is just a powder of carbs and milk protein. If you drink 3.5 to 4 liters of water a day, your digestion stays clean and there is no strain on the kidneys. Drinking too little water can cause dehydration and constipation.',
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

  const macros = calculateMacros({ gender, weightKg, heightCm, age, activityLevel, goal, takingCreatine, selectedGainer });
  const oneRm = calculateOneRm({ liftWeight, liftReps, weightKg, exercise });
  const { gainer, gainerCalories, gainerProtein, gainerCarbs, foodCaloriesNeeded, foodProteinNeeded } =
    computeGainerNumbers(selectedGainer, gainerServing, macros.targetCalories, macros.proteinGrams);

  const aiGuidance = getAiDietGuidance({
    goal, selectedGainer, dietPreference, weightKg, macros, takingPreworkout, takingCreatine,
    gainer, gainerCalories, gainerProtein, gainerCarbs, foodCaloriesNeeded, foodProteinNeeded,
  }, lang);

  const mealDistribution = buildMealDistribution({
    macros, selectedGainer, aiGuidance, gainer, gainerCalories, gainerProtein, gainerCarbs,
    foodCaloriesNeeded, foodProteinNeeded,
  }, lang);


  const QUICK_PROMPTS = [
    { label: t('📋 Full Pakistani Diet Plan'), prompt: t('Make me a complete Pakistani desi diet plan from morning to night for my {weight}kg weight and {goal} target.', { weight: weightKg, goal: goal.replace('_', ' ') }) },
    { label: t('🥩 Anabolic Mass Belly Fat Guide'), prompt: t('How do I build lean muscle with Anabolic Mass or Serious Mass without gaining belly fat?') },
    { label: t('⚡ Creatine & Hydration Timing'), prompt: t('When should I take 5g of Creatine Monohydrate, and how much water do I need to drink?') },
    { label: t('🔥 Pre-Workout Guidelines'), prompt: t('What is the right way to take pre-workout (C4/Psychotic), and what precautions should I take?') },
    { label: t('🏋️ 5-Day Workout Routine'), prompt: t('In a 5-day hypertrophy split, how many exercises and how many heavy sets should I do each day?') },
  ];

  const handleAskAi = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const query = customQuestion || userQuery;
    if (!query.trim() || loadingAi) return;

    setLoadingAi(true);
    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        message: query.trim(),
        lang,
        context: {
          gender,
          weightKg: Number(weightKg) || 70,
          heightCm: Number(heightCm) || 175,
          age: Number(age) || 25,
          activityLevel,
          goal,
          dietPreference,
          selectedGainer,
          takingCreatine,
          takingPreworkout,
          targetCalories: macros.targetCalories,
          proteinGrams: macros.proteinGrams,
          carbsGrams: macros.carbsGrams,
          fatGrams: macros.fatGrams,
          waterLiters: macros.waterLiters,
        },
        apiKey: customApiKey.trim() || undefined,
      });

      if (res.data?.reply) {
        setAiAnswers(prev => [
          {
            question: query.trim(),
            answer: res.data.reply,
            tag: customQuestion ? 'Quick Coach' : 'AI Advice',
          },
          ...prev,
        ]);
        if (!customQuestion) setUserQuery('');
        toast.success(t('AI Coach answered your question!'));
      }
    } catch (err: unknown) {
      toast.error(apiError(err, t('Could not reach the AI Coach. Please try again.')));
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gym_gemini_api_key', trimmed);
      toast.success(t('Gemini API key saved in this browser!'));
    } else {
      localStorage.removeItem('gym_gemini_api_key');
      toast.success(t('The Gym App default AI engine is active.'));
    }
    setShowApiKeyModal(false);
  };

  const handleCopyAnswer = (text: string, idx: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedAnswerIdx(idx);
    toast.success(t('AI advice copied to clipboard!'));
    setTimeout(() => setCopiedAnswerIdx(null), 2000);
  };

  const handleClearAiChat = () => {
    if (window.confirm(t('Do you want to clear the AI chat history?'))) {
      setAiAnswers([]);
      toast.success(t('Chat history cleared'));
    }
  };

  const handleCopyDietSummary = () => {
    const summary = `🏋️‍♂️ ${t('AI FITNESS & DIET PLAN')} 🏋️‍♂️
${t('Profile: {gender} | Weight: {weight} kg | Height: {height} cm | Age: {age}', { gender: t(gender === 'male' ? 'Male' : 'Female').toUpperCase(), weight: weightKg, height: heightCm, age })}
${t('Goal: {goal} | Gainer/Stack: {gainer}', { goal: goal.replace('_', ' ').toUpperCase(), gainer: t(gainer.name) })}

🔥 ${t('DAILY TARGETS:')}
- ${t('Total Calories: {calories} kcal (From Food: {food} kcal | From Gainer: {gainer} kcal)', { calories: macros.targetCalories, food: foodCaloriesNeeded, gainer: gainerCalories })}
- ${t('Total Protein: {protein}g ({ratio}g per kg body weight)', { protein: macros.proteinGrams, ratio: macros.proteinRatio })}
- ${t('Daily Water Target: {liters} Liters/day', { liters: macros.waterLiters })}

💊 ${t('SUPPLEMENT STACK TIMINGS:')}
${aiGuidance.supplements.map(s => `- ${s}`).join('\n')}

🍽️ ${t('MEAL PLAN:')}
${mealDistribution.map(m => `• ${t('{meal}: {calories} kcal (Protein: {protein}g) -> {food}', { meal: m.name, calories: m.calories, protein: m.protein, food: m.foodIdea })}`).join('\n')}

${t('Generated via Gym App Fitness & AI Calculator')}`;

    void navigator.clipboard.writeText(summary);
    setCopiedPlan(true);
    toast.success(t('Complete Plan copied to clipboard!'));
    setTimeout(() => setCopiedPlan(false), 2500);
  };

  const TABS = [
    { value: 'diet' as const, label: t('Calories & Diet') },
    { value: 'supplements_routine' as const, label: t('💊 Mass Gainer & Stack') },
    { value: 'workout_split' as const, label: t('🏋️‍♂️ Workout & Games') },
    { value: 'ai_advisor' as const, label: t('✨ AI Nutrition Coach') },
    { value: 'meal_plan' as const, label: t('Auto Meal Plan') },
  ];

  return (
    <Page>
      <PageHeader
        icon={Calculator}
        title={t('Fitness, Mass Gainer & Workout Calculator')}
        subtitle={t('Automatic calorie engine with Anabolic Mass, Serious Mass & Carnivor integration + workout guide')}
      />

      {latestWeighIn && (
        <div className="mb-4 rounded-xl px-4 py-2.5 bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Activity size={15} className="shrink-0" />
          <span>
            {t('Using your latest weigh-in:')} <strong>{latestWeighIn.weightKg} kg</strong>{' '}
            {t('on {date}.', { date: new Date(latestWeighIn.measuredOn).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) })}{' '}
            {t('The AI coach also sees your progress history.')}
          </span>
        </div>
      )}

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
              <span>{copiedPlan ? t('Copied!') : t('Copy Summary')}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DIET & CALORIE CALCULATOR */}
        {tab === 'diet' && (
          <DietTab
            age={age}
            gender={gender}
            setGender={setGender}
            weightKg={weightKg}
            setWeightKg={setWeightKg}
            heightCm={heightCm}
            setHeightCm={setHeightCm}
            setAge={setAge}
            activityLevel={activityLevel}
            setActivityLevel={setActivityLevel}
            goal={goal}
            setGoal={setGoal}
            dietPreference={dietPreference}
            setDietPreference={setDietPreference}
            selectedGainer={selectedGainer}
            setSelectedGainer={setSelectedGainer}
            gainerServing={gainerServing}
            takingCreatine={takingCreatine}
            genderMaleId={genderMaleId}
            genderFemaleId={genderFemaleId}
            weightInputId={weightInputId}
            heightInputId={heightInputId}
            ageInputId={ageInputId}
            activityInputId={activityInputId}
            goalInputId={goalInputId}
            dietPrefId={dietPrefId}
            gainerSelectId={gainerSelectId}
            macros={macros}
            gainer={gainer}
            gainerCalories={gainerCalories}
            gainerProtein={gainerProtein}
            foodCaloriesNeeded={foodCaloriesNeeded}
            foodProteinNeeded={foodProteinNeeded}
            setTab={setTab}
          />
        )}

        {/* TAB 2: MASS GAINER & SUPPLEMENT STACK PROTOCOL */}
        {tab === 'supplements_routine' && (
          <SupplementsTab
            weightKg={weightKg}
            selectedGainer={selectedGainer}
            setSelectedGainer={setSelectedGainer}
            gainerServing={gainerServing}
            setGainerServing={setGainerServing}
            takingPreworkout={takingPreworkout}
            setTakingPreworkout={setTakingPreworkout}
            takingCreatine={takingCreatine}
            setTakingCreatine={setTakingCreatine}
            macros={macros}
            gainer={gainer}
            gainerCalories={gainerCalories}
            foodCaloriesNeeded={foodCaloriesNeeded}
            foodProteinNeeded={foodProteinNeeded}
            handleAskAi={handleAskAi}
            setTab={setTab}
          />
        )}

        {/* TAB 3: WORKOUT SPLIT & GAMES GUIDE */}
        {tab === 'workout_split' && (
          <WorkoutSplitTab
            selectedPhotoMuscle={selectedPhotoMuscle}
            selectedPhotoExercise={selectedPhotoExercise}
            exercise={exercise}
            setExercise={setExercise}
            liftWeight={liftWeight}
            setLiftWeight={setLiftWeight}
            liftReps={liftReps}
            setLiftReps={setLiftReps}
            setShowAngleModal={setShowAngleModal}
            setSelectedAngleExercise={setSelectedAngleExercise}
            setSelectedAngleMuscle={setSelectedAngleMuscle}
            setShowPhotoModal={setShowPhotoModal}
            setSelectedPhotoExercise={setSelectedPhotoExercise}
            setSelectedPhotoMuscle={setSelectedPhotoMuscle}
            exerciseSelectId={exerciseSelectId}
            liftWeightInputId={liftWeightInputId}
            liftRepsInputId={liftRepsInputId}
            macros={macros}
            oneRm={oneRm}
          />
        )}

        {/* TAB 4: AI NUTRITION COACH & ADVISOR */}
        {tab === 'ai_advisor' && (
          <AiAdvisorTab
            weightKg={weightKg}
            goal={goal}
            userQuery={userQuery}
            setUserQuery={setUserQuery}
            loadingAi={loadingAi}
            copiedAnswerIdx={copiedAnswerIdx}
            setShowApiKeyModal={setShowApiKeyModal}
            customApiKey={customApiKey}
            setTempApiKey={setTempApiKey}
            aiAnswers={aiAnswers}
            macros={macros}
            gainer={gainer}
            aiGuidance={aiGuidance}
            QUICK_PROMPTS={QUICK_PROMPTS}
            handleAskAi={handleAskAi}
            handleCopyAnswer={handleCopyAnswer}
            handleClearAiChat={handleClearAiChat}
          />
        )}

        {/* TAB 5: AUTO MEAL PLAN & DIET DISTRIBUTION */}
        {tab === 'meal_plan' && (
          <MealPlanTab
            copiedPlan={copiedPlan}
            weightKg={weightKg}
            goal={goal}
            selectedGainer={selectedGainer}
            macros={macros}
            gainer={gainer}
            gainerCalories={gainerCalories}
            mealDistribution={mealDistribution}
            handleAskAi={handleAskAi}
            setTab={setTab}
            handleCopyDietSummary={handleCopyDietSummary}
            onSendToMember={canAssignPlans ? () => setSendingDiet(true) : undefined}
          />
        )}
        {sendingDiet && (
          <SendDietModal macros={macros} meals={mealDistribution} onClose={() => setSendingDiet(false)} />
        )}
      </div>

      {/* Gemini API Key Configuration Modal */}
      {showApiKeyModal && (
        <Modal title={t('AI Engine & Gemini API Configuration')} onClose={() => setShowApiKeyModal(false)}>
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-950 dark:text-purple-200">
              <strong className="block font-bold mb-1">⚡ {t('Automatic AI Active by Default')}</strong>
              <p className="text-purple-800 dark:text-purple-300 leading-relaxed">
                {t('The Gym App backend includes our sports nutrition AI engine out of the box, with no setup needed!')}
              </p>
            </div>

            <div>
              <FieldLabel>{t('Custom Google Gemini API Key (Optional)')}</FieldLabel>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
                {t('If you have a Google AI Studio key (AIza...), you can paste it here to run directly on Google Gemini Flash:')}
              </p>
              <input
                type="password"
                value={tempApiKey}
                onChange={e => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className={inputClass}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTempApiKey('');
                  handleSaveApiKey();
                }}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                {t('Clear Custom Key')}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className={secondaryButton}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition text-xs"
                >
                  {t('Save Preference')}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* EXERCISE REAL PHOTO & FORM GUIDE MODAL */}
      <ExercisePhotoModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        initialMuscle={selectedPhotoMuscle}
        initialExerciseId={selectedPhotoExercise}
      />

      {/* EXERCISE ANGLES GUIDE MODAL */}
      <ExerciseAnglesModal
        isOpen={showAngleModal}
        onClose={() => setShowAngleModal(false)}
        defaultMuscle={selectedAngleMuscle}
        initialExerciseId={selectedAngleExercise}
      />
    </Page>
  );
}