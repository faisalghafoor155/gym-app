import type { HealthCondition } from '../types';

/** How each condition the questionnaire asks about is written for people. */
export const CONDITION_LABELS: Record<HealthCondition, string> = {
  bp: 'Blood pressure',
  diabetes: 'Diabetes',
  heart: 'Heart condition',
  asthma: 'Asthma / breathing',
  injury: 'Injury (back, knee, shoulder…)',
  surgery: 'Recent surgery',
  pregnancy: 'Pregnancy',
  other: 'Other',
};

/** Short forms for a badge, where the full label will not fit. */
export const CONDITION_SHORT: Record<HealthCondition, string> = {
  bp: 'BP',
  diabetes: 'Diabetes',
  heart: 'Heart',
  asthma: 'Asthma',
  injury: 'Injury',
  surgery: 'Surgery',
  pregnancy: 'Pregnant',
  other: 'Other',
};

export const CONDITIONS = Object.keys(CONDITION_LABELS) as HealthCondition[];
