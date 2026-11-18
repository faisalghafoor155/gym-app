import type { FeedbackCategory } from '../types';

/** How each feedback topic is written for people. */
export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, string> = {
  general: 'General',
  equipment: 'Equipment',
  cleanliness: 'Cleanliness',
  staff: 'Staff',
  trainer: 'Trainer',
  classes: 'Classes',
  timing: 'Timings',
  other: 'Other',
};
