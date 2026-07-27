import type {RootStackParamList} from '../navigation/types';

export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl'
>;

export type LauncherFeature = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  color: string;
  destination: LauncherDestination;
};

export const LAUNCHER_FEATURES: LauncherFeature[] = [
  {
    id: 'whip',
    title: 'WHIP Publish',
    description: 'Publish camera and microphone to an SRS server via WHIP.',
    actionLabel: 'Open WHIP',
    color: '#2f6fdb',
    destination: 'WhipUrl',
  },
  {
    id: 'whep',
    title: 'WHEP Play',
    description: 'Play a remote stream from an SRS server via WHEP.',
    actionLabel: 'Open WHEP',
    color: '#0f8f6c',
    destination: 'WhepUrl',
  },
];
