# SRS RN SRT Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SRT playback as a fourth protocol feature on the SRS RN launcher, played via libVLC (`react-native-vlc-media-player`), validating the architecture with a third distinct media stack.

**Architecture:** A new `features/srt/` directory owns its URL-entry screen, player screen, validation, types, and a `useSrtSession` hook that mirrors `useHlsSession`/`useWhepSession`'s generation-guarded lifecycle. Because `VLCPlayer` exposes an imperative `stopPlayer()` ref method (unlike `react-native-video`), `cleanupAttempt` performs a *true imperative stop* - the closest WHEP mirror of the four features. The player is a component-mounted `<VLCPlayer>`; there is no PeerConnection, SDP, fetch, or AbortController.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-vlc-media-player 1.0.98 (new), react-native-video 6.19.2 + react-native-webrtc 124.0.7 (unchanged), React Navigation 7, Jest 29 + react-test-renderer 19.

## Global Constraints

- App root is `SRSRN/` (an independent app). Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- React Native `0.86.0`, React `19.2.3`, TypeScript `^5.8.3`, `react-native-webrtc` `124.0.7`, `react-native-video` `6.19.2` (all unchanged).
- `react-native-vlc-media-player` pinned to `1.0.98` (latest stable). Verify RN 0.86 + MobileVLCKit compatibility during implementation; the package ships `index.d.ts` but it does NOT export the `VLCPlayer` class, so a local type augmentation (`SRSRN/types/react-native-vlc-media-player.d.ts`) is added in Task 1.
- Do NOT modify `features/whip/`, `features/whep/`, `features/hls/`, `WHIPPublisher/`, or `WHEPPlayer/`. The only exception is `SRSRN/__tests__/HomeScreen.test.tsx` (Task 4): rename the synthetic extra launcher entry from `id: 'srt'` to `id: 'dash'` (it currently uses `srt`, which the real SRT entry this feature adds would collide with).
- Default SRT URL (verbatim): `srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request`.
- No new capture permissions (play-only). iOS adds `NSLocalNetworkUsageDescription` to `Info.plist` (MobileVLCKit uses the local network). Android adds the `libc++_shared.so` Gradle workaround to `android/app/build.gradle`. ATS is irrelevant to SRT (UDP, not HTTP).
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks on host-component testIDs (React 19 doubles `View`/forwardRef host counts; never assert exact counts).
- Commits land on `feature/srs-rn-unified-app`. Conventional Commits (`feat(srsrn):`, `test(srsrn):`, `chore(srsrn):`). End every commit message with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`. Use `git commit -F - <<'COMMIT_MSG' ... COMMIT_MSG` (heredoc) - never `-m "$(cat <<...)"` nesting.
- `cleanupAttempt` calls `playerRef.current?.stopPlayer()` (true imperative mirror) plus sets `attempt.closed = true`. No `AbortController` (libVLC pulls the stream; late `onPlaying`/`onError` are dropped by the `isCurrent(attempt)` guard).
- `useSrtSession()` takes no argument (the URL is passed to `<VLCPlayer source={{uri: srtUrl}}>` by the screen).
- libVLC's `onError` payload is `{target: number}` with no message field, so user-visible SRT errors are the generic `'Playback error'`. Do not fabricate a more specific message.

---

## File Structure

```text
SRSRN/
├── package.json                              # +react-native-vlc-media-player 1.0.98 (Task 1)
├── package-lock.json                         # updated (Task 1)
├── jest.setup.js                             # +jest.mock('react-native-vlc-media-player') (Task 1)
├── types/
│   └── react-native-vlc-media-player.d.ts    # +module augmentation: default export + VLCPlayerInstance (Task 1)
├── ios/Podfile.lock                          # +MobileVLCKit (Task 1)
├── ios/SRSRN/Info.plist                      # +NSLocalNetworkUsageDescription (Task 1)
├── android/app/build.gradle                  # +libc++_shared.so workaround (Task 1)
├── navigation/types.ts                       # +SrtUrl, +SrtPlayer (Task 2)
├── navigation/RootNavigator.tsx              # +2 Stack.Screen (Task 4)
├── launcher/features.ts                      # +srt entry, +SrtUrl in union (Task 4)
├── features/srt/                             # new feature directory (Tasks 2-3)
│   ├── validation.ts                         # Task 2
│   ├── SrtUrlScreen.tsx                      # Task 2
│   ├── types.ts                              # Task 3
│   ├── useSrtSession.ts                      # Task 3
│   └── SrtPlayerScreen.tsx                   # Task 3
└── __tests__/
    ├── srt-validation.test.ts                # Task 2
    ├── SrtUrlScreen.test.tsx                 # Task 2
    ├── SrtPlayerScreen.test.tsx              # Task 3
    └── HomeScreen.test.tsx                   # rename synthetic extra srt->dash (Task 4)
```

Each file has one responsibility; the feature owns its screens, validation, types, lifecycle hook, and tests, mirroring `features/hls/`.

---

### Task 1: Install react-native-vlc-media-player, jest mock, type augmentation, and native config

**Files:**
- Modify: `SRSRN/package.json` (add `"react-native-vlc-media-player": "1.0.98"`)
- Modify: `SRSRN/package-lock.json` (regenerated by npm)
- Modify: `SRSRN/jest.setup.js` (append `jest.mock('react-native-vlc-media-player', ...)`)
- Create: `SRSRN/types/react-native-vlc-media-player.d.ts` (module augmentation)
- Modify: `SRSRN/ios/Podfile.lock` (add MobileVLCKit + transitives)
- Modify: `SRSRN/ios/SRSRN/Info.plist` (add `NSLocalNetworkUsageDescription`)
- Modify: `SRSRN/android/app/build.gradle` (add `libc++_shared.so` workaround)

**Interfaces:**
- Produces: a `react-native-vlc-media-player` jest mock exposing `{ __esModule, default: VLCPlayer, VLCPlayer, __mockVlcInstances, __resetVlcMocks }`, where `VLCPlayer` is a `forwardRef` component recording each mounted instance (with `__fireOnPlaying`/`__fireOnError`/`__fireOnLoad` and a `stopPlayer` jest.fn()) into `__mockVlcInstances`. Also produces the type augmentation that adds `export default VlcPlayer` (a `Component` subclass implementing `VLCPlayerInstance`) and `export type VLCPlayerInstance` so Task 3 can `import VLCPlayer from 'react-native-vlc-media-player'` and type the player ref.

**Steps:**

- [ ] **Step 1: Install the dependency**

```bash
cd SRSRN && npm install react-native-vlc-media-player@1.0.98
```

Expected: `package.json` `dependencies` gains `"react-native-vlc-media-player": "1.0.98"`; `package-lock.json` updated.

- [ ] **Step 2: Verify resolution**

```bash
cd SRSRN && npm ls react-native-vlc-media-player
```

Expected: `react-native-vlc-media-player@1.0.98` with no unmet peer dependency errors (the package declares no peer deps).

- [ ] **Step 3: Install the iOS pod (auto-linked)**

```bash
cd SRSRN && pod install --project-directory=ios
```

Expected: `Podfile.lock` gains `MobileVLCKit` (and transitives). If the CocoaPods CDN or Xcode is unavailable, note the failure and proceed - JS tests do not require pods; Task 5 retries. The main app `project.pbxproj` may or may not change (RN 0.86 auto-links via the Pods project); commit whatever `pod install` modifies.

- [ ] **Step 4: Add the `react-native-vlc-media-player` jest mock to `jest.setup.js`**

Append the following block to `SRSRN/jest.setup.js`, after the existing `jest.mock('react-native-video', ...)` block:

```js
jest.mock('react-native-vlc-media-player', () => {
  const React = require('react');
  const mockVlcInstances = [];

  function makeInstance() {
    const instance = {
      stopPlayer: jest.fn(),
      seek: jest.fn(),
      resume: jest.fn(),
      __onPlaying: null,
      __onError: null,
      __onLoad: null,
      __fireOnPlaying(payload) {
        if (instance.__onPlaying) {
          instance.__onPlaying(payload);
        }
      },
      __fireOnError(payload) {
        if (instance.__onError) {
          instance.__onError(payload);
        }
      },
      __fireOnLoad(payload) {
        if (instance.__onLoad) {
          instance.__onLoad(payload);
        }
      },
    };
    mockVlcInstances.push(instance);
    return instance;
  }

  const VLCPlayer = React.forwardRef((props, ref) => {
    const instanceRef = React.useRef(null);
    if (instanceRef.current === null) {
      instanceRef.current = makeInstance();
    }
    const instance = instanceRef.current;
    // Re-bind the latest onPlaying/onError/onLoad on every render so a
    // per-attempt closure (see useSrtSession) is what __fire* invokes.
    instance.__onPlaying = props.onPlaying;
    instance.__onError = props.onError;
    instance.__onLoad = props.onLoad;
    React.useImperativeHandle(ref, () => instance, [instance]);
    // NOTE: deliberately no cleanup effect that nulls the __on* handlers -
    // tests must be able to fire late events on a stale/unmounted instance to
    // verify the isCurrent guard drops them.
    return React.createElement('VLCPlayer', {testID: props.testID});
  });

  return {
    __esModule: true,
    default: VLCPlayer,
    VLCPlayer,
    __mockVlcInstances: mockVlcInstances,
    __resetVlcMocks() {
      mockVlcInstances.length = 0;
    },
  };
});
```

- [ ] **Step 5: Create the type augmentation `types/react-native-vlc-media-player.d.ts`**

The package's shipped `index.d.ts` exports only types (`VLCPlayerProps`, etc.) and does NOT export the `VLCPlayer` class or declare a default export. With `allowSyntheticDefaultImports: true`, `import VLCPlayer from 'react-native-vlc-media-player'` would otherwise resolve to an empty namespace and `<VLCPlayer>` would fail to type-check. This augmentation adds the default export and a `VLCPlayerInstance` type. Create `SRSRN/types/react-native-vlc-media-player.d.ts`:

```ts
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
```

- [ ] **Step 6: Add `NSLocalNetworkUsageDescription` to `ios/SRSRN/Info.plist`**

`MobileVLCKit` uses the local network when playing from local-network sources such as `srt://192.168.1.100:10080`; iOS 14+ requires this key. Insert the two lines immediately after the `NSMicrophoneUsageDescription` string and before `RCTNewArchEnabled`, so the result is:

```xml
	<key>NSMicrophoneUsageDescription</key>
	<string>Microphone permission is required for audio streaming</string>
	<key>NSLocalNetworkUsageDescription</key>
	<string>SRS RN uses the local network to play SRT streams from your SRS server.</string>
	<key>RCTNewArchEnabled</key>
	<true/>
```

- [ ] **Step 7: Add the `libc++_shared.so` workaround to `android/app/build.gradle`**

`react-native` (`react-android`) and `LibVLC` both ship `libc++_shared.so`, and `libvlc-all` crashes when using the react-native copy. Insert the following block at the **top level of the file** (after the closing `}` of the `android { ... }` block and before the `dependencies { ... }` block):

```gradle
// react-native-vlc-media-player: react-android and LibVLC both ship
// libc++_shared.so, and libvlc-all crashes when using the react-android copy,
// so delete the react-android copy before the native-libs merge task runs.
// See react-native-vlc-media-player README. (RN >= 0.71 uses
// "jetified-react-android", not "jetified-react-native".)
tasks.whenTaskAdded((tas -> {
    if (tas.name.contains("merge") && tas.name.contains("NativeLibs")) {
        tasks.named(tas.name) {it
            doFirst {
                java.nio.file.Path notNeededDirectory = it.externalLibNativeLibs
                        .getFiles()
                        .stream()
                        .filter(file -> file.toString().contains("jetified-react-android"))
                        .findAny()
                        .orElse(null)
                        .toPath();
                java.nio.file.Files.walk(notNeededDirectory).forEach(file -> {
                    if (file.toString().contains("libc++_shared.so")) {
                        java.nio.file.Files.delete(file);
                    }
                });
            }
        }
    }
}))
```

- [ ] **Step 8: Verify TypeScript and the existing test suite still pass**

```bash
cd SRSRN && npx tsc --noEmit && npm test -- --silent
```

Expected: `tsc` reports no errors (the augmentation is inert until Task 3 imports the component; it references `VLCPlayerProps` from the shipped `.d.ts`, which is in scope inside `declare module`); all existing tests pass (the new mock is inert for files that do not import `react-native-vlc-media-player`).

- [ ] **Step 9: Commit**

```bash
git add SRSRN/package.json SRSRN/package-lock.json SRSRN/jest.setup.js SRSRN/types/react-native-vlc-media-player.d.ts SRSRN/ios/Podfile.lock SRSRN/ios/SRSRN/Info.plist SRSRN/android/app/build.gradle
git commit -F - <<'COMMIT_MSG'
chore(srsrn): add react-native-vlc-media-player 1.0.98, mock, types, native config

Pin react-native-vlc-media-player to 1.0.98 (libVLC; handles SRT transport).
Add a jest mock that records each mounted <VLCPlayer> instance with
__fireOnPlaying/__fireOnError/__fireOnLoad and a stopPlayer jest.fn. Add a
module augmentation (the package's index.d.ts exports only types, not the
VLCPlayer class) so the component imports with types. iOS: add
NSLocalNetworkUsageDescription (MobileVLCKit uses the local network). Android:
add the libc++_shared.so merge workaround (react-android + LibVLC both ship it).

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

If `pod install` was skipped (Step 3), omit `SRSRN/ios/Podfile.lock` from the `git add`. If `pod install` modified `SRSRN/ios/SRSRN.xcodeproj/project.pbxproj`, add it too.

---

### Task 2: SRT routes, validation, and URL-entry screen

**Files:**
- Modify: `SRSRN/navigation/types.ts` (add `SrtUrl` and `SrtPlayer` to `RootStackParamList`)
- Create: `SRSRN/features/srt/validation.ts`
- Create: `SRSRN/features/srt/SrtUrlScreen.tsx`
- Test: `SRSRN/__tests__/srt-validation.test.ts`
- Test: `SRSRN/__tests__/SrtUrlScreen.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_SRT_URL`, `validateSrtUrl`, `ValidationResult`, and the `SrtUrlScreen` component that navigates to `SrtPlayer` with `{srtUrl: string}`.
- Consumes: `RootStackParamList` (extended in Step 1 of this same task so `NativeStackScreenProps<RootStackParamList, 'SrtUrl'>` type-checks).

**Steps:**

- [ ] **Step 1: Add the SRT routes to `navigation/types.ts`**

Replace the entire contents of `SRSRN/navigation/types.ts` with:

```ts
export type RootStackParamList = {
  Home: undefined;
  WhipUrl: undefined;
  Publisher: {whipUrl: string};
  WhepUrl: undefined;
  Player: {whepUrl: string};
  HlsUrl: undefined;
  HlsPlayer: {hlsUrl: string};
  SrtUrl: undefined;
  SrtPlayer: {srtUrl: string};
};
```

- [ ] **Step 2: Write the failing validation test**

Create `SRSRN/__tests__/srt-validation.test.ts`:

```ts
import {DEFAULT_SRT_URL, validateSrtUrl} from '../features/srt/validation';

describe('validateSrtUrl', () => {
  it('rejects empty input', () => {
    expect(validateSrtUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateSrtUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateSrtUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateSrtUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with srt://',
    });
  });
  it('rejects other non-srt schemes', () => {
    expect(validateSrtUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with srt://',
    });
  });
  it('accepts DEFAULT_SRT_URL', () => {
    expect(validateSrtUrl(DEFAULT_SRT_URL)).toEqual({ok: true, url: DEFAULT_SRT_URL});
  });
  it('accepts a valid srt URL with a different host', () => {
    expect(validateSrtUrl('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request')).toEqual({
      ok: true,
      url: 'srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateSrtUrl('  srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request  ')).toEqual({
      ok: true,
      url: 'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request',
    });
  });
  it('DEFAULT_SRT_URL is the SRS SRT play endpoint', () => {
    expect(DEFAULT_SRT_URL).toBe('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request');
  });
  it('does not collide with the HLS default', () => {
    expect(DEFAULT_SRT_URL).not.toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
});
```

- [ ] **Step 3: Run the validation test to verify it fails**

```bash
cd SRSRN && npm test -- srt-validation
```

Expected: FAIL - "Cannot find module '../features/srt/validation'".

- [ ] **Step 4: Implement `features/srt/validation.ts`**

Create `SRSRN/features/srt/validation.ts`:

```ts
export const DEFAULT_SRT_URL =
  'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateSrtUrl(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {ok: false, message: 'Please enter a URL'};
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {ok: false, message: 'Please enter a valid URL'};
  }
  if (parsed.protocol !== 'srt:') {
    return {ok: false, message: 'URL must start with srt://'};
  }
  return {ok: true, url: trimmed};
}
```

Note: `new URL('srt://...')` parses `srt` as a non-special scheme; the `#` inside the streamid is parsed as a URL fragment, which does not affect `parsed.protocol`. The scheme check is what gates acceptance.

- [ ] **Step 5: Run the validation test to verify it passes**

```bash
cd SRSRN && npm test -- srt-validation
```

Expected: PASS (10 tests).

- [ ] **Step 6: Write the failing `SrtUrlScreen` test**

Create `SRSRN/__tests__/SrtUrlScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {SrtUrlScreen} from '../features/srt/SrtUrlScreen';
import {DEFAULT_SRT_URL} from '../features/srt/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'srt-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'SrtUrl-test', name: 'SrtUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<SrtUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('SrtUrlScreen', () => {
  it('prefills the input with DEFAULT_SRT_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'srt-url-input').props.value).toBe(DEFAULT_SRT_URL);
  });
  it('navigates to SrtPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('SrtPlayer', {srtUrl: DEFAULT_SRT_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for http URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-input').props.onChangeText('http://example.com/stream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'srt-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request');
    });
    expect(input.props.value).toBe('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request');
  });
});
```

- [ ] **Step 7: Run the screen test to verify it fails**

```bash
cd SRSRN && npm test -- SrtUrlScreen
```

Expected: FAIL - "Cannot find module '../features/srt/SrtUrlScreen'".

- [ ] **Step 8: Implement `features/srt/SrtUrlScreen.tsx`**

Create `SRSRN/features/srt/SrtUrlScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_SRT_URL, validateSrtUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'SrtUrl'>;

export function SrtUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_SRT_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateSrtUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('SrtPlayer', {srtUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SRT server URL</Text>
      <TextInput
        testID="srt-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="srt-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="srt-url-connect" title="Connect" onPress={onConnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  label: {fontSize: 14, fontWeight: '600'},
  input: {borderWidth: 1, borderColor: '#888', borderRadius: 4, padding: 8, fontSize: 14},
  error: {color: '#c00', fontSize: 13},
});
```

- [ ] **Step 9: Run the screen test to verify it passes**

```bash
cd SRSRN && npm test -- SrtUrlScreen
```

Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add SRSRN/navigation/types.ts SRSRN/features/srt/validation.ts SRSRN/features/srt/SrtUrlScreen.tsx SRSRN/__tests__/srt-validation.test.ts SRSRN/__tests__/SrtUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add SRT URL entry screen with preserved default URL

Add the SrtUrl and SrtPlayer routes, validateSrtUrl (syntactic srt://
validation), DEFAULT_SRT_URL pointing at the SRS SRT play endpoint
(srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request), and
SrtUrlScreen which navigates to SrtPlayer with the typed {srtUrl} parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: SRT session hook and player screen

**Files:**
- Create: `SRSRN/features/srt/types.ts`
- Create: `SRSRN/features/srt/useSrtSession.ts`
- Create: `SRSRN/features/srt/SrtPlayerScreen.tsx`
- Test: `SRSRN/__tests__/SrtPlayerScreen.test.tsx`

**Interfaces:**
- Produces: `SrtSessionStatus`, `SrtErrorEvent`, `UseSrtSessionResult` types; `useSrtSession()` hook returning `{status, errorMessage, playerRef, onPlaying, onError, start, stop}`; and the `SrtPlayerScreen` component.
- Consumes: `RootStackParamList` `SrtPlayer` route (Task 2), the `react-native-vlc-media-player` mock + type augmentation (Task 1).

**Steps:**

- [ ] **Step 1: Write the failing player-screen test**

Create `SRSRN/__tests__/SrtPlayerScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {SrtPlayerScreen} from '../features/srt/SrtPlayerScreen';
import {DEFAULT_SRT_URL} from '../features/srt/validation';

const vlc = require('react-native-vlc-media-player');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'srt-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'srt-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'SrtPlayer-test',
    name: 'SrtPlayer' as const,
    params: {srtUrl: DEFAULT_SRT_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<SrtPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

// pressStart is async only to flush the batched status/handlers state updates
// through act. After `await pressStart(tree)` status is 'starting', the Start
// button is replaced by Stop, <VLCPlayer> is mounted, and the instance is at
// vlc.__mockVlcInstances[0].
async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'srt-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'srt-player-stop').props.onPress();
  });
}

describe('SrtPlayerScreen - no work before Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('renders no VLCPlayer and creates no player instance before Start', () => {
    const tree = render();
    expect(vlc.__mockVlcInstances.length).toBe(0);
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('SrtPlayerScreen - happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('Start mounts the VLCPlayer and onPlaying marks the session active with no error', async () => {
    const tree = render();
    await pressStart(tree);
    expect(hasVideo(tree.root)).toBe(true);
    expect(vlc.__mockVlcInstances.length).toBe(1);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasVideo(tree.root)).toBe(true);
  });
});

describe('SrtPlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('creates only one VLCPlayer when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'srt-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(vlc.__mockVlcInstances.length).toBe(1);
  });
});

describe('SrtPlayerScreen - cancellation during each stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('Stop during loading calls stopPlayer, unmounts the VLCPlayer, and leaves no session', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = vlc.__mockVlcInstances[0];
    pressStop(tree);
    // True imperative mirror: cleanupAttempt calls stopPlayer() on the ref.
    expect(instanceA.stopPlayer).toHaveBeenCalledTimes(1);
    expect(hasVideo(tree.root)).toBe(false);
    // A late onPlaying after Stop must be ignored (no error promoted).
    ReactTestRenderer.act(() => {
      instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'srt-player-start'}).length).toBeGreaterThan(0);
  });

  it('unmount tears down any active session without throwing on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = vlc.__mockVlcInstances[0];
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(() => {
      ReactTestRenderer.act(() => instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true}));
    }).not.toThrow();
  });
});

describe('SrtPlayerScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('a stale attempt late-arriving onPlaying/onError does not update the UI or disturb the newer attempt', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    const instanceA = vlc.__mockVlcInstances[0];
    pressStop(tree); // Stop A -> VLCPlayer A unmounts
    await pressStart(tree); // attempt B
    const instanceB = vlc.__mockVlcInstances[1];
    // Stale A's late events must be dropped by the isCurrent(attempt) guard.
    ReactTestRenderer.act(() => {
      instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    ReactTestRenderer.act(() => {
      instanceA.__fireOnError({target: 0});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasVideo(tree.root)).toBe(true);
    // B is still the current attempt and responds to its own onPlaying.
    ReactTestRenderer.act(() => {
      instanceB.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasVideo(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});

describe('SrtPlayerScreen - visible errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('an onError event shows a generic user-visible error and unmounts the VLCPlayer', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      // libVLC's onError payload is {target} with no message field.
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    expect(findByTestID(tree.root, 'srt-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('SrtPlayerScreen - idempotent cleanup and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('Stop then unmount is idempotent: no double-cleanup, no throw on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instance = vlc.__mockVlcInstances[0];
    pressStop(tree); // stopPlayer() + attemptRef=null + status='idle'
    expect(instance.stopPlayer).toHaveBeenCalledTimes(1);
    // Unmount right after Stop: the useEffect teardown finds attemptRef null
    // and skips cleanupAttempt. Must not throw or double-clean.
    expect(() => {
      ReactTestRenderer.act(() => tree.unmount());
    }).not.toThrow();
    // Late events on the stopped/unmounted instance must not throw.
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnPlaying({duration: 0, target: 0, seekable: true}));
    }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnError({target: 0}));
    }).not.toThrow();
  });

  it('a failed start leaves the screen ready for a fresh Start', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    // Failure -> status='error', Start button back, error shown, VLCPlayer unmounted.
    expect(findByTestID(tree.root, 'srt-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'srt-player-start'}).length).toBeGreaterThan(0);
    // Fresh Start: onError nulled attemptRef, so start() creates a new attempt.
    await pressStart(tree); // attempt B
    expect(hasVideo(tree.root)).toBe(true);
    expect(vlc.__mockVlcInstances.length).toBe(2);
    // The previous error is cleared on the fresh Start.
    expect(hasError(tree.root)).toBe(false);
    // B plays successfully.
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[1].__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasVideo(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd SRSRN && npm test -- SrtPlayerScreen
```

Expected: FAIL - "Cannot find module '../features/srt/SrtPlayerScreen'" (and `useSrtSession`).

- [ ] **Step 3: Implement `features/srt/types.ts`**

Create `SRSRN/features/srt/types.ts`:

```ts
import type {RefObject} from 'react';
import type VLCPlayer from 'react-native-vlc-media-player';

export type SrtSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type SrtErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseSrtSessionResult = {
  status: SrtSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: SrtErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
```

`import type VLCPlayer from 'react-native-vlc-media-player'` resolves (via the Task 1 augmentation) to the `VlcPlayer` instance type, whose instances expose `stopPlayer()`.

- [ ] **Step 4: Implement `features/srt/useSrtSession.ts`**

Create `SRSRN/features/srt/useSrtSession.ts`:

```ts
import React from 'react';
import type VLCPlayer from 'react-native-vlc-media-player';
import type {SrtErrorEvent, SrtSessionStatus, UseSrtSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onPlaying: () => void;
  onError: (event: SrtErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: SrtErrorEvent) => {};

// Mirrors useWhepSession/useHlsSession (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) but
// adapted to a component-mounted react-native-vlc-media-player player. Because
// VLCPlayer exposes an imperative stopPlayer() ref method, cleanupAttempt
// performs a TRUE imperative stop - the closest WHEP mirror of the four
// features. There is no PeerConnection, MediaStream, fetch, or AbortController;
// libVLC pulls the SRT stream internally, and late onPlaying/onError from an
// obsolete attempt are dropped by the isCurrent(attempt) guard captured in the
// per-attempt closures stored in `handlers` state.
export function useSrtSession(): UseSrtSessionResult {
  const [status, setStatus] = React.useState<SrtSessionStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const playerRef = React.useRef<VLCPlayer>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // True imperative stop: VLCPlayer exposes stopPlayer() (unlike
    // react-native-video v6). The subsequent status -> 'idle' transition in
    // stop()/onError() also unmounts <VLCPlayer>, releasing the native player;
    // this closed flag plus isCurrent() drops any late onPlaying/onError.
    playerRef.current?.stopPlayer();
  }, []);

  const stop = React.useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt) {
      cleanupAttempt(attempt);
    }
    attemptRef.current = null;
    setHandlers(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupAttempt]);

  const start = React.useCallback(() => {
    if (attemptRef.current !== null) {
      return; // duplicate/concurrent Start guard
    }
    setErrorMessage(null);
    setStatus('starting');

    counterRef.current += 1;
    const attempt: Attempt = {
      id: counterRef.current,
      closed: false,
    };
    attemptRef.current = attempt;

    // Per-attempt closures capture `attempt` so a stale attempt's late
    // onPlaying/onError short-circuits via isCurrent(attempt).
    const attemptHandlers: Handlers = {
      onPlaying: () => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onError: (_event: SrtErrorEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        // libVLC's onError carries only {target} with no message field, so a
        // generic message is the best user-visible text available.
        setErrorMessage('Playback error');
        setStatus('error');
      },
    };
    setHandlers(attemptHandlers);
  }, [isCurrent, cleanupAttempt]);

  React.useEffect(() => {
    return () => {
      const attempt = attemptRef.current;
      if (attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
      }
    };
  }, [cleanupAttempt]);

  return {
    status,
    errorMessage,
    playerRef,
    onPlaying: handlers?.onPlaying ?? noop,
    onError: handlers?.onError ?? noopError,
    start,
    stop,
  };
}
```

- [ ] **Step 5: Implement `features/srt/SrtPlayerScreen.tsx`**

Create `SRSRN/features/srt/SrtPlayerScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import VLCPlayer from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useSrtSession} from './useSrtSession';

type Props = NativeStackScreenProps<RootStackParamList, 'SrtPlayer'>;

export function SrtPlayerScreen({route}: Props): React.JSX.Element {
  const {srtUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useSrtSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="srt-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="srt-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="srt-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="srt-video"
            ref={playerRef}
            source={{uri: srtUrl}}
            autoplay
            paused={false}
            resizeMode="contain"
            onPlaying={onPlaying}
            onError={onError}
            style={styles.video}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  videoContainer: {width: 300, height: 400, borderWidth: 1},
  video: {width: '100%', height: '100%'},
  error: {color: '#c00', fontSize: 13},
});
```

- [ ] **Step 6: Run the player-screen test to verify it passes**

```bash
cd SRSRN && npm test -- SrtPlayerScreen
```

Expected: PASS (9 tests). The "Stop during loading" test asserts `instanceA.stopPlayer` was called exactly once - this is the true imperative mirror. If it fails because `stopPlayer` was called twice, the unmount path is double-cleaning; ensure `cleanupAttempt`'s `closed` flag guards re-entry and `stop()` nulls `attemptRef` before any second call.

- [ ] **Step 7: Verify TypeScript, ESLint, and the full suite**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```

Expected: tsc clean; lint 0 problems; all tests pass (existing + new SRT suites). If `tsc` reports `import VLCPlayer from 'react-native-vlc-media-player'` or the `<VLCPlayer>` JSX as an error, confirm the Task 1 augmentation file `SRSRN/types/react-native-vlc-media-player.d.ts` exists and is within the tsconfig `include` glob (it is - `**/*.ts` matches `*.d.ts`).

- [ ] **Step 8: Commit**

```bash
git add SRSRN/features/srt/types.ts SRSRN/features/srt/useSrtSession.ts SRSRN/features/srt/SrtPlayerScreen.tsx SRSRN/__tests__/SrtPlayerScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add SRT player with generation-guarded session and explicit Start

useSrtSession mirrors useWhepSession/useHlsSession (explicit Start, attemptRef
+ isCurrent guard, idempotent cleanupAttempt via a closed flag, unmount
teardown) adapted to a react-native-vlc-media-player <VLCPlayer> component.
Because VLCPlayer exposes stopPlayer(), cleanupAttempt performs a true
imperative stop - the closest WHEP mirror yet. The attempt is {id, closed}
with per-attempt onPlaying/onError closures; libVLC pulls the SRT stream
(no AbortController), and late events are dropped by isCurrent. onPlaying ->
'active'; onError -> 'error' with a generic 'Playback error' (libVLC's
onError has no message field). SrtPlayerScreen renders <VLCPlayer
source={{uri: srtUrl}}> bound to the hook's playerRef and callbacks.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 4: Launcher entry, navigator wiring, and Home screen test update

**Files:**
- Modify: `SRSRN/launcher/features.ts` (add `srt` entry; add `'SrtUrl'` to `LauncherDestination`)
- Modify: `SRSRN/navigation/RootNavigator.tsx` (import + 2 `Stack.Screen`)
- Modify: `SRSRN/__tests__/HomeScreen.test.tsx` (assert real `srt` card; add navigation test; rename synthetic extra `srt` -> `dash`)

**Interfaces:**
- Produces: a `LAUNCHER_FEATURES` array containing the `srt` entry whose `destination: 'SrtUrl'`; `LauncherDestination` includes `'SrtUrl'`; `RootNavigator` registers `SrtUrl` and `SrtPlayer` screens.
- Consumes: `SrtUrlScreen` and `SrtPlayerScreen` (Task 3), `RootStackParamList` routes (Task 2).

**Steps:**

- [ ] **Step 1: Update `launcher/features.ts`**

Replace the entire contents of `SRSRN/launcher/features.ts` with:

```ts
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
```

- [ ] **Step 2: Update `navigation/RootNavigator.tsx`**

Replace the entire contents of `SRSRN/navigation/RootNavigator.tsx` with:

```tsx
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {HomeScreen} from '../screens/HomeScreen';
import {WhipUrlScreen} from '../features/whip/WhipUrlScreen';
import {PublisherScreen} from '../features/whip/PublisherScreen';
import {WhepUrlScreen} from '../features/whep/WhepUrlScreen';
import {PlayerScreen} from '../features/whep/PlayerScreen';
import {HlsUrlScreen} from '../features/hls/HlsUrlScreen';
import {HlsPlayerScreen} from '../features/hls/HlsPlayerScreen';
import {SrtUrlScreen} from '../features/srt/SrtUrlScreen';
import {SrtPlayerScreen} from '../features/srt/SrtPlayerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{title: 'SRS RN'}} />
        <Stack.Screen name="WhipUrl" component={WhipUrlScreen} options={{title: 'WHIP URL'}} />
        <Stack.Screen name="Publisher" component={PublisherScreen} options={{title: 'Publisher'}} />
        <Stack.Screen name="WhepUrl" component={WhepUrlScreen} options={{title: 'WHEP URL'}} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{title: 'Player'}} />
        <Stack.Screen name="HlsUrl" component={HlsUrlScreen} options={{title: 'HLS URL'}} />
        <Stack.Screen name="HlsPlayer" component={HlsPlayerScreen} options={{title: 'HLS Player'}} />
        <Stack.Screen name="SrtUrl" component={SrtUrlScreen} options={{title: 'SRT URL'}} />
        <Stack.Screen name="SrtPlayer" component={SrtPlayerScreen} options={{title: 'SRT Player'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Update `__tests__/HomeScreen.test.tsx`**

Three edits to the existing file:

Edit A - in the "renders a card for each launcher feature from the default config" test, add an SRT assertion. The test body becomes:

```ts
  it('renders a card for each launcher feature from the default config', () => {
    const {tree} = render();
    expect(tree.root.findAllByProps({testID: 'launcher-whip-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-whep-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-hls-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-srt-action'}).length).toBeGreaterThan(0);
  });
```

Edit B - add a new test after the HLS navigation test:

```ts
  it('navigates to SrtUrl when the SRT card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-srt-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('SrtUrl');
  });
```

Edit C - in the "renders an additional launcher entry without layout changes" test, rename the synthetic extra entry from `srt` to `dash` (the real `srt` entry now exists in `LAUNCHER_FEATURES`, so a synthetic `srt` would collide on the `keyExtractor={item => item.id}` key). The test body becomes:

```ts
  it('renders an additional launcher entry without layout changes', () => {
    const extra: LauncherFeature = {
      id: 'dash',
      title: 'DASH Play',
      description: 'Future entry.',
      actionLabel: 'Open DASH',
      color: '#999',
      destination: 'WhipUrl',
    };
    const {tree} = render([...LAUNCHER_FEATURES, extra]);
    // Use an existence check, not an exact count: React 19's test renderer
    // represents forwardRef host components like View twice, doubling any
    // findAllByProps count on a View testID.
    expect(tree.root.findAllByProps({testID: 'launcher-dash-action'}).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the Home screen and App tests to verify they pass**

```bash
cd SRSRN && npm test -- HomeScreen App
```

Expected: PASS. The Home screen test asserts the real `srt` card renders and navigates to `SrtUrl`; the App test renders `<App />` (which now imports the SRT screens and `react-native-vlc-media-player`'s mock) without crashing.

- [ ] **Step 5: Verify TypeScript and ESLint**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add SRSRN/launcher/features.ts SRSRN/navigation/RootNavigator.tsx SRSRN/__tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire SRT launcher entry and routes into the navigator

Add the SRT Play card to LAUNCHER_FEATURES (destination SrtUrl), register the
SrtUrl and SrtPlayer Stack.Screen entries, and extend the Home screen tests to
assert the real SRT card renders and navigates. Rename the synthetic
"additional entry" test's id from srt to dash so it no longer collides with
the real srt entry. HomeScreen layout logic is unchanged.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 5: Final verification

**Files:** none (verification only).

**Steps:**

- [ ] **Step 1: Full automated suite**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```

Expected: TypeScript clean, ESLint clean, all Jest suites green (existing WHIP/WHEP/HLS/Home/App suites plus the new `srt-validation`, `SrtUrlScreen`, and `SrtPlayerScreen` suites).

- [ ] **Step 2: Install/refresh iOS pods (retry if Task 1 Step 3 was skipped)**

```bash
cd SRSRN && pod install --project-directory=ios
```

Expected: `Podfile.lock` lists `MobileVLCKit`; "Pod installation complete". If the environment cannot reach the CocoaPods CDN, record the failure explicitly - do not claim the iOS build was verified.

- [ ] **Step 3: Build the iOS workspace**

```bash
cd SRSRN && xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphoneos -configuration Debug build
```

Expected: BUILD SUCCEEDED. If signing fails (no team - the SRSRN pbxproj is at template defaults by user choice), fall back to `-sdk iphonesimulator` and record which SDK was used. If `xcodebuild` is unavailable, record that.

- [ ] **Step 4: Android Gradle configuration check**

```bash
cd SRSRN && cd android && ./gradlew :app:tasks
```

Expected: Gradle configuration resolves and lists tasks without error. The `libc++_shared.so` workaround from Task 1 Step 7 is exercised at native-libs merge time; if the merge fails, confirm the `jetified-react-android` filter string matches the actual artifact name in this RN 0.86 build and adjust if necessary. No emulator or device runtime verification is required.

- [ ] **Step 5: Report iOS functional checks and the SRT-support gate**

The following iOS functional checks require a physical device and a reachable SRS SRT endpoint (`srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request`). Do not claim any was verified unless it was actually observed:

1. Launch into Home and confirm the SRT card is present.
2. Open SRT, retain or edit the URL, press Start, receive SRT playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, a rejected SRT handshake, and a decode error each produce an understandable, recoverable message (generic "Playback error").

**🔴 Gating check:** the `react-native-vlc-media-player` README lists supported formats as RTSP/RTP/RTMP/HLS/MMS and does **not** name SRT. An actual `srt://` stream **must** be played on a device to confirm libVLC's SRT access module is present in the prebuilt `MobileVLCKit`/`libvlc-all` artifacts. If SRT playback does not work, this approach fails and the project reconsiders (a custom native libsrt module, or a different protocol). Do not claim SRT playback was verified unless an `srt://` stream was actually observed playing.

If no device or endpoint is available, explicitly state which checks remain manual and stop at Step 4.

- [ ] **Step 6: Final commit (only if Step 2 regenerated lockfiles/pbxproj)**

```bash
git add SRSRN/ios/Podfile.lock SRSRN/ios/SRSRN.xcodeproj/project.pbxproj 2>/dev/null
git diff --cached --quiet || git commit -F - <<'COMMIT_MSG'
chore(srsrn): refresh pods after react-native-vlc-media-player install

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

If `git diff --cached --quiet` exits 0 (nothing staged), skip the commit.

---

## Self-Review

Performed against the approved spec (`docs/superpowers/specs/2026-08-05-srs-rn-srt-design.md`) and the installed `@types/react@19.2.17` + the package's shipped `index.d.ts`.

**1. Spec coverage** - each spec section maps to a task:

| Spec section | Implemented in |
| --- | --- |
| Objective / scope (SRT play via VLC, third media stack) | Global Constraints, Tasks 1-5 |
| Architecture (feature tree) | File Structure, Tasks 2-4 |
| Media Stack (react-native-vlc-media-player, libVLC, type augmentation, SRT-support risk) | Task 1 (dep + mock + augmentation), Global Constraints, Task 5 (gate) |
| Launcher (srt entry, no layout change, `SrtUrl` destination) | Task 4 |
| Navigation (`SrtUrl`/`SrtPlayer` routes, typed param, unmount teardown) | Task 2 (routes), Task 3 (screen), Task 4 (navigator) |
| SRT Playback Flow (Start, `<VLCPlayer>`, onPlaying/onError, Stop/unmount) | Task 3 |
| Session Lifecycle (explicit Start, attempt, isCurrent, closed, stopPlayer, no abort, idempotent, stale isolation, unmount teardown) | Task 3 (`useSrtSession`) |
| Attempt shape & imperative cleanup (`{id, closed}`, `playerRef`, `stopPlayer()`) | Task 3 (types + hook) |
| Error Handling (URL rejection, generic "Playback error", recoverable) | Task 2 (validation), Task 3 (onError), Task 5 (functional) |
| Native Config (dep, MobileVLCKit pod, `NSLocalNetworkUsageDescription`, Android `libc++_shared.so` workaround, no capture perms) | Task 1, Task 5, Global Constraints |
| URL Entry & Validation (`DEFAULT_SRT_URL`, `validateSrtUrl`, `srt:` scheme) | Task 2 |
| Testing (Home, URL entry, validation, player, navigation, idempotent, recovery) | Tasks 2-4 tests, Task 5 |
| Verification (install, tsc, lint, jest, pod, iOS build, Android gradle, SRT-support gate, functional) | Task 5 |
| Acceptance criteria | covered across all tasks |

No spec gaps.

**2. Placeholder scan** - no `TBD`/`TODO`/`implement later`/`add appropriate`/`similar to Task N`. Every code step has concrete code; every command step has a concrete command with expected output. Conditional notes ("If `pod install` was skipped...", "If `xcodebuild` is unavailable...", "If the merge fails, confirm the `jetified-react-android` filter...") name concrete fallbacks, not deferrals.

**3. Type consistency** - verified end to end:
- `DEFAULT_SRT_URL`, `validateSrtUrl`, `ValidationResult` defined in Task 2 and consumed by `SrtUrlScreen` (Task 2) and `SrtPlayerScreen.test.tsx` (Task 3).
- `SrtSessionStatus`, `SrtErrorEvent`, `UseSrtSessionResult` defined in `features/srt/types.ts` (Task 3 Step 3) and consumed by `useSrtSession` (Task 3 Step 4).
- `useSrtSession()` takes no argument; `SrtPlayerScreen` calls `useSrtSession()` with no argument.
- `playerRef: RefObject<VLCPlayer | null>` (Task 3 types.ts) matches `React.useRef<VLCPlayer>(null)` (Task 3 hook). `VLCPlayer` is the `VlcPlayer` instance type from the Task 1 augmentation's default export; `import type VLCPlayer from 'react-native-vlc-media-player'` resolves to it. `<VLCPlayer ref={playerRef}>` type-checks because the augmentation's `VlcPlayer` class `implements VLCPlayerInstance`, so the ref's instance type includes `stopPlayer()`.
- `SrtErrorEvent = {target?: number; [key: string]: unknown}` is a supertype of libVLC's `onError` payload `{target: number}`, so `onError={onError}` type-checks via parameter contravariance.
- Test IDs consistent: `srt-url-*` (Task 2), `srt-player-*` / `srt-video` (Task 3), `launcher-srt-action` (Task 4); the synthetic extra entry uses `launcher-dash-action` (Task 4, non-colliding).
- The jest mock's `__mockVlcInstances[i].stopPlayer` (jest.fn()) is what the "Stop during loading" test asserts was called; the hook calls `playerRef.current?.stopPlayer()`, and the mock's `useImperativeHandle` exposes the same instance (with `stopPlayer`) as the ref.

No type drift found.

**4. Ambiguity check** - `cleanupAttempt`'s imperative `stopPlayer()` is explicit (Global Constraints + Task 3 comments). `useSrtSession()` no-arg is explicit. The generic "Playback error" is explicit (Global Constraints + Task 3). The `srt:` scheme check is explicit. The SRT-support device gate is explicit in Task 5. The `VlcPlayer` (not `VLCPlayer`) class name in the augmentation is explained (avoids colliding with the package's module-private `declare class VLCPlayer`).

---
