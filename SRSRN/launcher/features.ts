import type {RootStackParamList} from '../navigation/types';

export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl' | 'HlsUrl' | 'SrtUrl'
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
  {
    id: 'hls',
    title: 'HLS Play',
    description: 'Play an HLS stream from an SRS server.',
    actionLabel: 'Open HLS',
    color: '#b26a00',
    destination: 'HlsUrl',
  },
  {
    id: 'srt',
    title: 'SRT Play',
    description: 'Play an SRT stream from an SRS server via VLC.',
    actionLabel: 'Open SRT',
    color: '#7a4fbf',
    destination: 'SrtUrl',
  },
];
