import type { ComponentType } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Intro, Outro } from '../scenes/Brand';
import * as S from './scenes';
import type { SceneProps } from './scenes';

/** Every feature, in the order a gym owner would meet them. Frames at 30 fps. */
const FEATURES: { id: string; Component: ComponentType<SceneProps>; duration: number }[] = [
  { id: 'onboarding', Component: S.Onboarding, duration: 150 },
  { id: 'dashboard', Component: S.Dashboard, duration: 150 },
  { id: 'members', Component: S.MembersScene, duration: 150 },
  { id: 'renewals', Component: S.Renewals, duration: 150 },
  { id: 'attendance', Component: S.AttendanceScene, duration: 165 },
  { id: 'analytics', Component: S.Analytics, duration: 135 },
  { id: 'plans', Component: S.PlansScene, duration: 135 },
  { id: 'payments', Component: S.Payments, duration: 150 },
  { id: 'collection', Component: S.Collection, duration: 150 },
  { id: 'expenses', Component: S.Expenses, duration: 140 },
  { id: 'supplements', Component: S.Supplements, duration: 140 },
  { id: 'trainers', Component: S.Trainers, duration: 140 },
  { id: 'classes', Component: S.Classes, duration: 140 },
  { id: 'workout-diet', Component: S.WorkoutDiet, duration: 140 },
  { id: 'calculator', Component: S.Calculator_, duration: 150 },
  { id: 'reminders', Component: S.Reminders, duration: 150 },
  { id: 'portal', Component: S.Portal, duration: 150 },
  { id: 'staff', Component: S.Staff, duration: 140 },
  { id: 'security', Component: S.Security, duration: 150 },
  { id: 'anywhere', Component: S.Anywhere, duration: 150 },
];

const INTRO = 90;
const OUTRO = 105;

export const FULL_FRAMES = INTRO + OUTRO + FEATURES.reduce((t, f) => t + f.duration, 0);

export const GymProFull = () => {
  let from = INTRO;
  return (
    <AbsoluteFill style={{ background: '#0f172a' }}>
      <Sequence name="intro" durationInFrames={INTRO}><Intro duration={INTRO} /></Sequence>
      {FEATURES.map(({ id, Component, duration }, i) => {
        const start = from;
        from += duration;
        return (
          <Sequence key={id} name={id} from={start} durationInFrames={duration}>
            <Component duration={duration} index={i + 1} total={FEATURES.length} />
          </Sequence>
        );
      })}
      <Sequence name="outro" from={from} durationInFrames={OUTRO}><Outro duration={OUTRO} line="20 features · one app · built for Pakistani gyms" /></Sequence>
    </AbsoluteFill>
  );
};
