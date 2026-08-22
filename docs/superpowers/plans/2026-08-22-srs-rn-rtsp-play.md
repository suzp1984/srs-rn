# SRS RN RTSP Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RTSP playback to the SRS RN application, played via libVLC (`react-native-vlc-media-player`), reusing the SRT/DASH/RTMP/FLV/TS media stack. RTSP is a core VLC access module (`modules/access/live555.cpp`), explicitly listed as supported by the library, and requires no external library like libsrt — the lowest-risk protocol addition since DASH.

**Architecture:** A new `features/rtsp/` directory mirrors `features/flv/` and `features/ts/` (VLC `playerRef`, imperative `stopPlayer()` cleanup, `onPlaying`/`onError` per-attempt closures). The only behavioral differences from those features are: (a) `validateRtspUrl` requires the `rtsp:` scheme (and explicitly rejects `rtsps://` with a specific message), (b) the validator additionally requires a non-empty host AND a non-empty path, and (c) `DEFAULT_RTSP_URL` points at the SRS RTSP endpoint on port 554.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-vlc-media-player 1.0.98 (already installed, reused), React Navigation 7, Jest 29 + react-test-renderer 19.

**Spec:** `docs/superpowers/specs/2026-08-22-srs-rn-rtsp-design.md`

## Global Constraints

- App root is `SRSRN/`. Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- `react-native-vlc-media-player` `1.0.98` reused unchanged (dependency, jest mock, type augmentation, `MobileVLCKit` pod, `NSLocalNetworkUsageDescription`, Android `libc++_shared.so` workaround all from SRT, reused by DASH/RTMP/FLV/TS).
- Do NOT modify `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `features/rtmp/`, `features/rtmp_publish/`, `features/flv/`, `features/ts/`, `WHIPPublisher/`, or `WHEPPlayer/`. Only `navigation/types.ts`, `navigation/RootNavigator.tsx`, `launcher/features.ts`, and `__tests__/HomeScreen.test.tsx` are touched outside the new feature directory.
- Use the **named** `VLCPlayer` import: `import {VLCPlayer} from 'react-native-vlc-media-player'` and `import type {VLCPlayer} from 'react-native-vlc-media-player'`. (The package's `index.js` is CommonJS with no default export; the SRT feature's augmentation exports `{VlcPlayer as VLCPlayer}`.)
- Default RTSP URL (verbatim): `rtsp://192.168.1.100:554/live/livestream` (SRS RTSP play endpoint; port 554; app/stream `live`/`livestream`).
- Validator rules: require `rtsp:` scheme (rejects `rtsps://` with the message `'rtsps:// (RTSP over TLS) is not supported'`), require non-empty `hostname`, require non-empty `pathname` (at least `/`). URL-embedded credentials (`rtsp://user:pass@host/path`) are accepted and forwarded unchanged. The `.url` returned on success is the trimmed input.
- No new capture permissions, pods, Info.plist keys, or Gradle config.
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks (React 19 doubles host counts; never assert exact counts).
- Commits land on `feature/srs-rn-unified-app`. Conventional Commits. End with `Co-Authored-By: Claude <noreply@anthropic.com>`. Use `git commit -F - <<'COMMIT_MSG' ... COMMIT_MSG` heredoc.
- `cleanupAttempt` calls `playerRef.current?.stopPlayer()` + sets `attempt.closed = true`. No `AbortController`.
- `useRtspSession()` takes no argument (URL passed to `<VLCPlayer source={{uri: rtspUrl}}>` by the screen).
- libVLC's `onError` payload is `{target}` with no message field; user-visible RTSP errors are generic `'Playback error'`.

---

## File Structure

```text
SRSRN/
├── navigation/types.ts                       # +RtspUrl, +RtspPlayer (Task 1)
├── navigation/RootNavigator.tsx              # +2 Stack.Screen (Task 3)
├── launcher/features.ts                      # +rtsp entry, +RtspUrl in union (Task 3)
├── features/rtsp/                            # new feature directory (Tasks 1-2)
│   ├── validation.ts                         # Task 1
│   ├── RtspUrlScreen.tsx                     # Task 1
│   ├── types.ts                              # Task 2
│   ├── useRtspSession.ts                     # Task 2
│   └── RtspPlayerScreen.tsx                  # Task 2
└── __tests__/
    ├── rtsp-validation.test.ts               # Task 1
    ├── RtspUrlScreen.test.tsx                # Task 1
    ├── RtspPlayerScreen.test.tsx             # Task 2
    └── HomeScreen.test.tsx                   # +1 card assertion, +1 nav test (Task 3)
```

No changes to `package.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/`, or `android/`.

---

### Task 1: RTSP routes, validation, and URL-entry screen

**Files:** Modify `SRSRN/navigation/types.ts`; Create `SRSRN/features/rtsp/validation.ts`, `SRSRN/features/rtsp/RtspUrlScreen.tsx`; Test `SRSRN/__tests__/rtsp-validation.test.ts`, `SRSRN/__tests__/RtspUrlScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Add the RTSP routes to `navigation/types.ts`**

Append to `RootStackParamList` (after `TsPlayer`):

```ts
  TsPlayer: {tsUrl: string};
  RtspUrl: undefined;
  RtspPlayer: {rtspUrl: string};
};
```

- [ ] **Step 2: Write the failing validation test** — Create `SRSRN/__tests__/rtsp-validation.test.ts`:

```ts
import {DEFAULT_RTSP_URL, validateRtspUrl} from '../features/rtsp/validation';

describe('validateRtspUrl', () => {
  it('rejects empty input', () => {
    expect(validateRtspUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateRtspUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateRtspUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateRtspUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects the rtmp scheme', () => {
    expect(validateRtspUrl('rtmp://192.168.1.100:1935/live/livestream')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateRtspUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects rtsps:// (RTSP over TLS) with the specific message', () => {
    expect(validateRtspUrl('rtsps://192.168.1.100:322/live/livestream')).toEqual({
      ok: false,
      message: 'rtsps:// (RTSP over TLS) is not supported',
    });
  });
  it('rejects an rtsp URL with no path', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554')).toEqual({
      ok: false,
      message: 'RTSP URL must include a path (e.g. /live/livestream)',
    });
  });
  it('accepts an rtsp URL with a bare-slash path', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554/')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/',
    });
  });
  it('accepts DEFAULT_RTSP_URL', () => {
    expect(validateRtspUrl(DEFAULT_RTSP_URL)).toEqual({ok: true, url: DEFAULT_RTSP_URL});
  });
  it('accepts a valid rtsp URL with a different host', () => {
    expect(validateRtspUrl('rtsp://10.0.0.5:554/live/stream')).toEqual({
      ok: true,
      url: 'rtsp://10.0.0.5:554/live/stream',
    });
  });
  it('accepts an rtsp URL with URL-embedded credentials', () => {
    expect(validateRtspUrl('rtsp://user:pass@192.168.1.100:554/live/livestream')).toEqual({
      ok: true,
      url: 'rtsp://user:pass@192.168.1.100:554/live/livestream',
    });
  });
  it('accepts an rtsp URL with a query string', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554/live/stream?param=value')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/live/stream?param=value',
    });
  });
  it('accepts an rtsp URL with uppercase scheme (case-insensitive)', () => {
    expect(validateRtspUrl('RTSP://192.168.1.100:554/live/livestream')).toEqual({
      ok: true,
      url: 'RTSP://192.168.1.100:554/live/livestream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateRtspUrl('  rtsp://192.168.1.100:554/live/livestream  ')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/live/livestream',
    });
  });
  it('DEFAULT_RTSP_URL is the SRS RTSP play endpoint', () => {
    expect(DEFAULT_RTSP_URL).toBe('rtsp://192.168.1.100:554/live/livestream');
  });
  it('does not collide with the RTMP or TS defaults', () => {
    expect(DEFAULT_RTSP_URL).not.toBe('rtmp://192.168.1.100:1935/live/livestream');
    expect(DEFAULT_RTSP_URL).not.toBe('http://192.168.1.100:8080/live/livestream.ts');
  });
});
```

- [ ] **Step 3: Run failing** — `cd SRSRN && npm test -- rtsp-validation` — expect FAIL (module not found).
- [ ] **Step 4: Implement `features/rtsp/validation.ts`**:

```ts
export const DEFAULT_RTSP_URL =
  'rtsp://192.168.1.100:554/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateRtspUrl(input: string): ValidationResult {
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
  if (parsed.protocol === 'rtsps:') {
    return {ok: false, message: 'rtsps:// (RTSP over TLS) is not supported'};
  }
  if (parsed.protocol !== 'rtsp:') {
    return {ok: false, message: 'URL must start with rtsp://'};
  }
  if (!parsed.hostname) {
    return {ok: false, message: 'RTSP URL must include a host'};
  }
  if (!parsed.pathname) {
    return {ok: false, message: 'RTSP URL must include a path (e.g. /live/livestream)'};
  }
  return {ok: true, url: trimmed};
}
```

- [ ] **Step 5: Run passing** — `npm test -- rtsp-validation` — expect PASS (16 tests).
- [ ] **Step 6: Write the failing `RtspUrlScreen` test** — Create `SRSRN/__tests__/RtspUrlScreen.test.tsx`:

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {RtspUrlScreen} from '../features/rtsp/RtspUrlScreen';
import {DEFAULT_RTSP_URL} from '../features/rtsp/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtsp-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'RtspUrl-test', name: 'RtspUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtspUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('RtspUrlScreen', () => {
  it('prefills the input with DEFAULT_RTSP_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'rtsp-url-input').props.value).toBe(DEFAULT_RTSP_URL);
  });
  it('navigates to RtspPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtspPlayer', {rtspUrl: DEFAULT_RTSP_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows the rtsps-specific error for an rtsps:// URL and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('rtsps://192.168.1.100:322/live/livestream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(findByTestID(tree.root, 'rtsp-url-error').props.children).toBe('rtsps:// (RTSP over TLS) is not supported');
  });
  it('shows a path-required error for an rtsp URL with no path and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('rtsp://192.168.1.100:554');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'rtsp-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('rtsp://10.0.0.5:554/live/stream');
    });
    expect(input.props.value).toBe('rtsp://10.0.0.5:554/live/stream');
  });
});
```

- [ ] **Step 7: Run failing** — `npm test -- RtspUrlScreen` — expect FAIL.
- [ ] **Step 8: Implement `features/rtsp/RtspUrlScreen.tsx`**:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_RTSP_URL, validateRtspUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'RtspUrl'>;

export function RtspUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_RTSP_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateRtspUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('RtspPlayer', {rtspUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>RTSP server URL</Text>
      <TextInput
        testID="rtsp-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="rtsp-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="rtsp-url-connect" title="Connect" onPress={onConnect} />
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

- [ ] **Step 9: Run passing** — `npm test -- RtspUrlScreen` — expect PASS (6 tests).
- [ ] **Step 10: Commit**

```bash
git add navigation/types.ts features/rtsp/validation.ts features/rtsp/RtspUrlScreen.tsx __tests__/rtsp-validation.test.ts __tests__/RtspUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTSP URL entry screen with preserved default URL

Add the RtspUrl and RtspPlayer routes, validateRtspUrl (syntactic rtsp://
validation with non-empty host and non-empty path required, explicit
rejection of rtsps:// (RTSP over TLS) with a specific message, URL-embedded
credentials accepted), DEFAULT_RTSP_URL pointing at the SRS RTSP play
endpoint (rtsp://192.168.1.100:554/live/livestream), and RtspUrlScreen
which navigates to RtspPlayer with the typed {rtspUrl} parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 2: RTSP session hook and player screen

**Files:** Create `SRSRN/features/rtsp/types.ts`, `SRSRN/features/rtsp/useRtspSession.ts`, `SRSRN/features/rtsp/RtspPlayerScreen.tsx`; Test `SRSRN/__tests__/RtspPlayerScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Write the failing player-screen test** — Create `SRSRN/__tests__/RtspPlayerScreen.test.tsx`. (Mirror `TsPlayerScreen.test.tsx` / `RtmpPlayerScreen.test.tsx` exactly, replacing `ts`/`rtmp`→`rtsp`, `Ts`/`Rtmp`→`Rtsp`, `DEFAULT_TS_URL`/`DEFAULT_RTMP_URL`→`DEFAULT_RTSP_URL`, route name `TsPlayer`/`RtmpPlayer`→`RtspPlayer`, param `tsUrl`/`rtmpUrl`→`rtspUrl`. 9 tests: no-work-before-Start, happy-path onPlaying, duplicate-Start, Stop-during-loading asserts `stopPlayer` called once, unmount-teardown, obsolete-attempt, visible-errors 'Playback error', idempotent-cleanup, failed-start-recovery.)

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {RtspPlayerScreen} from '../features/rtsp/RtspPlayerScreen';
import {DEFAULT_RTSP_URL} from '../features/rtsp/validation';

const vlc = require('react-native-vlc-media-player');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtsp-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtsp-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'RtspPlayer-test',
    name: 'RtspPlayer' as const,
    params: {rtspUrl: DEFAULT_RTSP_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtspPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'rtsp-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'rtsp-player-stop').props.onPress();
  });
}

describe('RtspPlayerScreen - no work before Start', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('renders no VLCPlayer and creates no player instance before Start', () => {
    const tree = render();
    expect(vlc.__mockVlcInstances.length).toBe(0);
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('RtspPlayerScreen - happy path', () => {
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

describe('RtspPlayerScreen - duplicate Start', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('creates only one VLCPlayer when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'rtsp-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(vlc.__mockVlcInstances.length).toBe(1);
  });
});

describe('RtspPlayerScreen - cancellation during each stage', () => {
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
    expect(tree.root.findAllByProps({testID: 'rtsp-player-start'}).length).toBeGreaterThan(0);
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

describe('RtspPlayerScreen - obsolete attempt isolation', () => {
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

describe('RtspPlayerScreen - visible errors', () => {
  beforeEach(() => { jest.clearAllMocks(); vlc.__resetVlcMocks(); });
  it('an onError event shows a generic user-visible error and unmounts the VLCPlayer', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    expect(findByTestID(tree.root, 'rtsp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('RtspPlayerScreen - idempotent cleanup and recovery', () => {
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
    expect(findByTestID(tree.root, 'rtsp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtsp-player-start'}).length).toBeGreaterThan(0);
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

- [ ] **Step 2: Run failing** — `npm test -- RtspPlayerScreen` — expect FAIL.
- [ ] **Step 3: Implement `features/rtsp/types.ts`**:

```ts
import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type RtspSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type RtspErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseRtspSessionResult = {
  status: RtspSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: RtspErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 4: Implement `features/rtsp/useRtspSession.ts`** (mirror `useTsSession` with `Ts`→`Rtsp`):

```ts
import React from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';
import type {RtspErrorEvent, RtspSessionStatus, UseRtspSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onPlaying: () => void;
  onError: (event: RtspErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: RtspErrorEvent) => {};

// Mirrors useFlvSession/useTsSession (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) on
// the same libVLC media stack. Because VLCPlayer exposes an imperative
// stopPlayer() ref method, cleanupAttempt performs a TRUE imperative stop.
// There is no PeerConnection, MediaStream, fetch, or AbortController; libVLC
// performs the RTSP handshake and pulls the RTP stream internally, and late
// onPlaying/onError from an obsolete attempt are dropped by the
// isCurrent(attempt) guard captured in the per-attempt closures stored in
// `handlers` state.
export function useRtspSession(): UseRtspSessionResult {
  const [status, setStatus] = React.useState<RtspSessionStatus>('idle');
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
      onError: (_event: RtspErrorEvent) => {
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

- [ ] **Step 5: Implement `features/rtsp/RtspPlayerScreen.tsx`**:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useRtspSession} from './useRtspSession';

type Props = NativeStackScreenProps<RootStackParamList, 'RtspPlayer'>;

export function RtspPlayerScreen({route}: Props): React.JSX.Element {
  const {rtspUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useRtspSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="rtsp-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="rtsp-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="rtsp-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="rtsp-video"
            ref={playerRef}
            source={{uri: rtspUrl}}
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

- [ ] **Step 6: Run passing** — `npm test -- RtspPlayerScreen` — expect PASS (9 tests). The "Stop during loading" test asserts `instanceA.stopPlayer` called exactly once.
- [ ] **Step 7: Full suite** — `cd SRSRN && npx tsc --noEmit && npm run lint && npm test` — expect tsc clean, lint 0 problems, all green.
- [ ] **Step 8: Commit**

```bash
git add features/rtsp/types.ts features/rtsp/useRtspSession.ts features/rtsp/RtspPlayerScreen.tsx __tests__/RtspPlayerScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTSP player with generation-guarded session and explicit Start

useRtspSession mirrors useFlvSession/useTsSession (explicit Start, attemptRef
+ isCurrent guard, idempotent cleanupAttempt via a closed flag, unmount
teardown) on the same react-native-vlc-media-player <VLCPlayer> media stack.
Because VLCPlayer exposes stopPlayer(), cleanupAttempt performs a true
imperative stop. The attempt is {id, closed} with per-attempt
onPlaying/onError closures; libVLC performs the RTSP DESCRIBE/SETUP/PLAY
handshake and pulls the RTP stream (no AbortController), and late events are
dropped by isCurrent. onPlaying -> 'active'; onError -> 'error' with a
generic 'Playback error' (libVLC's onError has no message field).
RtspPlayerScreen renders <VLCPlayer source={{uri: rtspUrl}}> bound to the
hook's playerRef and callbacks. Reuses the SRT feature's VLC dependency,
jest mock, type augmentation, MobileVLCKit pod, NSLocalNetworkUsageDescription,
and Android libc++_shared.so workaround - no new native config.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: Launcher entry, navigator wiring, and Home screen test update

**Files:** Modify `SRSRN/launcher/features.ts`, `SRSRN/navigation/RootNavigator.tsx`, `SRSRN/__tests__/HomeScreen.test.tsx`.

**Steps:**

- [ ] **Step 1: Update `launcher/features.ts`** — add `'RtspUrl'` to the `LauncherDestination` union, and append the rtsp entry after ts:

```ts
export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl' | 'HlsUrl' | 'SrtUrl' | 'DashUrl' | 'RtmpUrl' | 'RtmpPublishUrl' | 'FlvUrl' | 'TsUrl' | 'RtspUrl'
>;
```

```ts
  {
    id: 'ts',
    title: 'HTTP-TS Play',
    description: 'Play an HTTP-TS (MPEG-TS) stream from an SRS server via VLC.',
    actionLabel: 'Open HTTP-TS',
    color: '#15803d',
    destination: 'TsUrl',
  },
  {
    id: 'rtsp',
    title: 'RTSP Play',
    description: 'Play an RTSP stream from an SRS server via VLC.',
    actionLabel: 'Open RTSP',
    color: '#475569',
    destination: 'RtspUrl',
  },
];
```

- [ ] **Step 2: Update `navigation/RootNavigator.tsx`** — add imports and 2 Stack.Screen entries:

```tsx
import {TsUrlScreen} from '../features/ts/TsUrlScreen';
import {TsPlayerScreen} from '../features/ts/TsPlayerScreen';
import {RtspUrlScreen} from '../features/rtsp/RtspUrlScreen';
import {RtspPlayerScreen} from '../features/rtsp/RtspPlayerScreen';
```

```tsx
        <Stack.Screen name="TsUrl" component={TsUrlScreen} options={{title: 'HTTP-TS URL'}} />
        <Stack.Screen name="TsPlayer" component={TsPlayerScreen} options={{title: 'HTTP-TS Player'}} />
        <Stack.Screen name="RtspUrl" component={RtspUrlScreen} options={{title: 'RTSP URL'}} />
        <Stack.Screen name="RtspPlayer" component={RtspPlayerScreen} options={{title: 'RTSP Player'}} />
```

- [ ] **Step 3: Update `__tests__/HomeScreen.test.tsx`** — two edits:
  - (A) Add `expect(tree.root.findAllByProps({testID: 'launcher-rtsp-action'}).length).toBeGreaterThan(0);` to the "renders a card for each launcher feature from the default config" test (after the ts assertion on the line ending with `launcher-ts-action`).
  - (B) Add a navigation test after the TsUrl nav test:
    ```ts
      it('navigates to RtspUrl when the RTSP card action is pressed', () => {
        const {tree, navigate} = render();
        ReactTestRenderer.act(() => {
          findByTestID(tree.root, 'launcher-rtsp-action').props.onPress();
        });
        expect(navigate).toHaveBeenCalledWith('RtspUrl');
      });
    ```
  - (Note: the existing synthetic "additional launcher entry" test already uses `id: 'future_proto'`, which does not collide with `rtsp`, so no rename is needed.)

- [ ] **Step 4: Run Home + App tests** — `npm test -- HomeScreen App` — expect PASS.
- [ ] **Step 5: tsc + lint** — `npx tsc --noEmit && npm run lint` — expect no errors.
- [ ] **Step 6: Commit**

```bash
git add launcher/features.ts navigation/RootNavigator.tsx __tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire RTSP launcher entry and routes into the navigator

Add the RTSP Play card to LAUNCHER_FEATURES (destination RtspUrl, slate
#475569), register the RtspUrl and RtspPlayer Stack.Screen entries, and
extend the Home screen tests to assert the real RTSP card renders and
navigates. HomeScreen layout logic is unchanged. The existing synthetic
"additional entry" test's id (future_proto) does not collide with rtsp, so
no rename is needed.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 4: Final verification

- [ ] **Step 1: Full suite** — `cd SRSRN && npx tsc --noEmit && npm run lint && npm test` — expect all green (existing + new `rtsp-validation`, `RtspUrlScreen`, `RtspPlayerScreen` suites).
- [ ] **Step 2: Verify no new native config** — `git log <prev>..HEAD -- package.json package-lock.json ios/Podfile.lock ios/SRSRN/Info.plist android/app/build.gradle jest.setup.js types/react-native-vlc-media-player.d.ts` — expect empty (RTSP added zero native config).
- [ ] **Step 3: `pod install`** — should be a no-op (no Podfile change). `pod install --project-directory=ios`.
- [ ] **Step 4: iOS build** — `xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO` — expect BUILD SUCCEEDED (fall back to simulator if signing fails; record which SDK).
- [ ] **Step 5: Android Gradle** — `./gradlew -p android :app:tasks --console=plain` — expect BUILD SUCCESSFUL.
- [ ] **Step 6: Report device gate** — RTSP must be played on a device (`rtsp://192.168.1.100:554/live/livestream`) to confirm libVLC's RTSP pipeline negotiates and decodes SRS's output. Do not claim verified unless observed.
- [ ] **Step 7: Update SDD ledger** — `.superpowers/sdd/2026-08-22-srs-rn-rtsp-play/progress.md` with results.

---

## Self-Review

- **Spec coverage:** every spec section maps to a task (Objective/scope → all; Media Stack viability → Global Constraints + Task 4 gate; Launcher/Navigation → Task 3; Playback Flow/Session Lifecycle/Attempt/Cleanup → Task 2; Error Handling → Task 1 validation + Task 2 onError; Native Config (none new) → Global Constraints + Task 4 Step 2; URL Entry & Validation → Task 1; Testing → Tasks 1-3; Verification → Task 4). The spec's RTSP-specific validator rules (rtsps:// rejection with specific message, required host, required path, URL-embedded credentials accepted, case-insensitive scheme) are all in Task 1 Step 4 with the matching tests in Step 2.
- **Placeholder scan:** no TBD/TODO; every step has concrete code or a concrete command.
- **Type consistency:** `DEFAULT_RTSP_URL`/`validateRtspUrl`/`ValidationResult` (Task 1) consumed by `RtspUrlScreen` (Task 1) and `RtspPlayerScreen.test.tsx` (Task 2). `RtspSessionStatus`/`RtspErrorEvent`/`UseRtspSessionResult` (Task 2 types.ts) consumed by `useRtspSession` (Task 2). `useRtspSession()` no-arg; `RtspPlayerScreen` calls it no-arg. `playerRef: RefObject<VLCPlayer | null>` matches `React.useRef<VLCPlayer>(null)`. `RtspErrorEvent` is a supertype of libVLC's `{target}` payload. Test IDs consistent: `rtsp-url-*` (Task 1), `rtsp-player-*`/`rtsp-video` (Task 2), `launcher-rtsp-action` (Task 3); synthetic extra uses `launcher-future_proto-action` (already non-colliding).
- **Reuse verification:** no changes to `package.json`, `jest.setup.js`, `types/react-native-vlc-media-player.d.ts`, `ios/`, or `android/`. Task 4 Step 2 verifies with `git diff`.
- **Naming consistency:** the new routes are `RtspUrl` / `RtspPlayer` (matching `HlsUrl` / `HlsPlayer` / `SrtUrl` / `SrtPlayer` / `DashUrl` / `DashPlayer` / `RtmpUrl` / `RtmpPlayer` / `FlvUrl` / `FlvPlayer` / `TsUrl` / `TsPlayer`). The new file names are `RtspUrlScreen.tsx` / `RtspPlayerScreen.tsx` / `useRtspSession.ts` / `validation.ts` / `types.ts` (mirroring the existing features). The `LauncherDestination` Extract union is updated to include `'RtspUrl'`. The Home screen test's synthetic-extra collision check is explicitly noted as not requiring a rename.
