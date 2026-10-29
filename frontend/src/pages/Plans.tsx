import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Dumbbell, Utensils, UserPlus, Trash, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import Modal from '../components/Modal';
import TrainerSelect from '../components/plans/TrainerSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Page, PageHeader, Card, PageLoader, EmptyState, SegmentedControl, FieldLabel,
  inputClass, primaryButton, secondaryButton,
} from '../components/ui';
import api, { apiError } from '../api/client';
import type { Plan, Member, Paginated, WorkoutExercise, DailyWorkout, DietItem, DietMeal, Trainer } from '../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

type Tab = 'workout' | 'diet';

// Labels, days and meal names are the English, which is also what a plan
// stores; they are translated where they are drawn.
const TABS = [
  { value: 'workout' as const, label: 'Workout' },
  { value: 'diet' as const, label: 'Diet' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


export default function Plans() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('workout');
  const [workoutPlans, setWorkoutPlans] = useState<Plan[]>([]);
  const [dietPlans, setDietPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Core fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Structured Workouts state
  const [dailyWorkouts, setDailyWorkouts] = useState<DailyWorkout[]>(
    DAYS_OF_WEEK.map(day => ({ day, exercises: [] }))
  );

  // Structured Diets state
  const [dietMeals, setDietMeals] = useState<DietMeal[]>([
    { name: 'Breakfast', items: [] },
    { name: 'Lunch', items: [] },
    { name: 'Dinner', items: [] },
    { name: 'Snacks', items: [] },
  ]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/plans/${tab}/${deleting.id}`);
      toast.success(t('Plan deleted'));
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not delete plan')));
    } finally {
      setDeletingBusy(false);
    }
  };

  const load = () =>
    Promise.all([
      api.get<Plan[]>('/plans/workout').then(r => setWorkoutPlans(r.data)),
      api.get<Plan[]>('/plans/diet').then(r => setDietPlans(r.data)),
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
      api.get<Paginated<Trainer>>('/trainers?all=true').then(r => setTrainers(r.data.data)),
    ])
      .catch(err => toast.error(apiError(err, t('Could not load plans'))))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const plans = tab === 'workout' ? workoutPlans : dietPlans;
  const TabIcon = tab === 'workout' ? Dumbbell : Utensils;

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        ...(tab === 'workout'
          ? { workoutData: { days: dailyWorkouts.filter(w => w.exercises.length > 0) } }
          : { dietData: { meals: dietMeals.filter(m => m.items.length > 0) } }
        ),
      };

      await api.post(`/plans/${tab}`, payload);
      toast.success(t('Plan created successfully'));
      setShowCreate(false);
      setName('');
      setDescription('');
      setDailyWorkouts(DAYS_OF_WEEK.map(day => ({ day, exercises: [] })));
      setDietMeals([
        { name: 'Breakfast', items: [] },
        { name: 'Lunch', items: [] },
        { name: 'Dinner', items: [] },
        { name: 'Snacks', items: [] },
      ]);
      await load();
    } catch (err) {
      toast.error(apiError(err, t('Could not create the plan')));
    } finally {
      setSaving(false);
    }
  };

  const addExercise = (dayIndex: number) => {
    const updated = [...dailyWorkouts];
    updated[dayIndex]!.exercises.push({ name: '', sets: 3, reps: '12', weight: '' });
    setDailyWorkouts(updated);
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...dailyWorkouts];
    updated[dayIndex]!.exercises.splice(exerciseIndex, 1);
    setDailyWorkouts(updated);
  };

  const updateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    field: keyof WorkoutExercise,
    value: string | number
  ) => {
    const updated = [...dailyWorkouts];
    updated[dayIndex]!.exercises[exerciseIndex] = {
      ...updated[dayIndex]!.exercises[exerciseIndex]!,
      [field]: value,
    };
    setDailyWorkouts(updated);
  };

  const addDietItem = (mealIndex: number) => {
    const updated = [...dietMeals];
    updated[mealIndex]!.items.push({ name: '', amount: '1 serving', calories: 0 });
    setDietMeals(updated);
  };

  const removeDietItem = (mealIndex: number, itemIndex: number) => {
    const updated = [...dietMeals];
    updated[mealIndex]!.items.splice(itemIndex, 1);
    setDietMeals(updated);
  };

  const updateDietItem = (
    mealIndex: number,
    itemIndex: number,
    field: keyof DietItem,
    value: string | number
  ) => {
    const updated = [...dietMeals];
    updated[mealIndex]!.items[itemIndex] = {
      ...updated[mealIndex]!.items[itemIndex]!,
      [field]: value,
    };
    setDietMeals(updated);
  };

  const [assignForm, setAssignForm] = useState({ memberId: '', workoutPlanId: '', dietPlanId: '', trainerId: '' });

  const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignForm.workoutPlanId && !assignForm.dietPlanId) {
      toast.error(t('Pick a workout plan, a diet plan, or both'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/plans/assign', {
        memberId: assignForm.memberId,
        ...(assignForm.workoutPlanId && { workoutPlanId: assignForm.workoutPlanId }),
        ...(assignForm.dietPlanId && { dietPlanId: assignForm.dietPlanId }),
        ...(assignForm.trainerId && { trainerId: assignForm.trainerId }),
      });
      toast.success(t('Plans assigned to member'));
      setShowAssign(false);
      setAssignForm({ memberId: '', workoutPlanId: '', dietPlanId: '', trainerId: '' });
    } catch (err) {
      toast.error(apiError(err, t('Could not assign the plan')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        title={t('Plans')}
        subtitle={t('What members train to and eat by')}
        action={
          <div className="flex gap-2">
            <Link to="/calculator" className={secondaryButton} title={t('Open Fitness & Diet Calculator')}>
              <Calculator size={15} className="text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">{t('Calculator')}</span>
            </Link>
            <button onClick={() => setShowAssign(true)} className={secondaryButton}>
              <UserPlus size={15} />
              <span className="hidden sm:inline">{t('Assign to Member')}</span>
              <span className="sm:hidden">{t('Assign')}</span>
            </button>
            <button onClick={() => setShowCreate(true)} className={primaryButton}>
              <Plus size={16} />
              <span className="hidden sm:inline">{t('New Plan')}</span><span className="sm:hidden">{t('New')}</span>
            </button>
          </div>
        }
      />

      <div className="mb-5">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { ...TABS[0]!, label: t(TABS[0]!.label), count: workoutPlans.length },
            { ...TABS[1]!, label: t(TABS[1]!.label), count: dietPlans.length },
          ]}
        />
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={TabIcon}
          title={tab === 'workout' ? t('No workout plans yet') : t('No diet plans yet')}
          hint={tab === 'workout'
            ? t('Write the routines your trainers hand out, then assign them to members.')
            : t('Write the meal plans your trainers hand out, then assign them to members.')}
          action={
            <button onClick={() => setShowCreate(true)} className={primaryButton}>
              <Plus size={16} /> {tab === 'workout' ? t('Create a workout plan') : t('Create a diet plan')}
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {plans.map(p => {
            const isExpanded = expandedPlan === p.id;
            const wData = p.workoutData as { days: DailyWorkout[] } | undefined;
            const dData = p.dietData as { meals: DietMeal[] } | undefined;

            return (
              <Card key={p.id} className="p-5 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tab === 'workout' ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600' : 'bg-green-50 dark:bg-green-500/15 text-green-600'
                    }`}>
                      <TabIcon size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 min-w-0 truncate pt-1">{p.name}</h3>
                      {p.description && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{p.description}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setDeleting(p)}
                      aria-label={t('Delete {name}', { name: p.name })}
                      title={t('Delete plan')}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash size={16} />
                    </button>
                    <button
                      onClick={() => setExpandedPlan(isExpanded ? null : p.id)}
                      aria-label={isExpanded ? t('Collapse plan') : t('Expand plan')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
                    {tab === 'workout' && wData?.days && wData.days.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {wData.days.map((wd, i) => (
                          <div key={i} className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                            <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">{t(wd.day)}</h4>
                            <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
                              {wd.exercises.map((ex, j) => (
                                <li key={j} className="flex justify-between">
                                  <span>{ex.name}</span>
                                  <span className="text-gray-400">{ex.sets}x{ex.reps} {ex.weight ? `(${ex.weight}kg)` : ''}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : tab === 'diet' && dData?.meals && dData.meals.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {dData.meals.map((meal, i) => (
                          <div key={i} className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                            <h4 className="font-semibold text-sm text-green-600 dark:text-green-400 mb-2">{t(meal.name)}</h4>
                            <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
                              {meal.items.map((item, j) => (
                                <li key={j} className="flex justify-between">
                                  <span>{item.name} ({item.amount})</span>
                                  <span className="text-gray-400">{item.calories} kcal</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{t('No structured data attached to this plan')}</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                  {t('Added {date}', { date: new Date(p.createdAt).toLocaleDateString() })}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title={tab === 'workout' ? t('Create Workout Plan') : t('Create Diet Plan')} onClose={() => setShowCreate(false)}>
          <form onSubmit={e => void handleCreate(e)} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <FieldLabel htmlFor="plans-plan-name" required>{t('Plan Name')}</FieldLabel>
              <input id="plans-plan-name" required value={name} onChange={e => setName(e.target.value)}
                className={inputClass} placeholder={t('e.g. Beginner Weight Loss')} />
            </div>
            <div>
              <FieldLabel htmlFor="plans-description">{t('Description')}</FieldLabel>
              <input id="plans-description" value={description}
                onChange={e => setDescription(e.target.value)}
                className={inputClass}
                placeholder={t('e.g. 3-day split, High Protein diet...')} />
            </div>

            {/* Structured Workouts Builder */}
            {tab === 'workout' && (
              <div className="space-y-4 pt-2">
                <FieldLabel>{t('Routines by Day')}</FieldLabel>
                {dailyWorkouts.map((dw, dayIdx) => (
                  <div key={dw.day} className="border border-gray-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-gray-700 dark:text-slate-300">{t(dw.day)}</span>
                      <button
                        type="button"
                        onClick={() => addExercise(dayIdx)}
                        className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} /> {t('Add Exercise')}
                      </button>
                    </div>

                    {dw.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          required
                          value={ex.name}
                          onChange={e => updateExercise(dayIdx, exIdx, 'name', e.target.value)}
                          className={`${inputClass} col-span-5 text-xs py-1`}
                          placeholder={t('Exercise Name')}
                        />
                        <input
                          required
                          type="number"
                          value={ex.sets}
                          onChange={e => updateExercise(dayIdx, exIdx, 'sets', parseInt(e.target.value) || 0)}
                          className={`${inputClass} col-span-2 text-xs py-1`}
                          placeholder={t('Sets')}
                        />
                        <input
                          required
                          value={ex.reps}
                          onChange={e => updateExercise(dayIdx, exIdx, 'reps', e.target.value)}
                          className={`${inputClass} col-span-2 text-xs py-1`}
                          placeholder={t('Reps')}
                        />
                        <input
                          value={ex.weight}
                          onChange={e => updateExercise(dayIdx, exIdx, 'weight', e.target.value)}
                          className={`${inputClass} col-span-2 text-xs py-1`}
                          placeholder={t('Wt (kg)')}
                        />
                        <button
                          type="button"
                          onClick={() => removeExercise(dayIdx, exIdx)}
                          aria-label={t('Remove exercise')}
                          className="col-span-1 text-red-500 hover:text-red-700 p-1 flex justify-center"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Structured Diet Builder */}
            {tab === 'diet' && (
              <div className="space-y-4 pt-2">
                <FieldLabel>{t('Meals Planner')}</FieldLabel>
                {dietMeals.map((meal, mealIdx) => (
                  <div key={meal.name} className="border border-gray-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-gray-700 dark:text-slate-300">{t(meal.name)}</span>
                      <button
                        type="button"
                        onClick={() => addDietItem(mealIdx)}
                        className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline"
                      >
                        <Plus size={14} /> {t('Add Food Item')}
                      </button>
                    </div>

                    {meal.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          required
                          value={item.name}
                          onChange={e => updateDietItem(mealIdx, itemIdx, 'name', e.target.value)}
                          className={`${inputClass} col-span-5 text-xs py-1`}
                          placeholder={t('Food Item')}
                        />
                        <input
                          required
                          value={item.amount}
                          onChange={e => updateDietItem(mealIdx, itemIdx, 'amount', e.target.value)}
                          className={`${inputClass} col-span-4 text-xs py-1`}
                          placeholder={t('e.g. 100g, 2 eggs')}
                        />
                        <input
                          required
                          type="number"
                          value={item.calories || ''}
                          onChange={e => updateDietItem(mealIdx, itemIdx, 'calories', parseInt(e.target.value) || 0)}
                          className={`${inputClass} col-span-2 text-xs py-1`}
                          placeholder="kcal"
                        />
                        <button
                          type="button"
                          onClick={() => removeDietItem(mealIdx, itemIdx)}
                          aria-label={t('Remove food item')}
                          className="col-span-1 text-red-500 hover:text-red-700 p-1 flex justify-center"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className={`flex-1 ${secondaryButton}`}>
                {t('Cancel')}
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                {saving ? t('Creating...') : t('Create Plan')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAssign && (
        <Modal title={t('Assign Plan to Member')} onClose={() => setShowAssign(false)}>
          <form onSubmit={e => void handleAssign(e)} className="space-y-4">
            <div>
              <FieldLabel htmlFor="plans-member" required>{t('Member')}</FieldLabel>
              <select id="plans-member" required value={assignForm.memberId}
                // Their own trainer is the usual answer; it can still be changed.
                onChange={e => {
                  const memberId = e.target.value;
                  setAssignForm(f => ({
                    ...f, memberId,
                    trainerId: members.find(m => m.id === memberId)?.trainerId ?? '',
                  }));
                }}
                className={inputClass}>
                <option value="">{t('Select member...')}</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.phone ? ` · ${m.phone}` : ''}
                  </option>
                ))}
              </select>
              {members.length === 0 && (
                <p className="text-xs text-yellow-700 mt-1.5">
                  {t('No members yet — add a member before assigning a plan.')}
                </p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="plans-workout-plan">{t('Workout Plan')}</FieldLabel>
              <select id="plans-workout-plan" value={assignForm.workoutPlanId}
                onChange={e => setAssignForm(f => ({ ...f, workoutPlanId: e.target.value }))}
                className={inputClass}>
                <option value="">{t('None')}</option>
                {workoutPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="plans-diet-plan">{t('Diet Plan')}</FieldLabel>
              <select id="plans-diet-plan" value={assignForm.dietPlanId}
                onChange={e => setAssignForm(f => ({ ...f, dietPlanId: e.target.value }))}
                className={inputClass}>
                <option value="">{t('None')}</option>
                {dietPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <TrainerSelect id="plans-trainer" trainers={trainers} value={assignForm.trainerId}
              onChange={trainerId => setAssignForm(f => ({ ...f, trainerId }))} />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAssign(false)}
                className={`flex-1 ${secondaryButton}`}>
                {t('Cancel')}
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryButton}`}>
                {saving ? t('Assigning...') : t('Assign')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={t('Delete plan')}
          message={t('Delete "{name}"? Members it was assigned to will no longer see it in their portal.', { name: deleting.name })}
          busy={deletingBusy}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Page>
  );
}
