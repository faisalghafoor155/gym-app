import { AbsoluteFill, Sequence } from 'remotion';
import { Intro, Outro } from './scenes/Brand';
import { Members } from './scenes/Members';
import { CheckIn } from './scenes/CheckIn';
import { Fees } from './scenes/Fees';
import { WhatsApp } from './scenes/WhatsApp';
import { Mobile } from './scenes/Mobile';

/** Scene order and length in frames (30 fps). */
const SCENES = [
  { id: 'intro', Component: Intro, duration: 90 },
  { id: 'members', Component: Members, duration: 150 },
  { id: 'checkin', Component: CheckIn, duration: 165 },
  { id: 'fees', Component: Fees, duration: 150 },
  { id: 'whatsapp', Component: WhatsApp, duration: 135 },
  { id: 'mobile', Component: Mobile, duration: 120 },
  { id: 'outro', Component: Outro, duration: 90 },
];

export const TOTAL_FRAMES = SCENES.reduce((t, s) => t + s.duration, 0);

export const GymProDemo = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: '#0f172a' }}>
      {SCENES.map(({ id, Component, duration }) => {
        const start = from;
        from += duration;
        return (
          <Sequence key={id} name={id} from={start} durationInFrames={duration}>
            <Component duration={duration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
