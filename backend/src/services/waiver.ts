/**
 * The health questionnaire and waiver a member signs at joining.
 *
 * The conditions asked about are in `schemas.ts` (HEALTH_CONDITIONS). The
 * waiver is the gym's to reword; this is what it says when the owner has not.
 */

export const DEFAULT_WAIVER_TEXT = [
  'I confirm that the health information I have given is true and complete, and I will tell the gym if it changes.',
  'I understand that exercise carries a risk of injury. I take part in training, classes and the use of equipment at my own risk, and I will follow the instructions of the staff and trainers.',
  'I will stop exercising and tell a member of staff if I feel pain, dizziness or shortness of breath.',
  'The gym is not responsible for injury caused by my own negligence or a condition I did not declare, or for the loss of personal belongings left on the premises.',
  'I agree to follow the gym rules, and understand that membership fees are not refundable except as the gym states.',
].join('\n\n');

export const waiverFor = (gym: { waiverText: string | null }): string =>
  gym.waiverText?.trim() || DEFAULT_WAIVER_TEXT;
