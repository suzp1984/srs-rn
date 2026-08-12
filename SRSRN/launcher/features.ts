import type {RootStackParamList} from '../navigation/types';

export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl' | 'HlsUrl' | 'SrtUrl' | 'DashUrl'
>;

export type LauncherFeature = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  color: string;
  destination: LauncherDestination;
  // When true, the launcher card is rendered greyed-out with a "Disabled"
  // badge and its action button does not navigate. Used for features that are
  // wired in but non-functional on the current build (e.g. SRT, whose libVLC
  // stack lacks libsrt). `disabledReason` is shown as user-facing text.
  disabled?: boolean;
  disabledReason?: string;
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
    disabled: true,
    disabledReason: 'SRT playback is not yet supported in this build.',
  },
  {
    id: 'dash',
    title: 'DASH Play',
    description: 'Play a DASH stream from an SRS server via VLC.',
    actionLabel: 'Open DASH',
    color: '#0e7490',
    destination: 'DashUrl',
  },
];
