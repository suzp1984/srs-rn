// The package ships index.d.ts but it only exports types (VLCPlayerProps, etc.)
// and does NOT declare a default export (the VLCPlayer class component) nor
// export the class. This augmentation adds the default export and a
// VLCPlayerInstance type so the SRT feature can import the component and type
// the player ref with its imperative methods (stopPlayer, seek, resume).
declare module 'react-native-vlc-media-player' {
  import type {Component} from 'react';

  export type VLCPlayerInstance = {
    stopPlayer(): void;
    seek(pos: number): void;
    resume(): void;
    changeVideoAspectRatio(ratio: string): void;
    autoAspectRatio(useAuto: boolean): void;
  };

  // Named `VlcPlayer` (not `VLCPlayer`) to avoid colliding with the package's
  // module-private `declare class VLCPlayer` in its shipped index.d.ts.
  // Exported as the default, so `import VLCPlayer from '...'` binds this class.
  class VlcPlayer
    extends Component<VLCPlayerProps & {testID?: string}>
    implements VLCPlayerInstance
  {
    stopPlayer(): void;
    seek(pos: number): void;
    resume(): void;
    changeVideoAspectRatio(ratio: string): void;
    autoAspectRatio(useAuto: boolean): void;
  }

  export default VlcPlayer;
}
