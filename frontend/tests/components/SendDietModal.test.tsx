import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { aMember, aTrainer, listPage, mockApi } from '../helpers';
import type { MacroResult, MealSlot } from '../../src/components/fitness/data';

/**
 * Sending the calculator's meal plan to a member's app.
 *
 * It has to land as a diet plan assigned to the right member, named after the
 * trainer — their own one unless the owner picks another.
 */

const api = vi.hoisted(() => ({
  current: null as ReturnType<typeof import('../helpers')['mockApi']> | null,
}));

vi.mock('../../src/api/client', () => ({
  default: {
    get: (...args: unknown[]) => api.current!.get(...args as [string]),
    post: (...args: unknown[]) => api.current!.post(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const SendDietModal = (await import('../../src/components/fitness/SendDietModal')).default;

const macros = {
  targetCalories: 2800, proteinGrams: 150, carbsGrams: 350, fatGrams: 80, waterLiters: 3.5,
} as MacroResult;

const meals: MealSlot[] = [{
  name: 'Breakfast', time: '8:00 AM - 9:00 AM', portion: 25,
  calories: 700, protein: 40, carbs: 80, fats: 20, foodIdea: '4 boiled eggs + 2 roti',
}];

const bilal = aTrainer({ id: 'tr-bilal', name: 'Coach Bilal', isActive: true });
const sana = aTrainer({ id: 'tr-sana', name: 'Coach Sana', isActive: true });
const ali = aMember({ id: 'mem-ali', name: 'Ali Khan', trainerId: 'tr-bilal' });

beforeEach(() => {
  api.current = mockApi({
    '/members': listPage([ali]),
    '/trainers': listPage([bilal, sana]),
  });
  api.current.post.mockImplementation(((url: string) =>
    Promise.resolve({ data: url === '/plans/diet' ? { id: 'diet-1' } : {} })) as never);
});

const send = async () => {
  render(<SendDietModal macros={macros} meals={meals} onClose={vi.fn()} />);
  await screen.findByRole('option', { name: /Ali Khan/ });
  await userEvent.selectOptions(screen.getByLabelText(/Member/), 'mem-ali');
};

describe('SendDietModal', () => {
  it('saves the meal plan and assigns it with the member’s own trainer', async () => {
    await send();
    expect(screen.getByLabelText('Trainer')).toHaveValue('tr-bilal');

    await userEvent.click(screen.getByRole('button', { name: 'Send to member' }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalledTimes(2));
    const [dietUrl, diet] = api.current!.post.mock.calls[0] as unknown as [string, {
      name: string; description: string; dietData: { meals: { name: string; items: { name: string; calories: number }[] }[] };
    }];
    expect(dietUrl).toBe('/plans/diet');
    expect(diet.name).toBe('Diet plan for Ali Khan');
    expect(diet.description).toContain('2800 kcal');
    expect(diet.dietData.meals[0]).toMatchObject({
      name: 'Breakfast (8:00 AM - 9:00 AM)',
      items: [{ name: '4 boiled eggs + 2 roti', calories: 700 }],
    });
    expect(api.current!.post.mock.calls[1]).toEqual(['/plans/assign', {
      memberId: 'mem-ali', dietPlanId: 'diet-1', trainerId: 'tr-bilal',
    }]);
  });

  it('names whichever trainer the owner picks', async () => {
    await send();
    await userEvent.selectOptions(screen.getByLabelText('Trainer'), 'tr-sana');

    await userEvent.click(screen.getByRole('button', { name: 'Send to member' }));

    await waitFor(() => expect(api.current!.post).toHaveBeenCalledTimes(2));
    expect(api.current!.post.mock.calls[1]![1]).toMatchObject({ trainerId: 'tr-sana' });
  });
});
