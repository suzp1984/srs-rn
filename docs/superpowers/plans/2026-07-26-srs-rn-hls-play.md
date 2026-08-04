# SRS RN HLS Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HLS playback as a third protocol feature on the SRS RN launcher, validating that a non-WebRTC protocol fits as a separate feature directory + launcher entry without redesigning Home or forcing a WebRTC abstraction.

**Architecture:** A new `features/hls/` directory owns its URL-entry screen, player screen, validation, types, and a `useHlsSession` hook that mirrors `useWhepSession`'s structure (explicit Start, attempt generation guard, idempotent cleanup, unmount teardown) adapted to a `react-native-video` `<Video>` component. The player is released by unmounting `<Video>` (status -> `idle`) plus a `closed` flag that drops late `onLoad`/`onError` callbacks; there is no PeerConnection, SDP, fetch, or AbortController. A launcher entry and two routes wire it into the existing navigator without touching `HomeScreen` layout.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-video 6.19.2 (new), react-native-webrtc 124.0.7 (unchanged), React Navigation 7, Jest 29 + react-test-renderer 19.

## Global Constraints

- App root is `SRSRN/` (an independent app). Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- React Native `0.86.0`, React `19.2.3`, TypeScript `^5.8.3`, `react-native-webrtc` `124.0.7` (all unchanged).
- `react-native-video` pinned to `6.19.2` (latest v6 stable; peer deps `react: *`, `react-native: *`, satisfied by `19.2.3` / `0.86.0`).
- Do NOT modify `features/whip/`, `features/whep/`, `WHIPPublisher/`, or `WHEPPlayer/`. The only exception is `SRSRN/__tests__/HomeScreen.test.tsx` in Task 4: one test's synthetic extra launcher entry is renamed from `id: 'hls'` to `id: 'srt'` to avoid colliding with the real `hls` entry this feature adds, and one new navigation test is added.
- Default HLS URL (verbatim): `http://192.168.1.100:8080/live/livestream.m3u8`.
- No new iOS or Android permissions. HLS play uses no camera/mic. ATS is already covered by the existing `NSAllowsLocalNetworking`; Android `usesCleartextTraffic` is already auto-wired by the RN Gradle plugin.
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks on host-component testIDs (React 19's test renderer doubles `View`/forwardRef host counts; never assert exact counts).
- Commits land on `feature/srs-rn-unified-app`. Use Conventional Commits (`feat(srsrn):`, `test(srsrn):`, `chore(srsrn):`). End every commit message with a blank line then `Co-Authored-By: Claude <noreply@anthropic.com>`.
- `cleanupAttempt` does NOT call an imperative `ref.stop()`. react-native-video v6's `VideoRef` exposes `seek`/fullscreen methods, not a reliable `stop`; playback is controlled via the `paused` prop and the player is released by unmounting `<Video>` (status -> `idle`). The `closed` flag + `isCurrent(attempt)` guard drops late `onLoad`/`onError` callbacks. This matches the approved spec's "honest constraint."
- `useHlsSession` takes no argument. Unlike `useWhepSession(whepUrl)` (which uses the URL to fetch SDP), the HLS hook manages only session lifecycle; the URL is passed to `<Video source={{uri: hlsUrl}}>` by the screen.

## Pre-flight: commit pre-existing pbxproj state

The working tree has uncommitted changes in `SRSRN/ios/SRSRN.xcodeproj/project.pbxproj` (a `DEVELOPMENT_TEAM = 4X75RZ9C85;` line and CocoaPods build-phase `inputPaths`/`outputPaths` arrays from a prior `pod install`). These predate this feature. Commit them separately so Task 1's commit is focused on react-native-video.

- [ ] **Step 0a: Commit the pre-existing pbxproj state**

```bash
git add SRSRN/ios/SRSRN.xcodeproj/project.pbxproj
git commit -F - <<'COMMIT_MSG'
chore(srsrn): commit local pbxproj state (dev team, pod build phases)

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

If you do NOT want to commit the `DEVELOPMENT_TEAM` line, stash it instead and restore after Task 1: `git stash push -- SRSRN/ios/SRSRN.xcodeproj/project.pbxproj`, then `git stash pop` after Task 1's commit.

---

## File Structure

```text
SRSRN/
├── package.json                         # +react-native-video 6.19.2 (Task 1)
├── package-lock.json                    # updated (Task 1)
├── jest.setup.js                        # +jest.mock('react-native-video') (Task 1)
├── ios/Podfile.lock                     # +react-native-video pod (Task 1)
├── ios/SRSRN.xcodeproj/project.pbxproj  # pod build-phase regen (Task 1)
├── navigation/types.ts                  # +HlsUrl, +HlsPlayer routes (Task 2)
├── navigation/RootNavigator.tsx         # +2 Stack.Screen (Task 4)
├── launcher/features.ts                 # +hls entry, +HlsUrl in union (Task 4)
├── features/hls/                        # new feature directory (Tasks 2-3)
│   ├── validation.ts                    # Task 2
│   ├── HlsUrlScreen.tsx                 # Task 2
│   ├── types.ts                         # Task 3
│   ├── useHlsSession.ts                 # Task 3
│   └── HlsPlayerScreen.tsx              # Task 3
└── __tests__/
    ├── hls-validation.test.ts           # Task 2
    ├── HlsUrlScreen.test.tsx            # Task 2
    ├── HlsPlayerScreen.test.tsx         # Task 3
    └── HomeScreen.test.tsx              # update extra-entry id + add nav test (Task 4)
```

Each file has one responsibility; the feature owns its screens, validation, types, lifecycle hook, and tests, mirroring `features/whep/`.

---

### Task 1: Install react-native-video and add its jest mock

**Files:**
- Modify: `SRSRN/package.json` (add `"react-native-video": "6.19.2"` to `dependencies`)
- Modify: `SRSRN/package-lock.json` (regenerated by npm)
- Modify: `SRSRN/ios/Podfile.lock` (add react-native-video pod)
- Modify: `SRSRN/ios/SRSRN.xcodeproj/project.pbxproj` (pod build-phase regen)
- Modify: `SRSRN/jest.setup.js` (add `jest.mock('react-native-video', ...)`)

**Interfaces:**
- Produces: a `react-native-video` module mock exposing `{ __esModule: true, default: Video, Video, __mockVideoInstances, __resetVideoMocks }`, where `Video` is a `forwardRef` component that records each mounted instance (with `__fireOnLoad`/`__fireOnError`) into `__mockVideoInstances`. Later tasks rely on `__mockVideoInstances[0]` and `__resetVideoMocks()`.

**Steps:**

- [ ] **Step 1: Install the dependency**

```bash
cd SRSRN && npm install react-native-video@6.19.2
```

Expected: `package.json` `dependencies` gains `"react-native-video": "6.19.2"`; `package-lock.json` updated.

- [ ] **Step 2: Verify resolution and peer compatibility**

```bash
cd SRSRN && npm ls react-native-video
```

Expected: `react-native-video@6.19.2` with no unmet peer dependency errors (peers are `react: *`, `react-native: *`, satisfied by `19.2.3` / `0.86.0`).

- [ ] **Step 3: Install the iOS pod (auto-linked via `use_native_modules!`)**

```bash
cd SRSRN && pod install --project-directory=ios
```

Expected: `Podfile.lock` gains the `react-native-video` pod and transitive deps; the pbxproj's `[CP] Embed Pods Frameworks` and `[CP] Copy Pods Resources` build phases regenerate. If the CocoaPods CDN or Xcode is unavailable, note the failure and proceed - the JS tests in later steps do not require pods; Task 5 retries the install and build.

- [ ] **Step 4: Add the `react-native-video` jest mock to `jest.setup.js`**

Append the following block to `SRSRN/jest.setup.js`, after the existing `jest.mock('react-native-webrtc', ...)` block:

```js
jest.mock('react-native-video', () => {
  const React = require('react');
  const mockVideoInstances = [];

  function makeInstance() {
    const instance = {
      seek: jest.fn(),
      __onLoad: null,
      __onError: null,
      __fireOnLoad(payload) {
        if (instance.__onLoad) {
          instance.__onLoad(payload);
        }
      },
      __fireOnError(payload) {
        if (instance.__onError) {
          instance.__onError(payload);
        }
      },
    };
    mockVideoInstances.push(instance);
    return instance;
  }

  const Video = React.forwardRef((props, ref) => {
    const instanceRef = React.useRef(null);
    if (instanceRef.current === null) {
      instanceRef.current = makeInstance();
    }
    const instance = instanceRef.current;
    // Re-bind the latest onLoad/onError on every render so a per-attempt
    // closure (see useHlsSession) is what __fireOnLoad/__fireOnError invokes.
    instance.__onLoad = props.onLoad;
    instance.__onError = props.onError;
    React.useImperativeHandle(ref, () => instance, []);
    // NOTE: deliberately no cleanup effect that nulls __onLoad/__onError -
    // tests must be able to fire late events on a stale/unmounted instance to
    // verify the isCurrent guard drops them.
    return React.createElement('Video', {testID: props.testID});
  });

  return {
    __esModule: true,
    default: Video,
    Video,
    __mockVideoInstances: mockVideoInstances,
    __resetVideoMocks() {
      mockVideoInstances.length = 0;
    },
  };
});
```

- [ ] **Step 5: Verify TypeScript and the existing test suite still pass**

```bash
cd SRSRN && npx tsc --noEmit && npm test -- --silent
```

Expected: `tsc` reports no errors; all existing tests pass (the new mock is inert for files that do not import `react-native-video`).

- [ ] **Step 6: Commit**

```bash
git add SRSRN/package.json SRSRN/package-lock.json SRSRN/ios/Podfile.lock SRSRN/ios/SRSRN.xcodeproj/project.pbxproj SRSRN/jest.setup.js
git commit -F - <<'COMMIT_MSG'
chore(srsrn): add react-native-video 6.19.2 and jest mock

Pin react-native-video to v6.19.2 (latest v6 stable; peers react:* and
react-native:*, compatible with RN 0.86). Wire the iOS pod via auto-linking
and add a jest mock that records each mounted <Video> instance with
__fireOnLoad/__fireOnError so session-lifecycle tests can drive player
events without a native player.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 2: HLS routes, validation, and URL-entry screen

**Files:**
- Modify: `SRSRN/navigation/types.ts` (add `HlsUrl` and `HlsPlayer` to `RootStackParamList`)
- Create: `SRSRN/features/hls/validation.ts`
- Create: `SRSRN/features/hls/HlsUrlScreen.tsx`
- Test: `SRSRN/__tests__/hls-validation.test.ts`
- Test: `SRSRN/__tests__/HlsUrlScreen.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_HLS_URL` (string), `validateHlsUrl(input: string): ValidationResult`, `ValidationResult` type, and the `HlsUrlScreen` component that navigates to `HlsPlayer` with `{hlsUrl: string}`.
- Consumes: `RootStackParamList` (extended in Step 1 of this same task so `NativeStackScreenProps<RootStackParamList, 'HlsUrl'>` type-checks).

**Steps:**

- [ ] **Step 1: Add the HLS routes to `navigation/types.ts`**

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
};
```

- [ ] **Step 2: Write the failing validation test**

Create `SRSRN/__tests__/hls-validation.test.ts`:

```ts
import {DEFAULT_HLS_URL, validateHlsUrl} from '../features/hls/validation';

describe('validateHlsUrl', () => {
  it('rejects empty input', () => {
    expect(validateHlsUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateHlsUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateHlsUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateHlsUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_HLS_URL', () => {
    expect(validateHlsUrl(DEFAULT_HLS_URL)).toEqual({ok: true, url: DEFAULT_HLS_URL});
  });
  it('accepts a valid https HLS URL', () => {
    expect(validateHlsUrl('https://example.com/live/stream.m3u8')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.m3u8',
    });
  });
  it('accepts a valid HLS URL without a .m3u8 suffix', () => {
    expect(validateHlsUrl('http://example.com/live/stream')).toEqual({
      ok: true,
      url: 'http://example.com/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateHlsUrl('  https://example.com/live/stream.m3u8  ')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.m3u8',
    });
  });
  it('DEFAULT_HLS_URL is the SRS HLS endpoint', () => {
    expect(DEFAULT_HLS_URL).toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
  it('does not collide with the WHEP default', () => {
    expect(DEFAULT_HLS_URL).not.toBe(
      'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream',
    );
  });
});
```

- [ ] **Step 3: Run the validation test to verify it fails**

```bash
cd SRSRN && npm test -- hls-validation
```

Expected: FAIL - "Cannot find module '../features/hls/validation'".

- [ ] **Step 4: Implement `features/hls/validation.ts`**

Create `SRSRN/features/hls/validation.ts`:

```ts
export const DEFAULT_HLS_URL =
  'http://192.168.1.100:8080/live/livestream.m3u8';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateHlsUrl(input: string): ValidationResult {
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
cd SRSRN && npm test -- hls-validation
```

Expected: PASS (10 tests).

- [ ] **Step 6: Write the failing `HlsUrlScreen` test**

Create `SRSRN/__tests__/HlsUrlScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {HlsUrlScreen} from '../features/hls/HlsUrlScreen';
import {DEFAULT_HLS_URL} from '../features/hls/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'hls-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'HlsUrl-test', name: 'HlsUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<HlsUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('HlsUrlScreen', () => {
  it('prefills the input with DEFAULT_HLS_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'hls-url-input').props.value).toBe(DEFAULT_HLS_URL);
  });
  it('navigates to HlsPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'hls-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('HlsPlayer', {hlsUrl: DEFAULT_HLS_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'hls-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'hls-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for non-http(s) URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'hls-url-input').props.onChangeText('ftp://host/x');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'hls-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'hls-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/live/stream.m3u8');
    });
    expect(input.props.value).toBe('https://example.com/live/stream.m3u8');
  });
});
```

- [ ] **Step 7: Run the screen test to verify it fails**

```bash
cd SRSRN && npm test -- HlsUrlScreen
```

Expected: FAIL - "Cannot find module '../features/hls/HlsUrlScreen'".

- [ ] **Step 8: Implement `features/hls/HlsUrlScreen.tsx`**

Create `SRSRN/features/hls/HlsUrlScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_HLS_URL, validateHlsUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'HlsUrl'>;

export function HlsUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_HLS_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateHlsUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('HlsPlayer', {hlsUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>HLS server URL</Text>
      <TextInput
        testID="hls-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="hls-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="hls-url-connect" title="Connect" onPress={onConnect} />
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
cd SRSRN && npm test -- HlsUrlScreen
```

Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add SRSRN/navigation/types.ts SRSRN/features/hls/validation.ts SRSRN/features/hls/HlsUrlScreen.tsx SRSRN/__tests__/hls-validation.test.ts SRSRN/__tests__/HlsUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add HLS URL entry screen with preserved default URL

Add the HlsUrl and HlsPlayer routes, validateHlsUrl (syntactic http/https
validation mirroring validateWhepUrl), DEFAULT_HLS_URL pointing at the SRS
HLS endpoint (192.168.1.100:8080/live/livestream.m3u8), and HlsUrlScreen
which navigates to HlsPlayer with the typed {hlsUrl} parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: HLS session hook and player screen

**Files:**
- Create: `SRSRN/features/hls/types.ts`
- Create: `SRSRN/features/hls/useHlsSession.ts`
- Create: `SRSRN/features/hls/HlsPlayerScreen.tsx`
- Test: `SRSRN/__tests__/HlsPlayerScreen.test.tsx`

**Interfaces:**
- Produces: `HlsSessionStatus`, `HlsErrorEvent`, `UseHlsSessionResult` types; `useHlsSession()` hook returning `{status, errorMessage, playerRef, onLoad, onError, start, stop}`; and the `HlsPlayerScreen` component.
- Consumes: `RootStackParamList` `HlsPlayer` route (added in Task 2) and the `react-native-video` mock (Task 1).

**Steps:**

- [ ] **Step 1: Write the failing player-screen test**

Create `SRSRN/__tests__/HlsPlayerScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {HlsPlayerScreen} from '../features/hls/HlsPlayerScreen';
import {DEFAULT_HLS_URL} from '../features/hls/validation';

const video = require('react-native-video');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'hls-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'hls-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'HlsPlayer-test',
    name: 'HlsPlayer' as const,
    params: {hlsUrl: DEFAULT_HLS_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<HlsPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

// pressStart is async only to flush the batched status/handlers state updates
// through act. After `await pressStart(tree)` status is 'starting', the Start
// button is replaced by Stop, <Video> is mounted, and the instance is at
// video.__mockVideoInstances[0].
async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'hls-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'hls-player-stop').props.onPress();
  });
}

describe('HlsPlayerScreen - no work before Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('renders no Video and creates no player instance before Start', () => {
    const tree = render();
    expect(video.__mockVideoInstances.length).toBe(0);
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('HlsPlayerScreen - happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('Start mounts the Video and onLoad marks the session active with no error', async () => {
    const tree = render();
    await pressStart(tree);
    expect(hasVideo(tree.root)).toBe(true);
    expect(video.__mockVideoInstances.length).toBe(1);
    ReactTestRenderer.act(() => {
      video.__mockVideoInstances[0].__fireOnLoad({});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasVideo(tree.root)).toBe(true);
  });
});

describe('HlsPlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('creates only one Video when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'hls-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(video.__mockVideoInstances.length).toBe(1);
  });
});

describe('HlsPlayerScreen - cancellation during each stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('Stop during loading unmounts the Video and leaves no session', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = video.__mockVideoInstances[0];
    pressStop(tree);
    expect(hasVideo(tree.root)).toBe(false);
    // A late onLoad after Stop must be ignored (no error promoted).
    ReactTestRenderer.act(() => {
      instanceA.__fireOnLoad({});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'hls-player-start'}).length).toBeGreaterThan(0);
  });

  it('unmount tears down any active session without throwing on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = video.__mockVideoInstances[0];
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(() => {
      ReactTestRenderer.act(() => instanceA.__fireOnLoad({}));
    }).not.toThrow();
  });
});

describe('HlsPlayerScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('a stale attempt late-arriving onLoad/onError does not update the UI or disturb the newer attempt', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    const instanceA = video.__mockVideoInstances[0];
    pressStop(tree); // Stop A -> Video A unmounts
    await pressStart(tree); // attempt B
    const instanceB = video.__mockVideoInstances[1];
    // Stale A's late events must be dropped by the isCurrent(attempt) guard.
    ReactTestRenderer.act(() => {
      instanceA.__fireOnLoad({});
    });
    ReactTestRenderer.act(() => {
      instanceA.__fireOnError({error: {message: 'stale failure'}});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasVideo(tree.root)).toBe(true);
    // B is still the current attempt and responds to its own onLoad.
    ReactTestRenderer.act(() => {
      instanceB.__fireOnLoad({});
    });
    expect(hasVideo(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});

describe('HlsPlayerScreen - visible errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    video.__resetVideoMocks();
  });

  it('an onError event shows a user-visible error and unmounts the Video', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      video.__mockVideoInstances[0].__fireOnError({error: {message: 'Network request failed'}});
    });
    expect(findByTestID(tree.root, 'hls-player-error').props.children).toContain('Network');
    expect(hasVideo(tree.root)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd SRSRN && npm test -- HlsPlayerScreen
```

Expected: FAIL - "Cannot find module '../features/hls/HlsPlayerScreen'" (and `useHlsSession`).

- [ ] **Step 3: Implement `features/hls/types.ts`**

Create `SRSRN/features/hls/types.ts`:

```ts
import type {RefObject} from 'react';
import type {VideoRef} from 'react-native-video';

export type HlsSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// Permissive error shape: react-native-video v6 reports onError with an
// object carrying `error.message`; older builds wrap it as `{error: {...}}`.
// The index signature makes this a supertype of either, so the handler
// type-checks against v6's exact onError param without coupling to it.
export type HlsErrorEvent = {
  error?: {message?: string};
  message?: string;
  [key: string]: unknown;
};

export type UseHlsSessionResult = {
  status: HlsSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VideoRef | null>;
  onLoad: () => void;
  onError: (event: HlsErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 4: Implement `features/hls/useHlsSession.ts`**

Create `SRSRN/features/hls/useHlsSession.ts`:

```ts
import React from 'react';
import type {VideoRef} from 'react-native-video';
import type {HlsErrorEvent, HlsSessionStatus, UseHlsSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onLoad: () => void;
  onError: (event: HlsErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: HlsErrorEvent) => {};

// Mirrors useWhepSession's structure (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) but
// adapted to a component-mounted react-native-video player. There is no
// PeerConnection, MediaStream, fetch, or AbortController: the player is
// released by unmounting <Video> (status -> 'idle'), and late onLoad/onError
// from an obsolete attempt are dropped by the isCurrent(attempt) guard
// captured in the per-attempt closures stored in `handlers` state.
export function useHlsSession(): UseHlsSessionResult {
  const [status, setStatus] = React.useState<HlsSessionStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const playerRef = React.useRef<VideoRef>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // No imperative ref.stop(): react-native-video v6 releases the player
    // when <Video> unmounts. The status -> 'idle' transition in stop() and
    // onError() performs that unmount; this closed flag plus isCurrent()
    // drops any late onLoad/onError from this attempt.
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
    // onLoad/onError short-circuits via isCurrent(attempt).
    const attemptHandlers: Handlers = {
      onLoad: () => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onError: (event: HlsErrorEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage(event?.error?.message ?? event?.message ?? 'Playback error');
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
    onLoad: handlers?.onLoad ?? noop,
    onError: handlers?.onError ?? noopError,
    start,
    stop,
  };
}
```

- [ ] **Step 5: Implement `features/hls/HlsPlayerScreen.tsx`**

Create `SRSRN/features/hls/HlsPlayerScreen.tsx`:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import Video from 'react-native-video';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useHlsSession} from './useHlsSession';

type Props = NativeStackScreenProps<RootStackParamList, 'HlsPlayer'>;

export function HlsPlayerScreen({route}: Props): React.JSX.Element {
  const {hlsUrl} = route.params;
  const {status, errorMessage, playerRef, onLoad, onError, start, stop} = useHlsSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="hls-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="hls-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="hls-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <Video
            testID="hls-video"
            ref={playerRef}
            source={{uri: hlsUrl}}
            paused={false}
            resizeMode="contain"
            onLoad={onLoad}
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
cd SRSRN && npm test -- HlsPlayerScreen
```

Expected: PASS (7 tests). If the `onError={onError}` assignment fails TypeScript in Step 7, confirm `HlsErrorEvent`'s index signature is present (Step 3) - it makes `HlsErrorEvent` a supertype of v6's exact `onError` param.

- [ ] **Step 7: Verify TypeScript is clean**

```bash
cd SRSRN && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add SRSRN/features/hls/types.ts SRSRN/features/hls/useHlsSession.ts SRSRN/features/hls/HlsPlayerScreen.tsx SRSRN/__tests__/HlsPlayerScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add HLS player with generation-guarded session and explicit Start

useHlsSession mirrors useWhepSession (explicit Start, attemptRef + isCurrent
guard, idempotent cleanupAttempt via a closed flag, unmount teardown) adapted
to a react-native-video <Video> component. The attempt is {id, closed} with
per-attempt onLoad/onError closures; the player is released by unmounting
<Video> (status -> idle) since react-native-video v6 has no imperative stop.
HlsPlayerScreen renders <Video source={{uri: hlsUrl}} paused={false}> bound
to the hook's playerRef and onLoad/onError.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---
### Task 4: Launcher entry, navigator wiring, and Home screen test update

**Files:**
- Modify: `SRSRN/launcher/features.ts` (add `hls` entry; add `'HlsUrl'` to `LauncherDestination`)
- Modify: `SRSRN/navigation/RootNavigator.tsx` (import + 2 `Stack.Screen`)
- Modify: `SRSRN/__tests__/HomeScreen.test.tsx` (assert real `hls` card; add navigation test; rename synthetic extra entry `hls` -> `srt`)

**Interfaces:**
- Produces: a `LAUNCHER_FEATURES` array containing the `hls` entry whose `destination: 'HlsUrl'`; `LauncherDestination` now includes `'HlsUrl'`; `RootNavigator` registers `HlsUrl` and `HlsPlayer` screens.
- Consumes: `HlsUrlScreen` and `HlsPlayerScreen` (Task 3), `RootStackParamList` routes (Task 2).

**Steps:**

- [ ] **Step 1: Update `launcher/features.ts`**

Replace the entire contents of `SRSRN/launcher/features.ts` with:

```ts
import type {RootStackParamList} from '../navigation/types';

export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl' | 'HlsUrl'
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Update `__tests__/HomeScreen.test.tsx`**

Three edits to the existing file:

Edit A - in the "renders a card for each launcher feature from the default config" test, add an HLS assertion. The test body becomes:

```ts
  it('renders a card for each launcher feature from the default config', () => {
    const {tree} = render();
    expect(tree.root.findAllByProps({testID: 'launcher-whip-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-whep-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-hls-action'}).length).toBeGreaterThan(0);
  });
```

Edit B - add a new test after the WHEP navigation test:

```ts
  it('navigates to HlsUrl when the HLS card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-hls-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('HlsUrl');
  });
```

Edit C - in the "renders an additional launcher entry without layout changes" test, rename the synthetic extra entry from `hls` to `srt` (the real `hls` entry now exists in `LAUNCHER_FEATURES`, so a synthetic `hls` would collide on the `keyExtractor={item => item.id}` key). The test body becomes:

```ts
  it('renders an additional launcher entry without layout changes', () => {
    const extra: LauncherFeature = {
      id: 'srt',
      title: 'SRT Play',
      description: 'Future entry.',
      actionLabel: 'Open SRT',
      color: '#999',
      destination: 'WhipUrl',
    };
    const {tree} = render([...LAUNCHER_FEATURES, extra]);
    // Use an existence check, not an exact count: React 19's test renderer
    // represents forwardRef host components like View twice, doubling any
    // findAllByProps count on a View testID.
    expect(tree.root.findAllByProps({testID: 'launcher-srt-action'}).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the Home screen and App tests to verify they pass**

```bash
cd SRSRN && npm test -- HomeScreen App
```

Expected: PASS. The Home screen test now asserts the real `hls` card renders and navigates to `HlsUrl`; the App test renders `<App />` (which now imports the HLS screens and `react-native-video`'s mock) without crashing.

- [ ] **Step 5: Verify TypeScript and ESLint are clean**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add SRSRN/launcher/features.ts SRSRN/navigation/RootNavigator.tsx SRSRN/__tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire HLS launcher entry and routes into the navigator

Add the HLS Play card to LAUNCHER_FEATURES (destination HlsUrl), register
the HlsUrl and HlsPlayer Stack.Screen entries, and extend the Home screen
tests to assert the real HLS card renders and navigates. Rename the synthetic
"additional entry" test's id from hls to srt so it no longer collides with
the real hls entry. HomeScreen layout logic is unchanged.

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

Expected: TypeScript clean, ESLint clean, all Jest suites green (existing WHEP/WHIP/Home/App suites plus the new `hls-validation`, `HlsUrlScreen`, and `HlsPlayerScreen` suites).

- [ ] **Step 2: Install/refresh iOS pods (retry if Task 1 Step 3 was skipped)**

```bash
cd SRSRN && pod install --project-directory=ios
```

Expected: `Podfile.lock` lists `react-native-video`; "Pod installation complete". If the environment cannot reach the CocoaPods CDN, record the failure explicitly - do not claim the iOS build was verified.

- [ ] **Step 3: Build the iOS workspace**

```bash
cd SRSRN && xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphoneos -configuration Debug build
```

Expected: BUILD SUCCEEDED. If the device SDK is unavailable, fall back to `-sdk iphonesimulator` and record which SDK was used. If signing fails (no team), set `Signing & Capabilities > Team` in `ios/SRSRN.xcworkspace` and retry.

- [ ] **Step 4: Android Gradle configuration check**

```bash
cd SRSRN && cd android && ./gradlew :app:tasks
```

Expected: Gradle configuration resolves and lists tasks without error (no emulator or device runtime verification required, consistent with the unified-app spec).

- [ ] **Step 5: Report iOS functional checks**

The following iOS functional checks require a physical device and a reachable SRS HLS endpoint (`http://192.168.1.100:8080/live/livestream.m3u8`). Do not claim any was verified unless it was actually observed:

1. Launch into Home and confirm the HLS card is present.
2. Open HLS, retain or edit the URL, press Start, receive HLS playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended (no active session).
4. Confirm an unreachable server, a missing manifest (404), and a player decode error each produce an understandable, recoverable message.

If no device or endpoint is available, explicitly state which checks remain manual and stop at Step 4.

- [ ] **Step 6: Final commit (only if Step 2 regenerated lockfiles)**

```bash
git add SRSRN/ios/Podfile.lock SRSRN/ios/SRSRN.xcodeproj/project.pbxproj 2>/dev/null
git diff --cached --quiet || git commit -F - <<'COMMIT_MSG'
chore(srsrn): refresh pods after react-native-video install

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

If `git diff --cached --quiet` exits 0 (nothing staged), skip the commit.

---
## Self-Review

Performed against the approved spec (`docs/superpowers/specs/2026-07-26-srs-rn-hls-play-design.md`) and the installed `@types/react@19.2.17`.

**1. Spec coverage** - each spec section maps to a task:

| Spec section | Implemented in |
| --- | --- |
| Objective / scope (play-only, validate architecture) | Global Constraints, Tasks 1-5 |
| Architecture (feature tree) | File Structure, Tasks 2-4 |
| Media Stack (react-native-video v6, AVPlayer/ExoPlayer, no webrtc, verify compat) | Task 1, Global Constraints |
| Launcher (hls entry, no layout change, `HlsUrl` destination) | Task 4 |
| Navigation (`HlsUrl`/`HlsPlayer` routes, typed param, unmount teardown) | Task 2 (routes), Task 3 (screen), Task 4 (navigator) |
| HLS Playback Flow (Start, `<Video>`, onLoad/onError, Stop/unmount) | Task 3 |
| Session Lifecycle (explicit Start, attempt, isCurrent, closed, idempotent cleanup, stale isolation, unmount teardown) | Task 3 (`useHlsSession`) |
| Attempt shape & honest mirror (`{id, closed}`, no pc/stream/abort, `playerRef`) | Task 3 (types + hook) |
| Error Handling (URL rejection, player onError, recoverable) | Task 2 (validation), Task 3 (onError), Task 5 (functional) |
| Native Config (dep, pod, no permissions, ATS, Android gradle) | Task 1, Task 5, Global Constraints |
| URL Entry & Validation (`DEFAULT_HLS_URL`, `validateHlsUrl`, `HlsUrlScreen`) | Task 2 |
| Testing (Home, URL entry, validation, player, navigation) | Tasks 2-4 tests, Task 5 |
| Verification (install, tsc, lint, jest, pod, iOS build, Android gradle, functional) | Task 5 |
| Acceptance criteria | covered across all tasks |

No spec gaps.

**2. Placeholder scan** - no `TBD`/`TODO`/`implement later`/`add appropriate ...`/`similar to Task N` in the plan. Every code step contains concrete code; every command step contains a concrete command with expected output. The two conditional notes ("If tsc reports...", "If the device SDK is unavailable...") name a concrete fallback, not a deferral.

**3. Type consistency** - verified end to end:
- `DEFAULT_HLS_URL`, `validateHlsUrl`, `ValidationResult` defined in Task 2 and consumed by `HlsUrlScreen` (Task 2) and `HlsPlayerScreen.test.tsx` (Task 3).
- `HlsSessionStatus`, `HlsErrorEvent`, `UseHlsSessionResult` defined in `features/hls/types.ts` (Task 3 Step 3) and consumed by `useHlsSession` (Task 3 Step 4).
- `useHlsSession()` takes no argument (Global Constraints); `HlsPlayerScreen` calls `useHlsSession()` with no argument.
- `playerRef: RefObject<VideoRef | null>` matches `React.useRef<VideoRef>(null)`, which under `@types/react@19.2.17` returns `RefObject<VideoRef | null>` (overload `useRef<T>(initialValue: T | null)`). `<Video ref={playerRef}>` type-checks because `Ref<VideoRef> = RefCallback<VideoRef> | RefObject<VideoRef | null> | null`.
- `HlsErrorEvent`'s index signature `[key: string]: unknown` makes it a supertype of react-native-video v6's `onError` param, so `onError={onError}` type-checks without coupling to v6's exact error type.
- Test IDs are consistent: `hls-url-*` (Task 2), `hls-player-*` / `hls-video` (Task 3), `launcher-hls-action` (Task 4).

No type drift found.

**4. Ambiguity check** - `cleanupAttempt`'s lack of an imperative call is explicit (Global Constraints + Task 3 comments), not ambiguous. The `useHlsSession()` no-arg signature is explicit. The "starting" vs "active" status distinction is observable only transitively (no error + Video present); the tests assert via error absence and Video presence, which is unambiguous.

---
