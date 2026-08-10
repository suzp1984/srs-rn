// The package's index.js is CommonJS: `module.exports = {VLCPlayer, VlCPlayerView}`.
// There is NO default export, and the shipped index.d.ts exports only types
// (VLCPlayerProps, etc.) - it declares `class VLCPlayer` but does NOT export it.
// So `import VLCPlayer from '...'` resolves to the namespace object (not the
// class) and `<VLCPlayer>` fails at runtime with "Element type is invalid".
// This augmentation adds the named `VLCPlayer` export (the class component,
// whose instances expose imperative PlaybackMethods) and a VLCPlayerInstance
// type, so `import {VLCPlayer} from '...'` resolves with types.
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
  // Exported as the named `VLCPlayer` to match the runtime CommonJS export.
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

  export {VlcPlayer as VLCPlayer};
}
