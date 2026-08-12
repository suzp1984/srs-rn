# SRS RN RTMP Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RTMP playback as a sixth protocol feature, played via libVLC (`react-native-vlc-media-player`), reusing the SRT/DASH media stack. RTMP is explicitly listed by the library and is a core VLC access module - the lowest-risk protocol addition yet.

**Architecture:** A new `features/rtmp/` directory mirrors `features/dash/` (VLC `playerRef`, imperative `stopPlayer()` cleanup, `onPlaying`/`onError` per-attempt closures). The only behavioral difference from DASH is the URL scheme: `validateRtmpUrl` requires `rtmp:` (like SRT requires `srt:`), and `DEFAULT_RTMP_URL` points at the SRS RTMP endpoint on port 1935.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-vlc-media-player 1.0.98 (already installed, reused), React Navigation 7, Jest 29 + react-test-renderer 19.

## Global Constraints

- App root is `SRSRN/`. Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- `react-native-vlc-media-player` `1.0.98` reused unchanged (dependency, jest mock, type augmentation, `MobileVLCKit` pod, `NSLocalNetworkUsageDescription`, Android `libc++_shared.so` workaround all from SRT).
- Do NOT modify `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `WHIPPublisher/`, or `WHEPPlayer/`. The only exception is `SRSRN/__tests__/HomeScreen.test.tsx` (Task 3): rename the synthetic extra launcher entry from `id: 'rtmp'` to `id: 'flv'` (it currently uses `rtmp`, which the real RTMP entry this feature adds would collide with).
- Use the **named** `VLCPlayer` import: `import {VLCPlayer} from 'react-native-vlc-media-player'` and `import type {VLCPlayer} from 'react-native-vlc-media-player'`. (The package's `index.js` is CommonJS with no default export; the SRT feature's augmentation exports `{VlcPlayer as VLCPlayer}`.)
- Default RTMP URL (verbatim): `rtmp://192.168.1.100:1935/live/livestream` (SRS RTMP play endpoint; port 1935; app/stream `live`/`livestream`).
- No new capture permissions, pods, or Gradle config.
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks (React 19 doubles host counts; never assert exact counts).
- Commits land on `feature/srs-rn-unified-app`. Conventional Commits. End with `Co-Authored-By: Claude <noreply@anthropic.com>`. Use `git commit -F - <<'COMMIT_MSG' ... COMMIT_MSG` heredoc.
- `cleanupAttempt` calls `playerRef.current?.stopPlayer()` + sets `attempt.closed = true`. No `AbortController`.
- `useRtmpSession()` takes no argument (URL passed to `<VLCPlayer source={{uri: rtmpUrl}}>` by the screen).
- libVLC's `onError` payload is `{target}` with no message field; user-visible RTMP errors are generic `'Playback error'`.

---

## File Structure

```text
SRSRN/
├── navigation/types.ts                       # +RtmpUrl, +RtmpPlayer (Task 1)
├── navigation/RootNavigator.tsx              # +2 Stack.Screen (Task 3)
├── launcher/features.ts                      # +rtmp entry, +RtmpUrl in union (Task 3)
├── features/rtmp/                            # new feature directory (Tasks 1-2)
│   ├── validation.ts                         # Task 1
│   ├── RtmpUrlScreen.tsx                      # Task 1
│   ├── types.ts                              # Task 2
│   ├── useRtmpSession.ts                     # Task 2
│   └── RtmpPlayerScreen.tsx                  # Task 2
└── __tests__/
    ├── rtmp-validation.test.ts               # Task 1
    ├── RtmpUrlScreen.test.tsx                # Task 1
    ├── RtmpPlayerScreen.test.tsx             # Task 2
    └── HomeScreen.test.tsx                   # rename synthetic extra rtmp->flv (Task 3)
```

No changes to `package.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/`, or `android/`.

---

### Task 1: RTMP routes, validation, and URL-entry screen

**Files:** Modify `SRSRN/navigation/types.ts`; Create `SRSRN/features/rtmp/validation.ts`, `SRSRN/features/rtmp/RtmpUrlScreen.tsx`; Test `SRSRN/__tests__/rtmp-validation.test.ts`, `SRSRN/__tests__/RtmpUrlScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Add the RTMP routes to `navigation/types.ts`**

Append to `RootStackParamList` (after `DashPlayer`):

```ts
  DashPlayer: {dashUrl: string};
  RtmpUrl: undefined;
  RtmpPlayer: {rtmpUrl: string};
};
```

- [ ] **Step 2: Write the failing validation test** — Create `SRSRN/__tests__/rtmp-validation.test.ts`:

```ts
import {DEFAULT_RTMP_URL, validateRtmpUrl} from '../features/rtmp/validation';

describe('validateRtmpUrl', () => {
  it('rejects empty input', () => {
    expect(validateRtmpUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateRtmpUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateRtmpUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateRtmpUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateRtmpUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('accepts DEFAULT_RTMP_URL', () => {
    expect(validateRtmpUrl(DEFAULT_RTMP_URL)).toEqual({ok: true, url: DEFAULT_RTMP_URL});
  });
  it('accepts a valid rtmp URL with a different host', () => {
    expect(validateRtmpUrl('rtmp://10.0.0.5:1935/live/stream')).toEqual({
      ok: true,
      url: 'rtmp://10.0.0.5:1935/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateRtmpUrl('  rtmp://192.168.1.100:1935/live/livestream  ')).toEqual({
      ok: true,
      url: 'rtmp://192.168.1.100:1935/live/livestream',
    });
  });
  it('DEFAULT_RTMP_URL is the SRS RTMP play endpoint', () => {
    expect(DEFAULT_RTMP_URL).toBe('rtmp://192.168.1.100:1935/live/livestream');
  });
  it('does not collide with the SRT default', () => {
    expect(DEFAULT_RTMP_URL).not.toBe('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request');
  });
});
```

- [ ] **Step 3: Run failing** — `cd SRSRN && npm test -- rtmp-validation` — expect FAIL (module not found).
- [ ] **Step 4: Implement `features/rtmp/validation.ts`**:

```ts
export const DEFAULT_RTMP_URL =
  'rtmp://192.168.1.100:1935/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateRtmpUrl(input: string): ValidationResult {
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
  if (parsed.protocol !== 'rtmp:') {
    return {ok: false, message: 'URL must start with rtmp://'};
  }
  return {ok: true, url: trimmed};
}
```

- [ ] **Step 5: Run passing** — `npm test -- rtmp-validation` — expect PASS (10 tests).
- [ ] **Step 6: Write the failing `RtmpUrlScreen` test** — Create `SRSRN/__tests__/RtmpUrlScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {RtmpUrlScreen} from '../features/rtmp/RtmpUrlScreen';
import {DEFAULT_RTMP_URL} from '../features/rtmp/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'RtmpUrl-test', name: 'RtmpUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtmpUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('RtmpUrlScreen', () => {
  it('prefills the input with DEFAULT_RTMP_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'rtmp-url-input').props.value).toBe(DEFAULT_RTMP_URL);
  });
  it('navigates to RtmpPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtmpPlayer', {rtmpUrl: DEFAULT_RTMP_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for http URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-url-input').props.onChangeText('http://example.com/stream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'rtmp-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('rtmp://10.0.0.5:1935/live/stream');
    });
    expect(input.props.value).toBe('rtmp://10.0.0.5:1935/live/stream');
  });
});
```

- [ ] **Step 7: Run failing** — `npm test -- RtmpUrlScreen` — expect FAIL.
- [ ] **Step 8: Implement `features/rtmp/RtmpUrlScreen.tsx`**:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_RTMP_URL, validateRtmpUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'RtmpUrl'>;

export function RtmpUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_RTMP_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateRtmpUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('RtmpPlayer', {rtmpUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>RTMP server URL</Text>
      <TextInput
        testID="rtmp-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="rtmp-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="rtmp-url-connect" title="Connect" onPress={onConnect} />
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

- [ ] **Step 9: Run passing** — `npm test -- RtmpUrlScreen` — expect PASS (5 tests).
- [ ] **Step 10: Commit**

```bash
git add navigation/types.ts features/rtmp/validation.ts features/rtmp/RtmpUrlScreen.tsx __tests__/rtmp-validation.test.ts __tests__/RtmpUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTMP URL entry screen with preserved default URL

Add the RtmpUrl and RtmpPlayer routes, validateRtmpUrl (syntactic rtmp://
validation, mirroring SRT), DEFAULT_RTMP_URL pointing at the SRS RTMP play
endpoint (rtmp://192.168.1.100:1935/live/livestream), and RtmpUrlScreen which
navigates to RtmpPlayer with the typed {rtmpUrl} parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 2: RTMP session hook and player screen

**Files:** Create `SRSRN/features/rtmp/types.ts`, `SRSRN/features/rtmp/useRtmpSession.ts`, `SRSRN/features/rtmp/RtmpPlayerScreen.tsx`; Test `SRSRN/__tests__/RtmpPlayerScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Write the failing player-screen test** — Create `SRSRN/__tests__/RtmpPlayerScreen.test.tsx`. (Mirror `DashPlayerScreen.test.tsx` exactly, replacing `dash`→`rtmp`, `Dash`→`Rtmp`, `DEFAULT_DASH_URL`→`DEFAULT_RTMP_URL`, route name `DashPlayer`→`RtmpPlayer`, param `dashUrl`→`rtmpUrl`. 9 tests: no-work-before-Start, happy-path onPlaying, duplicate-Start, Stop-during-loading asserts `stopPlayer` called once, unmount-teardown, obsolete-attempt, visible-errors 'Playback error', idempotent-cleanup, failed-start-recovery.)

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {RtmpPlayerScreen} from '../features/rtmp/RtmpPlayerScreen';
import {DEFAULT_RTMP_URL} from '../features/rtmp/validation';

const vlc = require('react-native-vlc-media-player');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'RtmpPlayer-test',
    name: 'RtmpPlayer' as const,
    params: {rtmpUrl: DEFAULT_RTMP_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtmpPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'rtmp-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'rtmp-player-stop').props.onPress();
  });
}

describe('RtmpPlayerScreen - no work before Start', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('renders no VLCPlayer and creates no player instance before Start', () => {
    const tree = render();
    expect(vlc.__mockVlcInstances.length).toBe(0);
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('RtmpPlayerScreen - happy path', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
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

describe('RtmpPlayerScreen - duplicate Start', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('creates only one VLCPlayer when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'rtmp-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(vlc.__mockVlcInstances.length).toBe(1);
  });
});

describe('RtmpPlayerScreen - cancellation during each stage', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('Stop during loading calls stopPlayer, unmounts the VLCPlayer, and leaves no session', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = vlc.__mockVlcInstances[0];
    pressStop(tree);
    expect(instanceA.stopPlayer).toHaveBeenCalledTimes(1);
    expect(hasVideo(tree.root)).toBe(false);
    ReactTestRenderer.act(() => {
      instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-player-start'}).length).toBeGreaterThan(0);
  });
  it('unmount tears down any active session without throwing on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = vlc.__mockVlcInstances[0];
    ReactTestRenderer.act(() => { tree.unmount(); });
    expect(() => {
      ReactTestRenderer.act(() => instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true}));
    }).not.toThrow();
  });
});

describe('RtmpPlayerScreen - obsolete attempt isolation', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('a stale attempt late-arriving onPlaying/onError does not update the UI or disturb the newer attempt', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = vlc.__mockVlcInstances[0];
    pressStop(tree);
    await pressStart(tree);
    const instanceB = vlc.__mockVlcInstances[1];
    ReactTestRenderer.act(() => {
      instanceA.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    ReactTestRenderer.act(() => {
      instanceA.__fireOnError({target: 0});
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasVideo(tree.root)).toBe(true);
    ReactTestRenderer.act(() => {
      instanceB.__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasVideo(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});

describe('RtmpPlayerScreen - visible errors', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('an onError event shows a generic user-visible error and unmounts the VLCPlayer', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    expect(findByTestID(tree.root, 'rtmp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('RtmpPlayerScreen - idempotent cleanup and recovery', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('Stop then unmount is idempotent: no double-cleanup, no throw on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instance = vlc.__mockVlcInstances[0];
    pressStop(tree);
    expect(instance.stopPlayer).toHaveBeenCalledTimes(1);
    expect(() => { ReactTestRenderer.act(() => tree.unmount()); }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnPlaying({duration: 0, target: 0, seekable: true}));
    }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnError({target: 0}));
    }).not.toThrow();
  });
  it('a failed start leaves the screen ready for a fresh Start', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    expect(findByTestID(tree.root, 'rtmp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-player-start'}).length).toBeGreaterThan(0);
    await pressStart(tree);
    expect(hasVideo(tree.root)).toBe(true);
    expect(vlc.__mockVlcInstances.length).toBe(2);
    expect(hasError(tree.root)).toBe(false);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[1].__fireOnPlaying({duration: 0, target: 0, seekable: true});
    });
    expect(hasVideo(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing** — `npm test -- RtmpPlayerScreen` — expect FAIL.
- [ ] **Step 3: Implement `features/rtmp/types.ts`**:

```ts
import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type RtmpSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type RtmpErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseRtmpSessionResult = {
  status: RtmpSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: RtmpErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 4: Implement `features/rtmp/useRtmpSession.ts`** (mirror `useDashSession` with `Dash`→`Rtmp`):

```ts
import React from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';
import type {RtmpErrorEvent, RtmpSessionStatus, UseRtmpSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onPlaying: () => void;
  onError: (event: RtmpErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: RtmpErrorEvent) => {};

// Mirrors useDashSession/useSrtSession (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) on the
// same libVLC media stack. Because VLCPlayer exposes an imperative
// stopPlayer() ref method, cleanupAttempt performs a TRUE imperative stop.
// There is no PeerConnection, MediaStream, fetch, or AbortController; libVLC
// performs the RTMP handshake and pulls the stream internally, and late
// onPlaying/onError from an obsolete attempt are dropped by the
// isCurrent(attempt) guard captured in the per-attempt closures stored in
// `handlers` state.
export function useRtmpSession(): UseRtmpSessionResult {
  const [status, setStatus] = React.useState<RtmpSessionStatus>('idle');
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

    const attemptHandlers: Handlers = {
      onPlaying: () => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onError: (_event: RtmpErrorEvent) => {
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

- [ ] **Step 5: Implement `features/rtmp/RtmpPlayerScreen.tsx`**:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useRtmpSession} from './useRtmpSession';

type Props = NativeStackScreenProps<RootStackParamList, 'RtmpPlayer'>;

export function RtmpPlayerScreen({route}: Props): React.JSX.Element {
  const {rtmpUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useRtmpSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="rtmp-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="rtmp-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="rtmp-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="rtmp-video"
            ref={playerRef}
            source={{uri: rtmpUrl}}
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

- [ ] **Step 6: Run passing** — `npm test -- RtmpPlayerScreen` — expect PASS (9 tests). The "Stop during loading" test asserts `instanceA.stopPlayer` called exactly once.
- [ ] **Step 7: Full suite** — `cd SRSRN && npx tsc --noEmit && npm run lint && npm test` — expect tsc clean, lint 0 problems, all green.
- [ ] **Step 8: Commit**

```bash
git add features/rtmp/types.ts features/rtmp/useRtmpSession.ts features/rtmp/RtmpPlayerScreen.tsx __tests__/RtmpPlayerScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTMP player with generation-guarded session and explicit Start

useRtmpSession mirrors useDashSession/useSrtSession (explicit Start,
attemptRef + isCurrent guard, idempotent cleanupAttempt via a closed flag,
unmount teardown) on the same react-native-vlc-media-player <VLCPlayer> media
stack. Because VLCPlayer exposes stopPlayer(), cleanupAttempt performs a true
imperative stop. The attempt is {id, closed} with per-attempt onPlaying/onError
closures; libVLC performs the RTMP handshake and pulls the stream (no
AbortController), and late events are dropped by isCurrent. onPlaying ->
'active'; onError -> 'error' with a generic 'Playback error' (libVLC's
onError has no message field). RtmpPlayerScreen renders <VLCPlayer
source={{uri: rtmpUrl}}> bound to the hook's playerRef and callbacks. Reuses
the SRT feature's VLC dependency, jest mock, type augmentation, MobileVLCKit
pod, and Android libc++_shared.so workaround - no new native config.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: Launcher entry, navigator wiring, and Home screen test update

**Files:** Modify `SRSRN/launcher/features.ts`, `SRSRN/navigation/RootNavigator.tsx`, `SRSRN/__tests__/HomeScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Update `launcher/features.ts`** — add `'RtmpUrl'` to the `LauncherDestination` union, and append the rtmp entry after dash:

```ts
export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl' | 'HlsUrl' | 'SrtUrl' | 'DashUrl' | 'RtmpUrl'
>;
```

```ts
  {
    id: 'dash',
    title: 'DASH Play',
    description: 'Play a DASH stream from an SRS server via VLC.',
    actionLabel: 'Open DASH',
    color: '#0e7490',
    destination: 'DashUrl',
  },
  {
    id: 'rtmp',
    title: 'RTMP Play',
    description: 'Play an RTMP stream from an SRS server via VLC.',
    actionLabel: 'Open RTMP',
    color: '#be185d',
    destination: 'RtmpUrl',
  },
];
```

- [ ] **Step 2: Update `navigation/RootNavigator.tsx`** — add imports and 2 Stack.Screen entries:

```tsx
import {DashUrlScreen} from '../features/dash/DashUrlScreen';
import {DashPlayerScreen} from '../features/dash/DashPlayerScreen';
import {RtmpUrlScreen} from '../features/rtmp/RtmpUrlScreen';
import {RtmpPlayerScreen} from '../features/rtmp/RtmpPlayerScreen';
```

```tsx
        <Stack.Screen name="DashUrl" component={DashUrlScreen} options={{title: 'DASH URL'}} />
        <Stack.Screen name="DashPlayer" component={DashPlayerScreen} options={{title: 'DASH Player'}} />
        <Stack.Screen name="RtmpUrl" component={RtmpUrlScreen} options={{title: 'RTMP URL'}} />
        <Stack.Screen name="RtmpPlayer" component={RtmpPlayerScreen} options={{title: 'RTMP Player'}} />
```

- [ ] **Step 3: Update `__tests__/HomeScreen.test.tsx`** — three edits:
  - (A) Add `expect(tree.root.findAllByProps({testID: 'launcher-rtmp-action'}).length).toBeGreaterThan(0);` to the "renders a card for each" test (after the dash assertion).
  - (B) Add a navigation test after the DASH nav test:
    ```ts
      it('navigates to RtmpUrl when the RTMP card action is pressed', () => {
        const {tree, navigate} = render();
        ReactTestRenderer.act(() => {
          findByTestID(tree.root, 'launcher-rtmp-action').props.onPress();
        });
        expect(navigate).toHaveBeenCalledWith('RtmpUrl');
      });
    ```
  - (C) Rename the synthetic extra from `id: 'rtmp'` to `id: 'flv'` (real `rtmp` now exists), updating `title`→`'HTTP-FLV Play'`, `actionLabel`→`'Open FLV'`, and the assertion testID `launcher-rtmp-action`→`launcher-flv-action`.

- [ ] **Step 4: Run Home + App tests** — `npm test -- HomeScreen App` — expect PASS.
- [ ] **Step 5: tsc + lint** — `npx tsc --noEmit && npm run lint` — expect no errors.
- [ ] **Step 6: Commit**

```bash
git add launcher/features.ts navigation/RootNavigator.tsx __tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire RTMP launcher entry and routes into the navigator

Add the RTMP Play card to LAUNCHER_FEATURES (destination RtmpUrl, magenta
#be185d), register the RtmpUrl and RtmpPlayer Stack.Screen entries, and
extend the Home screen tests to assert the real RTMP card renders and
navigates. Rename the synthetic "additional entry" test's id from rtmp to
flv so it no longer collides with the real rtmp entry. HomeScreen layout
logic is unchanged.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 4: Final verification

- [ ] **Step 1: Full suite** — `cd SRSRN && npx tsc --noEmit && npm run lint && npm test` — expect all green (existing + new `rtmp-validation`, `RtmpUrlScreen`, `RtmpPlayerScreen` suites).
- [ ] **Step 2: Verify no new native config** — `git log <prev>..HEAD -- package.json package-lock.json ios/Podfile.lock ios/SRSRN/Info.plist android/app/build.gradle jest.setup.js types/react-native-vlc-media-player.d.ts` — expect empty (RTMP added zero native config).
- [ ] **Step 3: `pod install`** — should be a no-op (no Podfile change). `pod install --project-directory=ios`.
- [ ] **Step 4: iOS build** — `xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO` — expect BUILD SUCCEEDED (fall back to simulator if signing fails; record which SDK).
- [ ] **Step 5: Android Gradle** — `./gradlew -p android :app:tasks --console=plain` — expect BUILD SUCCESSFUL.
- [ ] **Step 6: Report device gate** — RTMP must be played on a device (`rtmp://192.168.1.100:1935/live/livestream`) to confirm libVLC's RTMP handshake works against SRS. Do not claim verified unless observed.
- [ ] **Step 7: Update SDD ledger** — `.superpowers/sdd/2026-08-12-srs-rn-rtmp-play/progress.md` with results.

---

## Self-Review

- **Spec coverage:** every spec section maps to a task (Objective/scope → all; Media Stack viability → Global Constraints + Task 4 gate; Launcher/Navigation → Task 3; Playback Flow/Session Lifecycle/Attempt/Cleanup → Task 2; Error Handling → Task 1 validation + Task 2 onError; Native Config (none new) → Global Constraints + Task 4 Step 2; URL Entry & Validation → Task 1; Testing → Tasks 1-3; Verification → Task 4).
- **Placeholder scan:** no TBD/TODO; every step has concrete code or a concrete command.
- **Type consistency:** `DEFAULT_RTMP_URL`/`validateRtmpUrl`/`ValidationResult` (Task 1) consumed by `RtmpUrlScreen` (Task 1) and `RtmpPlayerScreen.test.tsx` (Task 2). `RtmpSessionStatus`/`RtmpErrorEvent`/`UseRtmpSessionResult` (Task 2 types.ts) consumed by `useRtmpSession` (Task 2). `useRtmpSession()` no-arg; `RtmpPlayerScreen` calls it no-arg. `playerRef: RefObject<VLCPlayer | null>` matches `React.useRef<VLCPlayer>(null)`. `RtmpErrorEvent` is a supertype of libVLC's `{target}` payload. Test IDs consistent: `rtmp-url-*` (Task 1), `rtmp-player-*`/`rtmp-video` (Task 2), `launcher-rtmp-action` (Task 3); synthetic extra uses `launcher-flv-action` (non-colliding).
- **Reuse verification:** no changes to `package.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/`, or `android/`. Task 4 Step 2 verifies with `git diff`.
