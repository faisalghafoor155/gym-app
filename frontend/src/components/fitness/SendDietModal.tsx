import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import TrainerSelect from '../plans/TrainerSelect';
import { FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import api, { apiError } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import type { DietMeal, Member, Paginated, Plan, Trainer } from '../../types';
import type { MacroResult, MealSlot } from './data';

/**
 * Sends the meal plan on screen to a member's app.
 *
 * It is saved as an ordinary diet plan and assigned like one, so it shows in
 * the member's "My Plans" tab — named after the trainer it comes from — and
 * in the Plans page, where the gym can reuse it for someone else.
 */
export default function SendDietModal({ macros, meals, onClose }: {
  macros: MacroResult;
  meals: MealSlot[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [memberId, setMemberId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
      api.get<Paginated<Trainer>>('/trainers?all=true').then(r => setTrainers(r.data.data)),
    ]).catch(err => toast.error(apiError(err, t('Could not load members'))));
    // Loaded once when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMember = (id: string) => {
    setMemberId(id);
    // Their own trainer is the usual answer; the owner can still change it.
    setTrainerId(members.find(m => m.id === id)?.trainerId ?? '');
  };

  const member = members.find(m => m.id === memberId);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    try {
      // Each meal keeps its time and macros, in the shape the Plans page
      // and the portal already read: one item per meal, the food as its name.
      const dietMeals: DietMeal[] = meals.map(m => ({
        name: `${m.name} (${m.time})`,
        items: [{
          name: m.foodIdea,
          amount: t('{p}g protein · {c}g carbs · {f}g fat', { p: m.protein, c: m.carbs, f: m.fats }),
          calories: m.calories,
        }],
      }));
      const summary = t('{kcal} kcal a day · {p}g protein · {c}g carbs · {f}g fat · {water} L water', {
        kcal: macros.targetCalories, p: macros.proteinGrams, c: macros.carbsGrams,
        f: macros.fatGrams, water: macros.waterLiters,
      });

      const { data: plan } = await api.post<Plan>('/plans/diet', {
        name: t('Diet plan for {name}', { name: member.name }),
        description: notes.trim() ? `${summary}\n\n${notes.trim()}` : summary,
        dietData: { meals: dietMeals },
      });
      await api.post('/plans/assign', {
        memberId: member.id,
        dietPlanId: plan.id,
        trainerId: trainerId || null,
      });

      toast.success(t('Diet plan sent to {name}', { name: member.name }));
      onClose();
    } catch (err) {
      toast.error(apiError(err, t('Could not send the diet plan')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('Send diet plan to member')} onClose={onClose}>
      <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('The member sees this plan in their app under My Plans.')}
        </p>
        <div>
          <FieldLabel htmlFor="send-diet-member" required>{t('Member')}</FieldLabel>
          <select id="send-diet-member" required value={memberId}
            onChange={e => pickMember(e.target.value)} className={inputClass}>
            <option value="">{t('Select member...')}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ''}</option>
            ))}
          </select>
        </div>
        <TrainerSelect id="send-diet-trainer" trainers={trainers} value={trainerId} onChange={setTrainerId} />
        <div>
          <FieldLabel htmlFor="send-diet-notes">{t('Notes for the member')}</FieldLabel>
          <textarea id="send-diet-notes" rows={3} maxLength={1500} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('e.g. No sugar, drink water before every meal')}
            className={inputClass} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryButton}`}>{t('Cancel')}</button>
          <button type="submit" disabled={saving || !member} className={`flex-1 ${primaryButton}`}>
            {saving ? t('Sending…') : t('Send to member')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
