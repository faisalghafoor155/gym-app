import { Composition } from 'remotion';
import { GymProDemo, TOTAL_FRAMES } from './GymProDemo';
import { GymProFull, FULL_FRAMES } from './full/GymProFull';
import { FPS } from './theme';

export const Root = () => (
  <>
    <Composition
      id="GymProDemo"
      component={GymProDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="GymProFull"
      component={GymProFull}
      durationInFrames={FULL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
