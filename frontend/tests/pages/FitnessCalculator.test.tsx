import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderPage } from '../helpers';
import { calculateMacros, calculateOneRm, computeGainerNumbers } from '../../src/components/fitness/calc';

/**
 * The calculator was one 2,000-line component; its maths now lives in
 * components/fitness/calc.ts and each tab in its own file. These tests pin the
 * parts that must not drift in a split — the numbers on screen are the ones the
 * pure functions produce, and every tab still renders.
 */

vi.mock('../../src/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
// Staff by default: no member id, so the page never asks for weigh-ins.
const auth = vi.hoisted(() => ({ current: { user: { id: 'me', memberId: null as string | null } } }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth.current }));

const FitnessCalculator = (await import('../../src/pages/FitnessCalculator')).default;

const defaults = {
  gender: 'male' as const, weightKg: 70, heightCm: 175, age: 25,
  activityLevel: 1.55, goal: 'bulk_lean' as const, takingCreatine: true,
  selectedGainer: 'anabolic_mass',
};

describe('calc.ts', () => {
  it('computes BMR from Mifflin-St Jeor and keeps the targets consistent', () => {
    const m = calculateMacros(defaults);
    expect(m.bmr).toBe(Math.round(10 * 70 + 6.25 * 175 - 5 * 25 + 5));
    expect(m.tdee).toBe(Math.round(m.bmr * 1.55));
    expect(m.targetCalories).toBeGreaterThan(m.tdee); // a lean bulk eats above maintenance
    expect(m.proteinGrams).toBeGreaterThan(0);
  });

  it('1RM is the lifted weight for a single, and Epley above that', () => {
    expect(calculateOneRm({ liftWeight: 100, liftReps: 1, weightKg: 70, exercise: 'bench_press' }).oneRm).toBe(100);
    expect(calculateOneRm({ liftWeight: 60, liftReps: 8, weightKg: 70, exercise: 'bench_press' }).oneRm)
      .toBe(Math.round(60 * (1 + 8 / 30)));
  });

  it('a half serving takes half the gainer, and food covers the rest', () => {
    const half = computeGainerNumbers('anabolic_mass', 'half', 3000, 150);
    const full = computeGainerNumbers('anabolic_mass', 'full', 3000, 150);
    expect(half.gainerCalories).toBe(Math.round(full.gainerCalories / 2));
    expect(half.foodCaloriesNeeded).toBe(Math.max(800, 3000 - half.gainerCalories));
  });
});

describe('FitnessCalculator page', () => {
  it('shows the calculated target calories on the diet tab', async () => {
    renderPage(<FitnessCalculator />);
    const { targetCalories } = calculateMacros(defaults);
    expect((await screen.findAllByText(targetCalories.toLocaleString())).length).toBeGreaterThan(0);
  });

  it.each([
    ['💊 Mass Gainer & Stack'],
    ['🏋️‍♂️ Workout & Games'],
    ['✨ AI Nutrition Coach'],
    ['Auto Meal Plan'],
    ['Calories & Diet'],
  ])('opens the %s tab without crashing', async (label) => {
    renderPage(<FitnessCalculator />);
    await userEvent.click(await screen.findByText(label));
    expect(screen.getByText(label)).toBeTruthy();
    expect(document.body.textContent!.length).toBeGreaterThan(500);
  });

  it('the meal plan splits the food calories across the day', async () => {
    renderPage(<FitnessCalculator />);
    await userEvent.click(await screen.findByText('Auto Meal Plan'));
    expect(screen.getByText('Breakfast')).toBeTruthy();
  });
});

describe('FitnessCalculator for a member', () => {
  it('starts from the member\'s latest logged weight', async () => {
    const api = (await import('../../src/api/client')).default as unknown as { get: ReturnType<typeof vi.fn> };
    api.get.mockResolvedValueOnce({
      data: { data: [
        { id: 'w2', weightKg: null, measuredOn: '2026-10-20T00:00:00.000Z' },
        { id: 'w1', weightKg: 82.5, measuredOn: '2026-10-10T00:00:00.000Z' },
      ] },
    });
    auth.current = { user: { id: 'me', memberId: 'member-1' } };
    try {
      renderPage(<FitnessCalculator />);
      expect(await screen.findByText(/latest weigh-in/i)).toBeTruthy();
      expect(api.get).toHaveBeenCalledWith('/me/measurements');
      expect(screen.getByDisplayValue('82.5')).toBeTruthy();
    } finally {
      auth.current = { user: { id: 'me', memberId: null } };
    }
  });
});
