# SRS RN RTMP Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add RTMP publish (camera+mic -> SRS via RTMP) as a seventh protocol feature using `react-native-rtmp-publisher` 0.4.7 (wraps HaishinKit 1.2.7). **Experimental** - the package is unmaintained/legacy-bridge but BUILDS on RN 0.86 (verified). Device verification is the gate.

**Architecture:** A new `features/rtmp_publish/` directory mirrors the WHIP publisher (generation-guarded lifecycle) and the play features (TDD structure). The `<RTMPPublisher>` component (forwardRef) is mounted on Start; `startStream()` is called via a `useEffect` after mount; connection callbacks drive status; `stopStream()` is the imperative cleanup.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-rtmp-publisher 0.4.7 (new, exact - ships its own types), React Navigation 7, Jest 29 + react-test-renderer 19.

## Global Constraints

- App root is `SRSRN/`. Run every command inside `SRSRN/`.
- Node `>=22.11.0`.
- `react-native-rtmp-publisher` pinned to `0.4.7` **exact** (no caret) - it is unmaintained; a caret would float to nothing (no newer release). Already installed + pod-installed; HaishinKit 1.2.7 in `Podfile.lock`.
- The package ships TypeScript types (`lib/typescript/index.d.ts`); **no local type augmentation** is needed (unlike SRT's VLC).
- Do NOT modify `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `features/rtmp/` (play), `WHIPPublisher/`, or `WHEPPlayer/`. The only exception is `SRSRN/__tests__/HomeScreen.test.tsx` (Task 4): rename the synthetic extra launcher entry to a non-colliding id.
- Use the default import `import RTMPPublisher from 'react-native-rtmp-publisher'` (the package's `src/index.tsx` is `export { default } from './RTMPPublisher'`; CommonJS build has a default export).
- Default RTMP publish URL (verbatim): `rtmp://192.168.1.100:1935/live/livestream` (SRS RTMP ingest endpoint; same form as RTMP play).
- The screen splits the URL into `streamURL` (before last `/`) and `streamName` (last segment) for `<RTMPPublisher>`.
- `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` already exist (WHIP). No new permission keys.
- Tests use `react-test-renderer` + `ReactTestRenderer.act`. Use `findAllByProps({testID}).length > 0` for existence checks (React 19 doubles host counts).
- Commits on `feature/srs-rn-unified-app`. Conventional Commits. End with `Co-Authored-By: Claude <noreply@anthropic.com>`. Heredoc commit messages.
- `cleanupAttempt` calls `publisherRef.current?.stopStream()` + sets `attempt.closed = true`. The `useEffect` teardown on unmount also calls cleanup. `startStream()` is called from a `useEffect` keyed on `[status]` when status is `'starting'` (the `<RTMPPublisher>` ref is attached during commit, before the effect runs).
- `useRtmpPublisherSession()` takes no argument (URL passed to `<RTMPPublisher>` by the screen).

---

## File Structure

```text
SRSRN/
├── package.json                              # +react-native-rtmp-publisher 0.4.7 exact (Task 1, already installed)
├── package-lock.json                         # updated (Task 1)
├── jest.setup.js                             # +jest.mock('react-native-rtmp-publisher') (Task 1)
├── ios/SRSRN/AppDelegate.swift               # +AVAudioSession PlayAndRecord (Task 1)
├── ios/Podfile.lock                          # +HaishinKit 1.2.7 (Task 1, already pod-installed)
├── navigation/types.ts                       # +RtmpPublishUrl, +RtmpPublisher (Task 2)
├── navigation/RootNavigator.tsx              # +2 Stack.Screen (Task 4)
├── launcher/features.ts                      # +rtmp_publish entry (Task 4)
├── features/rtmp_publish/
│   ├── validation.ts                         # Task 2
│   ├── RtmpPublishUrlScreen.tsx              # Task 2
│   ├── types.ts                              # Task 3
│   ├── useRtmpPublisherSession.ts            # Task 3
│   └── RtmpPublisherScreen.tsx               # Task 3
└── __tests__/
    ├── rtmp-publish-validation.test.ts       # Task 2
    ├── RtmpPublishUrlScreen.test.tsx         # Task 2
    ├── RtmpPublisherScreen.test.tsx          # Task 3
    └── HomeScreen.test.tsx                   # +rtmp_publish assertions (Task 4)
```

---

### Task 1: Commit dependency, jest mock, AppDelegate audio session

**Files:** `SRSRN/package.json`, `SRSRN/package-lock.json` (already installed), `SRSRN/jest.setup.js` (mock), `SRSRN/ios/SRSRN/AppDelegate.swift` (audio session), `SRSRN/ios/Podfile.lock` (already pod-installed).

**Steps:**

- [ ] **Step 1: Add the `react-native-rtmp-publisher` jest mock to `jest.setup.js`**

Append after the existing `jest.mock('react-native-vlc-media-player', ...)` block:

```js
jest.mock('react-native-rtmp-publisher', () => {
  const React = require('react');
  const mockRtmpInstances = [];

  function makeInstance() {
    const instance = {
      startStream: jest.fn(() => Promise.resolve()),
      stopStream: jest.fn(() => Promise.resolve()),
      isStreaming: jest.fn(() => Promise.resolve(false)),
      isCameraOnPreview: jest.fn(() => Promise.resolve(true)),
      getPublishURL: jest.fn(() => Promise.resolve('')),
      hasCongestion: jest.fn(() => Promise.resolve(false)),
      isAudioPrepared: jest.fn(() => Promise.resolve(true)),
      isVideoPrepared: jest.fn(() => Promise.resolve(true)),
      isMuted: jest.fn(() => Promise.resolve(false)),
      mute: jest.fn(() => Promise.resolve()),
      unmute: jest.fn(() => Promise.resolve()),
      switchCamera: jest.fn(() => Promise.resolve()),
      toggleFlash: jest.fn(() => Promise.resolve()),
      setAudioInput: jest.fn(() => Promise.resolve()),
      __onConnectionStarted: null,
      __onConnectionSuccess: null,
      __onConnectionFailed: null,
      __onDisconnect: null,
      __fireOnConnectionStarted(payload) {
        if (instance.__onConnectionStarted) instance.__onConnectionStarted(payload);
      },
      __fireOnConnectionSuccess(payload) {
        if (instance.__onConnectionSuccess) instance.__onConnectionSuccess(payload);
      },
      __fireOnConnectionFailed(payload) {
        if (instance.__onConnectionFailed) instance.__onConnectionFailed(payload);
      },
      __fireOnDisconnect(payload) {
        if (instance.__onDisconnect) instance.__onDisconnect(payload);
      },
    };
    mockRtmpInstances.push(instance);
    return instance;
  }

  const RTMPPublisher = React.forwardRef((props, ref) => {
    const instanceRef = React.useRef(null);
    if (instanceRef.current === null) {
      instanceRef.current = makeInstance();
    }
    const instance = instanceRef.current;
    // Re-bind the latest callbacks on every render so a per-attempt closure
    // (see useRtmpPublisherSession) is what __fire* invokes.
    instance.__onConnectionStarted = props.onConnectionStarted;
    instance.__onConnectionSuccess = props.onConnectionSuccess;
    instance.__onConnectionFailed = props.onConnectionFailed;
    instance.__onDisconnect = props.onDisconnect;
    React.useImperativeHandle(ref, () => instance, [instance]);
    // NOTE: deliberately no cleanup effect that nulls the __on* handlers -
    // tests must be able to fire late events on a stale/unmounted instance.
    return React.createElement('RTMPPublisher', {testID: props.testID});
  });

  return {
    __esModule: true,
    default: RTMPPublisher,
    __mockRtmpInstances: mockRtmpInstances,
    __resetRtmpMocks() {
      mockRtmpInstances.length = 0;
    },
  };
});
```

- [ ] **Step 2: Add the AVAudioSession setup to `ios/SRSRN/AppDelegate.swift`**

Add `import AVFoundation` at the top (after `import ReactAppDependencyProvider`), and insert the audio-session setup inside `application(_:didFinishLaunchingWithOptions:)` before `return true`:

```swift
    // react-native-rtmp-publisher: configure AVAudioSession for camera+mic
    // capture (PlayAndRecord, default to speaker, allow Bluetooth). This is
    // the Swift translation of the library's documented AppDelegate.mm setup.
    let audioSession = AVAudioSession.sharedInstance()
    try? audioSession.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.defaultToSpeaker, .allowBluetooth]
    )
    try? audioSession.setActive(true)
```

- [ ] **Step 3: Verify TypeScript, lint, and the existing test suite still pass**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```

Expected: tsc clean; lint 0 problems; all existing tests pass (the new mock is inert for files that don't import `react-native-rtmp-publisher`).

- [ ] **Step 4: Verify the iOS build still succeeds (after the AppDelegate change)**

```bash
cd SRSRN && xcodebuild -workspace ios/SRSRN.xcworkspace -scheme SRSRN -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO 2>&1 | tail -3
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.setup.js ios/SRSRN/AppDelegate.swift ios/Podfile.lock
git commit -F - <<'COMMIT_MSG'
chore(srsrn): add react-native-rtmp-publisher 0.4.7, jest mock, AppDelegate audio

Pin react-native-rtmp-publisher to 0.4.7 (exact; unmaintained, wraps
HaishinKit 1.2.7 on iOS). The package is legacy-bridge but builds on RN 0.86
via the new-arch interop layer. Add a jest mock that records each mounted
<RTMPPublisher> instance with __fireOnConnection* helpers and
startStream/stopStream jest.fns. Add AVAudioSession PlayAndRecord setup to
AppDelegate.swift (Swift translation of the library's documented
AppDelegate.mm requirement) so audio capture routes correctly. Camera/mic
permissions already exist (WHIP).

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 2: RTMP publish routes, validation, URL-entry screen

**Files:** `SRSRN/navigation/types.ts` (routes), `SRSRN/features/rtmp_publish/validation.ts`, `SRSRN/features/rtmp_publish/RtmpPublishUrlScreen.tsx`, tests.

- [ ] **Step 1: Add routes to `navigation/types.ts`** - append after `RtmpPlayer`:

```ts
  RtmpPlayer: {rtmpUrl: string};
  RtmpPublishUrl: undefined;
  RtmpPublisher: {rtmpUrl: string};
};
```

- [ ] **Step 2: Write failing validation test** - Create `SRSRN/__tests__/rtmp-publish-validation.test.ts` (mirror `rtmp-validation.test.ts`, replacing `validateRtmpUrl`->`validateRtmpPublishUrl`, `DEFAULT_RTMP_URL`->`DEFAULT_RTMP_PUBLISH_URL`, both = `rtmp://192.168.1.100:1935/live/livestream`). 10 tests: empty, whitespace, unparseable, http scheme, srt scheme, accepts default, accepts different host, trims, default-is-SRS-endpoint, no-collision-with-play (same URL is fine - assert it equals the play default instead, or drop this test since they're intentionally the same). **Drop the "does not collide" test** (publish and play defaults are intentionally the same SRS URL) -> 9 tests.

- [ ] **Step 3: Run failing** - `npm test -- rtmp-publish-validation` - expect FAIL.
- [ ] **Step 4: Implement `features/rtmp_publish/validation.ts`**:

```ts
export const DEFAULT_RTMP_PUBLISH_URL =
  'rtmp://192.168.1.100:1935/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateRtmpPublishUrl(input: string): ValidationResult {
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

- [ ] **Step 5: Run passing** - expect PASS (9 tests).
- [ ] **Step 6: Write failing `RtmpPublishUrlScreen` test** - Create `SRSRN/__tests__/RtmpPublishUrlScreen.test.tsx` (mirror `RtmpUrlScreen.test.tsx`, replacing `RtmpUrlScreen`->`RtmpPublishUrlScreen`, `RtmpUrl`->`RtmpPublishUrl`, `RtmpPlayer`->`RtmpPublisher`, `rtmp-url-*`->`rtmp-publish-url-*`, `DEFAULT_RTMP_URL`->`DEFAULT_RTMP_PUBLISH_URL`, param `rtmpUrl`). 5 tests.
- [ ] **Step 7: Run failing** - expect FAIL.
- [ ] **Step 8: Implement `features/rtmp_publish/RtmpPublishUrlScreen.tsx`** (mirror `RtmpUrlScreen.tsx` with the renames; label `'RTMP publish server URL'`).
- [ ] **Step 9: Run passing** - expect PASS (5 tests).
- [ ] **Step 10: Commit**

```bash
git add navigation/types.ts features/rtmp_publish/validation.ts features/rtmp_publish/RtmpPublishUrlScreen.tsx __tests__/rtmp-publish-validation.test.ts __tests__/RtmpPublishUrlScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTMP publish URL entry screen with preserved default URL

Add the RtmpPublishUrl and RtmpPublisher routes, validateRtmpPublishUrl
(syntactic rtmp:// validation), DEFAULT_RTMP_PUBLISH_URL pointing at the SRS
RTMP ingest endpoint (rtmp://192.168.1.100:1935/live/livestream), and
RtmpPublishUrlScreen which navigates to RtmpPublisher with the typed
{rtmpUrl} parameter.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 3: RTMP publisher session hook and publisher screen

**Files:** `SRSRN/features/rtmp_publish/types.ts`, `SRSRN/features/rtmp_publish/useRtmpPublisherSession.ts`, `SRSRN/features/rtmp_publish/RtmpPublisherScreen.tsx`, `SRSRN/__tests__/RtmpPublisherScreen.test.tsx`.

- [ ] **Step 1: Implement `features/rtmp_publish/types.ts`**:

```ts
import type {RefObject} from 'react';
import type {RTMPPublisherRefProps} from 'react-native-rtmp-publisher';

export type RtmpPublisherStatus = 'idle' | 'starting' | 'active' | 'error';

// The library's onConnectionFailed carries a string; others carry null.
// The index signature keeps the type permissive for extra native fields.
export type RtmpConnectionEvent = {
  data?: string;
  [key: string]: unknown;
};

export type UseRtmpPublisherSessionResult = {
  status: RtmpPublisherStatus;
  errorMessage: string | null;
  publisherRef: RefObject<RTMPPublisherRefProps | null>;
  onConnectionStarted: (event: RtmpConnectionEvent) => void;
  onConnectionSuccess: (event: RtmpConnectionEvent) => void;
  onConnectionFailed: (event: RtmpConnectionEvent) => void;
  onDisconnect: (event: RtmpConnectionEvent) => void;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 2: Implement `features/rtmp_publish/useRtmpPublisherSession.ts`**:

```ts
import React from 'react';
import type {RTMPPublisherRefProps} from 'react-native-rtmp-publisher';
import type {
  RtmpConnectionEvent,
  RtmpPublisherStatus,
  UseRtmpPublisherSessionResult,
} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onConnectionStarted: (event: RtmpConnectionEvent) => void;
  onConnectionSuccess: (event: RtmpConnectionEvent) => void;
  onConnectionFailed: (event: RtmpConnectionEvent) => void;
  onDisconnect: (event: RtmpConnectionEvent) => void;
};

const noop = () => {};
const noopEvent = (_event: RtmpConnectionEvent) => {};

// Mirrors useWhipSession (explicit Start, attemptRef + isCurrent guard,
// idempotent cleanupAttempt via a closed flag, unmount teardown) adapted to
// react-native-rtmp-publisher's <RTMPPublisher> component. The component is
// mounted on Start; startStream() is called from a useEffect once the ref is
// attached (React attaches refs during commit, before the effect runs). The
// connection callbacks (per-attempt, isCurrent-guarded) drive status.
// cleanupAttempt calls stopStream(); the closed flag plus isCurrent() drops
// any late callbacks from an obsolete attempt.
export function useRtmpPublisherSession(): UseRtmpPublisherSessionResult {
  const [status, setStatus] = React.useState<RtmpPublisherStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const publisherRef = React.useRef<RTMPPublisherRefProps>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // Imperative stop: stopStream() ends the RTMP push. The subsequent
    // status -> 'idle' transition in stop()/onConnectionFailed() unmounts
    // <RTMPPublisher>, releasing the camera/mic. isCurrent() drops any late
    // connection callbacks.
    publisherRef.current?.stopStream();
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
      onConnectionStarted: (_event: RtmpConnectionEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        // stay 'starting' until success/failure
      },
      onConnectionSuccess: (_event: RtmpConnectionEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onConnectionFailed: (event: RtmpConnectionEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage(
          (typeof event?.data === 'string' && event.data) || 'Connection failed',
        );
        setStatus('error');
      },
      onDisconnect: (_event: RtmpConnectionEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        // Unexpected disconnect (our own stop() nulls attemptRef first, so
        // this only fires for server-side drops while the attempt is current).
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage('Disconnected');
        setStatus('error');
      },
    };
    setHandlers(attemptHandlers);
  }, [isCurrent, cleanupAttempt]);

  // Call startStream() once <RTMPPublisher> has mounted and the ref attached.
  // React attaches refs during commit, before this effect runs, so
  // publisherRef.current is set when status first becomes 'starting'.
  React.useEffect(() => {
    if (status === 'starting' && publisherRef.current) {
      publisherRef.current.startStream();
    }
  }, [status]);

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
    publisherRef,
    onConnectionStarted: handlers?.onConnectionStarted ?? noopEvent,
    onConnectionSuccess: handlers?.onConnectionSuccess ?? noopEvent,
    onConnectionFailed: handlers?.onConnectionFailed ?? noopEvent,
    onDisconnect: handlers?.onDisconnect ?? noopEvent,
    start,
    stop,
  };
}
```

- [ ] **Step 3: Implement `features/rtmp_publish/RtmpPublisherScreen.tsx`**:

```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import RTMPPublisher from 'react-native-rtmp-publisher';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useRtmpPublisherSession} from './useRtmpPublisherSession';

type Props = NativeStackScreenProps<RootStackParamList, 'RtmpPublisher'>;

// Split rtmp://host:port/app/stream into streamURL (before last '/') and
// streamName (last segment) for <RTMPPublisher>'s streamURL/streamName props.
function splitRtmpUrl(url: string): {streamURL: string; streamName: string} {
  const idx = url.lastIndexOf('/');
  if (idx <= 0) {
    return {streamURL: url, streamName: ''};
  }
  return {streamURL: url.slice(0, idx), streamName: url.slice(idx + 1)};
}

export function RtmpPublisherScreen({route}: Props): React.JSX.Element {
  const {rtmpUrl} = route.params;
  const {streamURL, streamName} = splitRtmpUrl(rtmpUrl);
  const {
    status,
    errorMessage,
    publisherRef,
    onConnectionStarted,
    onConnectionSuccess,
    onConnectionFailed,
    onDisconnect,
    start,
    stop,
  } = useRtmpPublisherSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="rtmp-publisher-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="rtmp-publisher-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="rtmp-publisher-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.previewContainer}>
          <RTMPPublisher
            testID="rtmp-publisher-preview"
            ref={publisherRef}
            streamURL={streamURL}
            streamName={streamName}
            onConnectionStarted={onConnectionStarted}
            onConnectionSuccess={onConnectionSuccess}
            onConnectionFailed={onConnectionFailed}
            onDisconnect={onDisconnect}
            style={styles.preview}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  previewContainer: {width: 300, height: 400, borderWidth: 1},
  preview: {width: '100%', height: '100%'},
  error: {color: '#c00', fontSize: 13},
});
```

- [ ] **Step 4: Write `SRSRN/__tests__/RtmpPublisherScreen.test.tsx`** (mirror the SRT/Dash player test structure adapted to the publisher: `rtmp` mock, testIDs `rtmp-publisher-start/stop/error/preview`, route `RtmpPublisher` param `rtmpUrl`. 9 tests:
  - no-work-before-Start (no instance, no preview)
  - happy-path: Start mounts preview, calls startStream, onConnectionSuccess -> no error, preview visible
  - duplicate Start creates one instance
  - Stop during connecting calls stopStream once, unmounts preview, late onConnectionSuccess ignored
  - unmount teardown no-throw on late events
  - obsolete attempt isolation (stale A events dropped, B works)
  - visible errors: onConnectionFailed shows message + unmounts preview
  - idempotent: Stop + unmount + late events no throw/double-clean
  - failed start recovery: onConnectionFailed -> error, then fresh Start works

```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {RtmpPublisherScreen} from '../features/rtmp_publish/RtmpPublisherScreen';
import {DEFAULT_RTMP_PUBLISH_URL} from '../features/rtmp_publish/validation';

const rtmp = require('react-native-rtmp-publisher');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasPreview(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-publisher-preview'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-publisher-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'RtmpPublisher-test',
    name: 'RtmpPublisher' as const,
    params: {rtmpUrl: DEFAULT_RTMP_PUBLISH_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtmpPublisherScreen navigation={navigation} route={route} />);
  });
  return tree;
}

async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'rtmp-publisher-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'rtmp-publisher-stop').props.onPress();
  });
}

describe('RtmpPublisherScreen - no work before Start', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('renders no RTMPPublisher and creates no instance before Start', () => {
    const tree = render();
    expect(rtmp.__mockRtmpInstances.length).toBe(0);
    expect(hasPreview(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - happy path', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('Start mounts the publisher, calls startStream, and onConnectionSuccess marks active', async () => {
    const tree = render();
    await pressStart(tree);
    expect(hasPreview(tree.root)).toBe(true);
    expect(rtmp.__mockRtmpInstances.length).toBe(1);
    expect(rtmp.__mockRtmpInstances[0].startStream).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[0].__fireOnConnectionSuccess(null);
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasPreview(tree.root)).toBe(true);
  });
});

describe('RtmpPublisherScreen - duplicate Start', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('creates only one publisher when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'rtmp-publisher-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(rtmp.__mockRtmpInstances.length).toBe(1);
  });
});

describe('RtmpPublisherScreen - cancellation during each stage', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('Stop during connecting calls stopStream, unmounts the publisher, and leaves no session', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = rtmp.__mockRtmpInstances[0];
    pressStop(tree);
    expect(instanceA.stopStream).toHaveBeenCalledTimes(1);
    expect(hasPreview(tree.root)).toBe(false);
    ReactTestRenderer.act(() => {
      instanceA.__fireOnConnectionSuccess(null);
    });
    expect(hasError(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-publisher-start'}).length).toBeGreaterThan(0);
  });
  it('unmount tears down without throwing on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = rtmp.__mockRtmpInstances[0];
    ReactTestRenderer.act(() => { tree.unmount(); });
    expect(() => {
      ReactTestRenderer.act(() => instanceA.__fireOnConnectionSuccess(null));
    }).not.toThrow();
  });
});

describe('RtmpPublisherScreen - obsolete attempt isolation', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('a stale attempt late-arriving callbacks do not disturb the newer attempt', async () => {
    const tree = render();
    await pressStart(tree);
    const instanceA = rtmp.__mockRtmpInstances[0];
    pressStop(tree);
    await pressStart(tree);
    const instanceB = rtmp.__mockRtmpInstances[1];
    ReactTestRenderer.act(() => { instanceA.__fireOnConnectionSuccess(null); });
    ReactTestRenderer.act(() => { instanceA.__fireOnConnectionFailed({data: 'stale'}); });
    expect(hasError(tree.root)).toBe(false);
    expect(hasPreview(tree.root)).toBe(true);
    ReactTestRenderer.act(() => { instanceB.__fireOnConnectionSuccess(null); });
    expect(hasPreview(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - visible errors', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('onConnectionFailed shows a user-visible error and unmounts the publisher', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[0].__fireOnConnectionFailed({data: 'handshake refused'});
    });
    expect(findByTestID(tree.root, 'rtmp-publisher-error').props.children).toBe('handshake refused');
    expect(hasPreview(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - idempotent cleanup and recovery', () => {
  beforeEach(() => { jest.clearAllMocks(); rtmp.__resetRtmpMocks(); });
  it('Stop then unmount is idempotent: no double-cleanup, no throw on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instance = rtmp.__mockRtmpInstances[0];
    pressStop(tree);
    expect(instance.stopStream).toHaveBeenCalledTimes(1);
    expect(() => { ReactTestRenderer.act(() => tree.unmount()); }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnConnectionSuccess(null));
    }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnConnectionFailed({data: 'late'}));
    }).not.toThrow();
  });
  it('a failed start leaves the screen ready for a fresh Start', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[0].__fireOnConnectionFailed({data: 'first attempt failed'});
    });
    expect(findByTestID(tree.root, 'rtmp-publisher-error').props.children).toBe('first attempt failed');
    expect(hasPreview(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-publisher-start'}).length).toBeGreaterThan(0);
    await pressStart(tree);
    expect(hasPreview(tree.root)).toBe(true);
    expect(rtmp.__mockRtmpInstances.length).toBe(2);
    expect(hasError(tree.root)).toBe(false);
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[1].__fireOnConnectionSuccess(null);
    });
    expect(hasPreview(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests** - `npm test -- RtmpPublisherScreen` - expect PASS (9 tests). The "Stop during connecting" test asserts `stopStream` called exactly once. If `startStream` is called twice or `stopStream` zero times, check the `[status]` effect and `cleanupAttempt`.
- [ ] **Step 6: Full suite** - `npx tsc --noEmit && npm run lint && npm test` - expect all green.
- [ ] **Step 7: Commit**

```bash
git add features/rtmp_publish/types.ts features/rtmp_publish/useRtmpPublisherSession.ts features/rtmp_publish/RtmpPublisherScreen.tsx __tests__/RtmpPublisherScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): add RTMP publisher with generation-guarded session and explicit Start

useRtmpPublisherSession mirrors useWhipSession (explicit Start, attemptRef +
isCurrent guard, idempotent cleanupAttempt via a closed flag, unmount
teardown) adapted to react-native-rtmp-publisher's <RTMPPublisher>. The
component mounts on Start; startStream() is called from a [status] useEffect
once the ref is attached. Connection callbacks (per-attempt, isCurrent-guarded)
drive status: onConnectionSuccess -> 'active'; onConnectionFailed ->
'error' with the callback's message; onDisconnect (unexpected) -> 'error'.
cleanupAttempt calls stopStream(). RtmpPublisherScreen splits the route URL
into streamURL/streamName and renders <RTMPPublisher> bound to the hook's
ref and callbacks.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 4: Launcher entry, navigator wiring, Home screen test

- [ ] **Step 1: `launcher/features.ts`** - add `'RtmpPublishUrl'` to the `LauncherDestination` union; append the rtmp_publish entry after rtmp:

```ts
  {
    id: 'rtmp_publish',
    title: 'RTMP Publish',
    description: 'Publish camera and microphone to an SRS server via RTMP.',
    actionLabel: 'Open RTMP Pub',
    color: '#4338ca',
    destination: 'RtmpPublishUrl',
  },
];
```

- [ ] **Step 2: `navigation/RootNavigator.tsx`** - add imports `RtmpPublishUrlScreen` / `RtmpPublisherScreen` from `../features/rtmp_publish/`; add 2 Stack.Screen entries (`RtmpPublishUrl` / `RtmpPublisher`).
- [ ] **Step 3: `__tests__/HomeScreen.test.tsx`** - add `launcher-rtmp_publish-action` assertion to the "renders a card" test; add a nav test (`navigates to RtmpPublishUrl`); rename the synthetic extra entry's id to a non-colliding value (e.g. `flv` -> keep `flv` if still non-colliding, else rename to `mp4`).
- [ ] **Step 4: Run Home + App tests** - `npm test -- HomeScreen App` - expect PASS.
- [ ] **Step 5: tsc + lint** - expect no errors.
- [ ] **Step 6: Commit**

```bash
git add launcher/features.ts navigation/RootNavigator.tsx __tests__/HomeScreen.test.tsx
git commit -F - <<'COMMIT_MSG'
feat(srsrn): wire RTMP publisher launcher entry and routes into the navigator

Add the RTMP Publish card to LAUNCHER_FEATURES (destination RtmpPublishUrl,
indigo #4338ca), register the RtmpPublishUrl and RtmpPublisher Stack.Screen
entries, and extend the Home screen tests to assert the real RTMP Publish
card renders and navigates. HomeScreen layout logic is unchanged.

Co-Authored-By: Claude <noreply@anthropic.com>
COMMIT_MSG
```

---

### Task 5: Final verification

- [ ] **Step 1:** `cd SRSRN && npx tsc --noEmit && npm run lint && npm test` - all green.
- [ ] **Step 2:** iOS sim build (already passing; reconfirm after all changes).
- [ ] **Step 3:** Android Gradle config check.
- [ ] **Step 4:** Update SDD ledger `.superpowers/sdd/2026-08-12-srs-rn-rtmp-publish/progress.md`.
- [ ] **Step 5:** Report the device-verification gate - RTMP publish must be performed on a device against SRS. The package is unmaintained; this is the experimental gate.

---

## Self-Review

- **Spec coverage:** all spec sections map to tasks (Media Stack/viability -> Task 1 + Task 5 gate; Native Config -> Task 1; URL Entry & Validation -> Task 2; Session Lifecycle -> Task 3; Testing -> Tasks 2-4; Verification -> Task 5).
- **Placeholder scan:** no TBD/TODO; concrete code and commands throughout. The validation/URL-screen/home-test steps reference mirroring existing files with explicit renames (the patterns are established in committed code).
- **Type consistency:** `DEFAULT_RTMP_PUBLISH_URL`/`validateRtmpPublishUrl` (Task 2) consumed by `RtmpPublishUrlScreen` (Task 2) and `RtmpPublisherScreen.test.tsx` (Task 3). `publisherRef: RefObject<RTMPPublisherRefProps | null>` (types.ts) matches `React.useRef<RTMPPublisherRefProps>(null)` (hook). `RtmpConnectionEvent` is a supertype of the library's callback payloads. Test IDs consistent: `rtmp-publish-url-*` (Task 2), `rtmp-publisher-*` (Task 3), `launcher-rtmp_publish-action` (Task 4).
- **Risk:** the package is unmaintained/legacy-bridge. Build passes (verified). Runtime/device behavior is the gate - honest about this in the spec and Task 5.
