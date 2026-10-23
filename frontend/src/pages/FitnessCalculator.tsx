import { useEffect, useState, useId } from 'react';
import { Activity, Calculator, Copy, Check } from 'lucide-react';
import { Page, PageHeader, SegmentedControl, FieldLabel, inputClass, secondaryButton } from '../components/ui';
import Modal from '../components/Modal';
import ExerciseAnglesModal from '../components/fitness/ExerciseAnglesModal';
import ExercisePhotoModal from '../components/fitness/ExercisePhotoModal';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
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

export default function FitnessCalculator() {
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
  const { user } = useAuth();
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
  const [aiAnswers, setAiAnswers] = useState<AiAnswer[]>([
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

  const macros = calculateMacros({ gender, weightKg, heightCm, age, activityLevel, goal, takingCreatine, selectedGainer });
  const oneRm = calculateOneRm({ liftWeight, liftReps, weightKg, exercise });
  const { gainer, gainerCalories, gainerProtein, gainerCarbs, foodCaloriesNeeded, foodProteinNeeded } =
    computeGainerNumbers(selectedGainer, gainerServing, macros.targetCalories, macros.proteinGrams);

  const aiGuidance = getAiDietGuidance({
    goal, selectedGainer, dietPreference, weightKg, macros, takingPreworkout, takingCreatine,
    gainer, gainerCalories, gainerProtein, gainerCarbs, foodCaloriesNeeded, foodProteinNeeded,
  });

  const mealDistribution = buildMealDistribution({
    macros, selectedGainer, aiGuidance, gainer, gainerCalories, gainerProtein, gainerCarbs,
    foodCaloriesNeeded, foodProteinNeeded,
  });


  const QUICK_PROMPTS = [
    { label: '📋 Full Pakistani Diet Plan', prompt: `Mere ${weightKg}kg wazan aur ${goal.replace('_', ' ')} target ke mutabiq subah se raat tak ka Mukammal Pakistani Desi Diet Plan banao.` },
    { label: '🥩 Anabolic Mass Belly Fat Guide', prompt: 'Anabolic Mass ya Serious Mass k sath pet (belly fat) charhe bina lean muscle kaise banayein?' },
    { label: '⚡ Creatine & Hydration Timing', prompt: 'Creatine Monohydrate 5g kis waqt lena chahiye aur kitna paani peena zaroori ha?' },
    { label: '🔥 Pre-Workout Guidelines', prompt: 'Pre-workout (C4/Psychotic) lene ka sahi tareeqa aur precautions kia hain?' },
    { label: '🏋️ 5-Day Workout Games Routine', prompt: '5-Day Hypertrophy split me daily kitni games aur kitne heavy sets lagane chahiye?' },
  ];

  const handleAskAi = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const query = customQuestion || userQuery;
    if (!query.trim() || loadingAi) return;

    setLoadingAi(true);
    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        message: query.trim(),
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
        toast.success('AI Coach answered your question!');
      }
    } catch (err: unknown) {
      toast.error(apiError(err, 'AI Coach se rabta nahi ho saka. Dobara koshish karein.'));
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gym_gemini_api_key', trimmed);
      toast.success('Gemini API Key browser me save ho gai ha!');
    } else {
      localStorage.removeItem('gym_gemini_api_key');
      toast.success('Gym App Default AI Engine active ha.');
    }
    setShowApiKeyModal(false);
  };

  const handleCopyAnswer = (text: string, idx: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedAnswerIdx(idx);
    toast.success('AI advice copied to clipboard!');
    setTimeout(() => setCopiedAnswerIdx(null), 2000);
  };

  const handleClearAiChat = () => {
    if (window.confirm('Kia aap AI chat history clear karna chahtay hain?')) {
      setAiAnswers([]);
      toast.success('Chat history cleared');
    }
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

      {latestWeighIn && (
        <div className="mb-4 rounded-xl px-4 py-2.5 bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/20 text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Activity size={15} className="shrink-0" />
          <span>
            Using your latest weigh-in: <strong>{latestWeighIn.weightKg} kg</strong> on{' '}
            {new Date(latestWeighIn.measuredOn).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}.
            The AI coach also sees your progress history.
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
              <span>{copiedPlan ? 'Copied!' : 'Copy Summary'}</span>
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
          />
        )}
      </div>

      {/* Gemini API Key Configuration Modal */}
      {showApiKeyModal && (
        <Modal title="AI Engine & Gemini API Configuration" onClose={() => setShowApiKeyModal(false)}>
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-950 dark:text-purple-200">
              <strong className="block font-bold mb-1">⚡ Automatic AI Active by Default</strong>
              <p className="text-purple-800 dark:text-purple-300 leading-relaxed">
                Gym App backend incorporates our comprehensive sports nutrition AI engine out of the box with zero setup needed!
              </p>
            </div>

            <div>
              <FieldLabel>Custom Google Gemini API Key (Optional)</FieldLabel>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
                If you have a Google AI Studio key (`AIza...`), you can paste it here to run directly on Google Gemini Flash:
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
                Clear Custom Key
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition text-xs"
                >
                  Save Preference
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