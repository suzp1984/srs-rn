# SRS RN DASH Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MPEG-DASH playback as a fifth protocol feature on the SRS RN launcher, played via libVLC (`react-native-vlc-media-player`), reusing the SRT feature's media stack. DASH was non-viable via `react-native-video` (AVPlayer does not play DASH on iOS); libVLC's DASH support is a core demuxer, independent of AVPlayer.

**Architecture:** A new `features/dash/` directory owns its URL-entry screen, player screen, validation, types, and a `useDashSession` hook that mirrors `useSrtSession`'s generation-guarded lifecycle (VLC `playerRef`, imperative `stopPlayer()` cleanup, `onPlaying`/`onError` per-attempt closures). The player is a component-mounted `<VLCPlayer>`; there is no PeerConnection, SDP, fetch, or AbortController. Validation mirrors `validateHlsUrl` (http/https), not `validateSrtUrl` (DASH is HTTP-delivered).

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-vlc-media-player 1.0.98 (already installed, reused), react-native-video 6.19.2 + react-native-webrtc 124.0.7 (unchanged), React Navigation 7, Jest 29 + react-test-renderer 19.

## Global Constraints

- App root is `SRSRN/` (an independent app). Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- React Native `0.86.0`, React `19.2.3`, TypeScript `^5.8.3`, `react-native-webrtc` `124.0.7`, `react-native-video` `6.19.2`, `react-native-vlc-media-player` `1.0.98` (all unchanged; the VLC dependency, jest mock, type augmentation, `MobileVLCKit` pod, Android `libc++_shared.so` workaround, and `NSLocalNetworkUsageDescription` were all added by the SRT feature and are reused as-is).
- Do NOT modify `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `WHIPPublisher/`, or `WHEPPlayer/`. The only exception is `SRSRN/__tests__/HomeScreen.test.tsx` (Task 3): rename the synthetic extra launcher entry from `id: 'dash'` to `id: 'rtmp'` (it currently uses `dash`, which the real DASH entry this feature adds would collide with on the `keyExtractor={item => item.id}` key).
- Use the **named** `VLCPlayer` import: `import {VLCPlayer} from 'react-native-vlc-media-player'` (runtime) and `import type {VLCPlayer} from 'react-native-vlc-media-player'` (type). The package's `index.js` is CommonJS `module.exports = {VLCPlayer, VlCPlayerView}` with NO default export; a default import yields the namespace object and `<VLCPlayer>` fails at runtime with "Element type is invalid". The SRT feature's type augmentation (`types/react-native-vlc-media-player.d.ts`) exports `{VlcPlayer as VLCPlayer}` to match.
- Default DASH URL (verbatim): `http://192.168.1.100:8080/live/livestream.mpd` (SRS DASH endpoint; same host/port/app/stream as the HLS default, `.mpd` instead of `.m3u8`).
- No new capture permissions, pods, or Gradle config (play-only; DASH is HTTP over the existing `NSAllowsLocalNetworking`; VLC's `libc++_shared.so` workaround is already in place).
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks on host-component testIDs (React 19 doubles `View`/forwardRef host counts; never assert exact counts).
- Commits land on `feature/srs-rn-unified-app`. Conventional Commits (`feat(srsrn):`, `test(srsrn):`, `chore(srsrn):`). End every commit message with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`. Use `git commit -F - <<'COMMIT_MSG' ... COMMIT_MSG` (heredoc) - never `-m "$(cat <<...)"` nesting.
- `cleanupAttempt` calls `playerRef.current?.stopPlayer()` (true imperative mirror) plus sets `attempt.closed = true`. No `AbortController` (libVLC pulls the manifest/segments; late `onPlaying`/`onError` are dropped by the `isCurrent(attempt)` guard).
- `useDashSession()` takes no argument (the URL is passed to `<VLCPlayer source={{uri: dashUrl}}>` by the screen).
- libVLC's `onError` payload is `{target: number}` with no message field, so user-visible DASH errors are the generic `'Playback error'`. Do not fabricate a more specific message.

---

## File Structure

```text
SRSRN/
├── navigation/types.ts                       # +DashUrl, +DashPlayer (Task 1)
├── navigation/RootNavigator.tsx              # +2 Stack.Screen (Task 3)
├── launcher/features.ts                      # +dash entry, +DashUrl in union (Task 3)
├── features/dash/                            # new feature directory (Tasks 1-2)
│   ├── validation.ts                         # Task 1
│   ├── DashUrlScreen.tsx                     # Task 1
│   ├── types.ts                              # Task 2
│   ├── useDashSession.ts                     # Task 2
│   └── DashPlayerScreen.tsx                  # Task 2
└── __tests__/
    ├── dash-validation.test.ts               # Task 1
    ├── DashUrlScreen.test.tsx                # Task 1
    ├── DashPlayerScreen.test.tsx             # Task 2
    └── HomeScreen.test.tsx                   # rename synthetic extra dash->rtmp (Task 3)
```

No changes to `package.json`, `package-lock.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/Podfile.lock`, `ios/SRSRN/Info.plist`, or `android/app/build.gradle` - the VLC infrastructure from SRT is reused unchanged.

Each file has one responsibility; the feature owns its screens, validation, types, lifecycle hook, and tests, mirroring `features/srt/` (media stack) and `features/hls/` (URL scheme).

---

### Task 1: DASH routes, validation, and URL-entry screen

**Files:**
- Modify: `SRSRN/navigation/types.ts` (add `DashUrl` and `DashPlayer` to `RootStackParamList`)
- Create: `SRSRN/features/dash/validation.ts`
- Create: `SRSRN/features/dash/DashUrlScreen.tsx`
- Test: `SRSRN/__tests__/dash-validation.test.ts`
- Test: `SRSRN/__tests__/DashUrlScreen.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_DASH_URL`, `validateDashUrl`, `ValidationResult`, and the `DashUrlScreen` component that navigates to `DashPlayer` with `{dashUrl: string}`.
- Consumes: `RootStackParamList` (extended in Step 1 of this same task so `NativeStackScreenProps<RootStackParamList, 'DashUrl'>` type-checks).

**Steps:**

- [ ] **Step 1: Add the DASH routes to `navigation/types.ts`**

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
  DashUrl: undefined;
  DashPlayer: {dashUrl: string};
};
```

- [ ] **Step 2: Write the failing validation test**

Create `SRSRN/__tests__/dash-validation.test.ts`:

```ts
import {DEFAULT_DASH_URL, validateDashUrl} from '../features/dash/validation';

describe('validateDashUrl', () => {
  it('rejects empty input', () => {
    expect(validateDashUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateDashUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateDashUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateDashUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateDashUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_DASH_URL', () => {
    expect(validateDashUrl(DEFAULT_DASH_URL)).toEqual({ok: true, url: DEFAULT_DASH_URL});
  });
  it('accepts a valid https DASH URL', () => {
    expect(validateDashUrl('https://example.com/live/stream.mpd')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.mpd',
    });
  });
  it('accepts a valid DASH URL without a .mpd suffix', () => {
    expect(validateDashUrl('http://example.com/live/stream')).toEqual({
      ok: true,
      url: 'http://example.com/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateDashUrl('  https://example.com/live/stream.mpd  ')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.mpd',
    });
  });
  it('DEFAULT_DASH_URL is the SRS DASH endpoint', () => {
    expect(DEFAULT_DASH_URL).toBe('http://192.168.1.100:8080/live/livestream.mpd');
  });
  it('does not collide with the HLS default', () => {
    expect(DEFAULT_DASH_URL).not.toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
});
```

- [ ] **Step 3: Run the validation test to verify it fails**

```bash
cd SRSRN && npm test -- dash-validation
```

Expected: FAIL - "Cannot find module '../features/dash/validation'".

- [ ] **Step 4: Implement `features/dash/validation.ts`**

Create `SRSRN/features/dash/validation.ts`:

```ts
export const DEFAULT_DASH_URL =
  'http://192.168.1.100:8080/live/livestream.mpd';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateDashUrl(input: string): ValidationResult {
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
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {ok: false, message: 'URL must start with http:// or https://'};
  }
  return {ok: true, url: trimmed};
}
```

- [ ] **Step 5: Run the validation test to verify it passes**

```bash
cd SRSRN && npm test -- dash-validation
```

Expected: PASS (11 tests).

- [ ] **Step 6: Write the failing `DashUrlScreen` test**

Create `SRSRN/__tests__/DashUrlScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {DashUrlScreen} from '../features/dash/DashUrlScreen';
import {DEFAULT_DASH_URL} from '../features/dash/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'dash-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'DashUrl-test', name: 'DashUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<DashUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('DashUrlScreen', () => {
  it('prefills the input with DEFAULT_DASH_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'dash-url-input').props.value).toBe(DEFAULT_DASH_URL);
  });
  it('navigates to DashPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('DashPlayer', {dashUrl: DEFAULT_DASH_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for srt URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-input').props.onChangeText(
        'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request',
      );
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'dash-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/live/stream.mpd');
    });
    expect(input.props.value).toBe('https://example.com/live/stream.mpd');
  });
});
```

- [ ] **Step 7: Run the screen test to verify it fails**

```bash
cd SRSRN && npm test -- DashUrlScreen
```

Expected: FAIL - "Cannot find module '../features/dash/DashUrlScreen'".

- [ ] **Step 8: Implement `features/dash/DashUrlScreen.tsx`**

Create `SRSRN/features/dash/DashUrlScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_DASH_URL, validateDashUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'DashUrl'>;

export function DashUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_DASH_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateDashUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('DashPlayer', {dashUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>DASH server URL</Text>
      <TextInput
        testID="dash-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="dash-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="dash-url-connect" title="Connect" onPress={onConnect} />
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
cd SRSRN && npm test -- DashUrlScreen
```

Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add SRSRN/navigation/types.ts SRSRN/features/dash/validation.ts SRSRN/features/dash/DashUrlScreen.tsx SRSRN/__tests__/dash-validation.test.ts SRSRN/__tests__/DashUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add DASH URL entry screen with preserved default URL

Add the DashUrl and DashPlayer routes, validateDashUrl (syntactic
http/https validation, mirroring HLS), DEFAULT_DASH_URL pointing at the SRS
DASH endpoint (http://192.168.1.100:8080/live/livestream.mpd), and
DashUrlScreen which navigates to DashPlayer with the typed {dashUrl}
parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 2: DASH session hook and player screen

**Files:**
- Create: `SRSRN/features/dash/types.ts`
- Create: `SRSRN/features/dash/useDashSession.ts`
- Create: `SRSRN/features/dash/DashPlayerScreen.tsx`
- Test: `SRSRN/__tests__/DashPlayerScreen.test.tsx`

**Interfaces:**
- Produces: `DashSessionStatus`, `DashErrorEvent`, `UseDashSessionResult` types; `useDashSession()` hook returning `{status, errorMessage, playerRef, onPlaying, onError, start, stop}`; and the `DashPlayerScreen` component.
- Consumes: `RootStackParamList` `DashPlayer` route (Task 1), the `react-native-vlc-media-player` mock + type augmentation from the SRT feature.

**Steps:**

- [ ] **Step 1: Write the failing player-screen test**

Create `SRSRN/__tests__/DashPlayerScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {DashPlayerScreen} from '../features/dash/DashPlayerScreen';
import {DEFAULT_DASH_URL} from '../features/dash/validation';

const vlc = require('react-native-vlc-media-player');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'dash-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'dash-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'DashPlayer-test',
    name: 'DashPlayer' as const,
    params: {dashUrl: DEFAULT_DASH_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<DashPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

// pressStart is async only to flush the batched status/handlers state updates
// through act. After `await pressStart(tree)` status is 'starting', the Start
// button is replaced by Stop, <VLCPlayer> is mounted, and the instance is at
// vlc.__mockVlcInstances[0].
async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'dash-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'dash-player-stop').props.onPress();
  });
}

describe('DashPlayerScreen - no work before Start', () => {
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

describe('DashPlayerScreen - happy path', () => {
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

describe('DashPlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('creates only one VLCPlayer when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'dash-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(vlc.__mockVlcInstances.length).toBe(1);
  });
});

describe('DashPlayerScreen - cancellation during each stage', () => {
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
    expect(tree.root.findAllByProps({testID: 'dash-player-start'}).length).toBeGreaterThan(0);
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

describe('DashPlayerScreen - obsolete attempt isolation', () => {
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

describe('DashPlayerScreen - visible errors', () => {
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
    expect(findByTestID(tree.root, 'dash-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('DashPlayerScreen - idempotent cleanup and recovery', () => {
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
    expect(findByTestID(tree.root, 'dash-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'dash-player-start'}).length).toBeGreaterThan(0);
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
cd SRSRN && npm test -- DashPlayerScreen
```

Expected: FAIL - "Cannot find module '../features/dash/DashPlayerScreen'" (and `useDashSession`).

- [ ] **Step 3: Implement `features/dash/types.ts`**

Create `SRSRN/features/dash/types.ts`:

```ts
import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type DashSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type DashErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseDashSessionResult = {
  status: DashSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: DashErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
```

`import type {VLCPlayer} from 'react-native-vlc-media-player'` resolves (via the SRT feature's augmentation) to the `VlcPlayer` instance type, whose instances expose `stopPlayer()`.

- [ ] **Step 4: Implement `features/dash/useDashSession.ts`**

Create `SRSRN/features/dash/useDashSession.ts`:

```ts
import React from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';
import type {DashErrorEvent, DashSessionStatus, UseDashSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onPlaying: () => void;
  onError: (event: DashErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: DashErrorEvent) => {};

// Mirrors useSrtSession (explicit Start, attemptRef + isCurrent guard,
// idempotent cleanupAttempt via a closed flag, unmount teardown) - the same
// libVLC media stack. Because VLCPlayer exposes an imperative stopPlayer()
// ref method, cleanupAttempt performs a TRUE imperative stop. There is no
// PeerConnection, MediaStream, fetch, or AbortController; libVLC pulls the
// DASH manifest and segments internally, and late onPlaying/onError from an
// obsolete attempt are dropped by the isCurrent(attempt) guard captured in the
// per-attempt closures stored in `handlers` state.
export function useDashSession(): UseDashSessionResult {
  const [status, setStatus] = React.useState<DashSessionStatus>('idle');
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
      onError: (_event: DashErrorEvent) => {
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

- [ ] **Step 5: Implement `features/dash/DashPlayerScreen.tsx`**

Create `SRSRN/features/dash/DashPlayerScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useDashSession} from './useDashSession';

type Props = NativeStackScreenProps<RootStackParamList, 'DashPlayer'>;

export function DashPlayerScreen({route}: Props): React.JSX.Element {
  const {dashUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useDashSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="dash-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="dash-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="dash-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="dash-video"
            ref={playerRef}
            source={{uri: dashUrl}}
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
cd SRSRN && npm test -- DashPlayerScreen
```

Expected: PASS (9 tests). The "Stop during loading" test asserts `instanceA.stopPlayer` was called exactly once - this is the true imperative mirror. If it fails because `stopPlayer` was called twice, the unmount path is double-cleaning; ensure `cleanupAttempt`'s `closed` flag guards re-entry and `stop()` nulls `attemptRef` before any second call.

- [ ] **Step 7: Verify TypeScript, ESLint, and the full suite**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```

Expected: tsc clean; lint 0 problems; all tests pass (existing + new DASH suites). If `tsc` reports `import {VLCPlayer}` or the `<VLCPlayer>` JSX as an error, confirm the SRT feature's augmentation file `SRSRN/types/react-native-vlc-media-player.d.ts` exists and is within the tsconfig `include` glob (it is - `**/*.ts` matches `*.d.ts`).

- [ ] **Step 8: Commit**

```bash
git add SRSRN/features/dash/types.ts SRSRN/features/dash/useDashSession.ts SRSRN/features/dash/DashPlayerScreen.tsx SRSRN/__tests__/DashPlayerScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add DASH player with generation-guarded session and explicit Start

useDashSession mirrors useSrtSession (explicit Start, attemptRef + isCurrent
guard, idempotent cleanupAttempt via a closed flag, unmount teardown) on the
same react-native-vlc-media-player <VLCPlayer> media stack. Because VLCPlayer
exposes stopPlayer(), cleanupAttempt performs a true imperative stop. The
attempt is {id, closed} with per-attempt onPlaying/onError closures; libVLC
pulls the DASH manifest/segments (no AbortController), and late events are
dropped by isCurrent. onPlaying -> 'active'; onError -> 'error' with a
generic 'Playback error' (libVLC's onError has no message field).
DashPlayerScreen renders <VLCPlayer source={{uri: dashUrl}}> bound to the
hook's playerRef and callbacks. Reuses the SRT feature's VLC dependency, jest
mock, type augmentation, MobileVLCKit pod, and Android libc++_shared.so
workaround - no new native config.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: Launcher entry, navigator wiring, and Home screen test update

**Files:**
- Modify: `SRSRN/launcher/features.ts` (add `dash` entry; add `'DashUrl'` to `LauncherDestination`)
- Modify: `SRSRN/navigation/RootNavigator.tsx` (import + 2 `Stack.Screen`)
- Modify: `SRSRN/__tests__/HomeScreen.test.tsx` (assert real `dash` card; add navigation test; rename synthetic extra `dash` -> `rtmp`)

**Interfaces:**
- Produces: a `LAUNCHER_FEATURES` array containing the `dash` entry whose `destination: 'DashUrl'`; `LauncherDestination` includes `'DashUrl'`; `RootNavigator` registers `DashUrl` and `DashPlayer` screens.
- Consumes: `DashUrlScreen` and `DashPlayerScreen` (Task 2), `RootStackParamList` routes (Task 1).

**Steps:**

- [ ] **Step 1: Update `launcher/features.ts`**

Replace the entire contents of `SRSRN/launcher/features.ts` with:

```ts
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
  {
    id: 'dash',
    title: 'DASH Play',
    description: 'Play a DASH stream from an SRS server via VLC.',
    actionLabel: 'Open DASH',
    color: '#0e7490',
    destination: 'DashUrl',
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
import {DashUrlScreen} from '../features/dash/DashUrlScreen';
import {DashPlayerScreen} from '../features/dash/DashPlayerScreen';

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
        <Stack.Screen name="DashUrl" component={DashUrlScreen} options={{title: 'DASH URL'}} />
        <Stack.Screen name="DashPlayer" component={DashPlayerScreen} options={{title: 'DASH Player'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Update `__tests__/HomeScreen.test.tsx`**

Three edits to the existing file:

Edit A - in the "renders a card for each launcher feature from the default config" test, add a DASH assertion. The test body becomes:

```ts
  it('renders a card for each launcher feature from the default config', () => {
    const {tree} = render();
    expect(tree.root.findAllByProps({testID: 'launcher-whip-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-whep-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-hls-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-srt-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-dash-action'}).length).toBeGreaterThan(0);
  });
```

Edit B - add a new test after the SRT navigation test:

```ts
  it('navigates to DashUrl when the DASH card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-dash-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('DashUrl');
  });
```

Edit C - in the "renders an additional launcher entry without layout changes" test, rename the synthetic extra entry from `dash` to `rtmp` (the real `dash` entry now exists in `LAUNCHER_FEATURES`, so a synthetic `dash` would collide on the `keyExtractor={item => item.id}` key). The test body becomes:

```ts
  it('renders an additional launcher entry without layout changes', () => {
    const extra: LauncherFeature = {
      id: 'rtmp',
      title: 'RTMP Publish',
      description: 'Future entry.',
      actionLabel: 'Open RTMP',
      color: '#999',
      destination: 'WhipUrl',
    };
    const {tree} = render([...LAUNCHER_FEATURES, extra]);
    // Use an existence check, not an exact count: React 19's test renderer
    // represents forwardRef host components like View twice, doubling any
    // findAllByProps count on a View testID.
    expect(tree.root.findAllByProps({testID: 'launcher-rtmp-action'}).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the Home screen and App tests to verify they pass**

```bash
cd SRSRN && npm test -- HomeScreen App
```

Expected: PASS. The Home screen test asserts the real `dash` card renders and navigates to `DashUrl`; the App test renders `<App />` (which now imports the DASH screens) without crashing.

- [ ] **Step 5: Verify TypeScript and ESLint**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add SRSRN/launcher/features.ts SRSRN/navigation/RootNavigator.tsx SRSRN/__tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire DASH launcher entry and routes into the navigator

Add the DASH Play card to LAUNCHER_FEATURES (destination DashUrl, teal
#0e7490), register the DashUrl and DashPlayer Stack.Screen entries, and
extend the Home screen tests to assert the real DASH card renders and
navigates. Rename the synthetic "additional entry" test's id from dash to
rtmp so it no longer collides with the real dash entry. HomeScreen layout
logic is unchanged.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 4: Final verification

**Files:** none (verification only). Optionally update the SDD ledger.

**Steps:**

- [ ] **Step 1: Full automated suite**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```

Expected: TypeScript clean, ESLint clean, all Jest suites green (existing WHIP/WHEP/HLS/SRT/Home/App suites plus the new `dash-validation`, `DashUrlScreen`, and `DashPlayerScreen` suites).

- [ ] **Step 2: Confirm no new native dependencies**

```bash
cd SRSRN && git diff --stat main..HEAD -- SRSRN/package.json SRSRN/package-lock.json SRSRN/ios/Podfile.lock SRSRN/ios/SRSRN/Info.plist SRSRN/android/app/build.gradle SRSRN/jest.setup.js SRSRN/types/react-native-vlc-media-player.d.ts
```

Expected: either no diff for this feature's commits touching these files, or only the SRT feature's prior changes (already committed). The DASH feature must add zero new native config. If `git diff` shows DASH-related changes to any of these files, stop and reconcile - the feature was supposed to reuse the SRT infrastructure unchanged.

- [ ] **Step 3: Install/refresh iOS pods (should be a no-op)**

```bash
cd SRSRN && pod install --project-directory=ios
```

Expected: "Pod installation complete" with no new pods (MobileVLCKit already installed by SRT). If the environment cannot reach the CocoaPods CDN, record the failure explicitly - JS tests and the iOS build do not require a fresh pod install when no Podfile changed.

- [ ] **Step 4: Build the iOS workspace**

```bash
cd SRSRN && xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphoneos -configuration Debug build
```

Expected: BUILD SUCCEEDED. If signing fails (no team - the SRSRN pbxproj is at template defaults by user choice), fall back to `-sdk iphonesimulator` and record which SDK was used. If `xcodebuild` is unavailable, record that.

- [ ] **Step 5: Android Gradle configuration check**

```bash
cd SRSRN && cd android && ./gradlew :app:tasks
```

Expected: Gradle configuration resolves and lists tasks without error. No new Gradle config was added; the existing `libc++_shared.so` workaround (from SRT) still applies. No emulator or device runtime verification is required.

- [ ] **Step 6: Report iOS functional checks and the DASH-support gate**

The following iOS functional checks require a physical device and a reachable SRS DASH endpoint (`http://192.168.1.100:8080/live/livestream.mpd`, with DASH enabled in the SRS config). Do not claim any was verified unless it was actually observed:

1. Launch into Home and confirm the DASH card is present.
2. Open DASH, retain or edit the URL, press Start, receive DASH playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, a malformed manifest, and a decode error each produce an understandable, recoverable message (generic "Playback error").

**🔴 Gating check:** DASH is a core VLC demuxer (not an external library like libsrt), so the structural risk that sank SRT does not apply. However, VLC 3.x's DASH demuxer compatibility with SRS's specific DASH manifest output is unverified. An actual `.mpd` stream **must** be played on a device to confirm libVLC's DASH demuxer parses and plays SRS's output. If DASH playback does not work, this approach fails and the project reconsiders. Do not claim DASH playback was verified unless a `.mpd` stream was actually observed playing.

If no device or endpoint is available, explicitly state which checks remain manual and stop at Step 5.

- [ ] **Step 7: Update the SDD ledger (if using subagent-driven-development)**

Record the DASH feature outcome in `.superpowers/sdd/2026-08-05-srs-rn-dash-play/progress.md` (create the directory). Note: tsc/lint/jest green, iOS build status, Android gradle status, and the device-verification gate result (pending/observed).

---

## Self-Review

Performed against the approved spec (`docs/superpowers/specs/2026-08-05-srs-rn-dash-design.md`) and the committed SRT feature (`features/srt/`, which provides the VLC infrastructure this feature reuses).

**1. Spec coverage** - each spec section maps to a task:

| Spec section | Implemented in |
| --- | --- |
| Objective / scope (DASH play via VLC, fifth feature, reuses SRT stack) | Global Constraints, Tasks 1-4 |
| Architecture (feature tree) | File Structure, Tasks 1-3 |
| Media Stack (react-native-vlc-media-player reused, DASH core demuxer, viability gate) | Global Constraints, Task 4 (gate) |
| Launcher (dash entry, no layout change, `DashUrl` destination, teal color) | Task 3 |
| Navigation (`DashUrl`/`DashPlayer` routes, typed param, unmount teardown) | Task 1 (routes), Task 2 (screen), Task 3 (navigator) |
| DASH Playback Flow (Start, `<VLCPlayer>`, onPlaying/onError, Stop/unmount) | Task 2 |
| Session Lifecycle (explicit Start, attempt, isCurrent, closed, stopPlayer, no abort, idempotent, stale isolation, unmount teardown) | Task 2 (`useDashSession`) |
| Attempt shape & imperative cleanup (`{id, closed}`, `playerRef`, `stopPlayer()`) | Task 2 (types + hook) |
| Error Handling (URL rejection, generic "Playback error", recoverable) | Task 1 (validation), Task 2 (onError), Task 4 (functional) |
| Native Config (none new - reuses SRT's VLC dep/pod/augmentation/mock/permission/Gradle) | Global Constraints, Task 4 Step 2 (verify no new native config) |
| URL Entry & Validation (`DEFAULT_DASH_URL`, `validateDashUrl`, http/https scheme) | Task 1 |
| Testing (Home, URL entry, validation, player, navigation, idempotent, recovery) | Tasks 1-3 tests, Task 4 |
| Verification (tsc, lint, jest, no-new-native check, iOS build, Android gradle, DASH-support gate, functional) | Task 4 |
| Acceptance criteria | covered across all tasks |

No spec gaps.

**2. Placeholder scan** - no `TBD`/`TODO`/`implement later`/`add appropriate`/`similar to Task N`. Every code step has concrete code; every command step has a concrete command with expected output. Conditional notes ("If signing fails...", "If `xcodebuild` is unavailable...", "If `git diff` shows DASH-related changes...") name concrete fallbacks, not deferrals.

**3. Type consistency** - verified end to end:
- `DEFAULT_DASH_URL`, `validateDashUrl`, `ValidationResult` defined in Task 1 and consumed by `DashUrlScreen` (Task 1) and `DashPlayerScreen.test.tsx` (Task 2).
- `DashSessionStatus`, `DashErrorEvent`, `UseDashSessionResult` defined in `features/dash/types.ts` (Task 2 Step 3) and consumed by `useDashSession` (Task 2 Step 4).
- `useDashSession()` takes no argument; `DashPlayerScreen` calls `useDashSession()` with no argument.
- `playerRef: RefObject<VLCPlayer | null>` (Task 2 types.ts) matches `React.useRef<VLCPlayer>(null)` (Task 2 hook). `VLCPlayer` is the `VlcPlayer` instance type from the SRT feature's augmentation's named export; `import type {VLCPlayer} from 'react-native-vlc-media-player'` resolves to it. `<VLCPlayer ref={playerRef}>` type-checks because the augmentation's `VlcPlayer` class `implements VLCPlayerInstance`, so the ref's instance type includes `stopPlayer()`.
- `DashErrorEvent = {target?: number; [key: string]: unknown}` is a supertype of libVLC's `onError` payload `{target: number}`, so `onError={onError}` type-checks via parameter contravariance.
- Test IDs consistent: `dash-url-*` (Task 1), `dash-player-*` / `dash-video` (Task 2), `launcher-dash-action` (Task 3); the synthetic extra entry uses `launcher-rtmp-action` (Task 3, non-colliding).
- The jest mock's `__mockVlcInstances[i].stopPlayer` (jest.fn()) is what the "Stop during loading" test asserts was called; the hook calls `playerRef.current?.stopPlayer()`, and the mock's `useImperativeHandle` exposes the same instance (with `stopPlayer`) as the ref.

No type drift found.

**4. Ambiguity check** - `cleanupAttempt`'s imperative `stopPlayer()` is explicit (Global Constraints + Task 2 comments). `useDashSession()` no-arg is explicit. The generic "Playback error" is explicit (Global Constraints + Task 2). The http/https scheme check is explicit (and the srt-scheme rejection is tested). The DASH-support device gate is explicit in Task 4. The named `VLCPlayer` import (not default) is explicit in Global Constraints, with the runtime rationale documented.

**5. Reuse verification** - the feature adds no new files outside `features/dash/`, `__tests__/`, `navigation/types.ts`, `navigation/RootNavigator.tsx`, `launcher/features.ts`, and `__tests__/HomeScreen.test.tsx`. It does not touch `package.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/`, or `android/` - all VLC infrastructure is inherited from SRT. Task 4 Step 2 verifies this with `git diff`.

---
