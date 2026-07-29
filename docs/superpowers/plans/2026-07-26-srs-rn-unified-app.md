# SRS RN Unified Application Implementation Plan

**Date:** 2026-07-26
**Spec:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md` (Approved)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new, independent React Native 0.86 application named **SRS RN** (root `SRSRN/`, native name `SRSRN`, display name `SRS RN`) that hosts WHIP publishing and WHEP playback behind a protocol-grid launcher, with explicit Start, generation-guarded session attempts, abortable SDP negotiation, and idempotent teardown. The legacy `WHIPPublisher/` and `WHEPPlayer/` apps remain untouched.

**Architecture:** A feature-based structure keeps application-wide navigation separate from protocol implementations. Each feature (`features/whip/`, `features/whep/`) owns its URL entry, validation, route types, media-session lifecycle, and tests. There is no shared cross-protocol media-session abstraction. Each feature encapsulates its lifecycle in a feature-local hook (`useWhipSession` / `useWhepSession`) that enforces attempt identity, stale-attempt isolation, fetch abort, and idempotent cleanup. The two implementations are independent and parallel; they do not import from each other.

**Tech Stack:** React Native 0.86.0, React 19.2.3, TypeScript ^5.8.3, react-native-webrtc 124.0.7, `@react-navigation/native` ^7.3.13, `@react-navigation/native-stack` ^7.18.5, `react-native-gesture-handler` ^3.1.0, `react-native-screens` ^4.26.2, `react-native-safe-area-context` ^5.5.2, Node >=22.11.0, CocoaPods, iOS primary target, Android structural target.

## Global Constraints

Copied exactly from the approved specification:

- The new application becomes the primary project for future development. The existing `WHIPPublisher/` and `WHEPPlayer/` projects remain unchanged as legacy/reference applications.
- Root directory: `SRSRN/`; native module/project name: `SRSRN`; user-facing display name: `SRS RN`.
- React Native baseline: `0.86.0` with React `19.2.3` and react-native-webrtc `124.0.7`.
- Primary verification target: iOS. Preserved structural target: Android (Gradle configuration validation only; no emulator/device runtime claim).
- A fresh React Native 0.86 project rather than a renamed copy of an existing native project.
- Feature-based source organization; each feature owns its screens, validation, route-facing types, media lifecycle, and focused tests.
- Existing protocol-specific default URLs and editable URL behavior are preserved byte-for-byte.
- Explicit media-session teardown on Stop, navigation away, and unmount; no session continues after leaving Publisher or Player.
- Start is explicit for both WHIP and WHEP. Unified WHEP intentionally replaces the standalone player's auto-start-on-mount with an explicit Start.
- Each accepted Start creates one uniquely identified session attempt; duplicate/concurrent Start is blocked.
- Stop, navigation away, unmount, retry, or failure marks the current attempt obsolete before cleanup. An obsolete attempt must not install a peer connection/stream, apply a remote description, or update UI state.
- The in-flight SDP HTTP request is aborted via `AbortController`. Non-abortable operations may settle; their results are ignored and any resources they acquired are released immediately.
- Cleanup closes the attempt's peer connection, stops owned tracks, clears references, and is safe to invoke more than once.
- Invalid URLs are rejected on the URL-entry screen and do not navigate. Non-successful HTTP responses are detected before answer SDP is applied.
- Dependency versions are checked for compatibility rather than copied blindly.
- `WHIPPublisher/` and `WHEPPlayer/` are never modified by this plan.
- Do not create commits or push changes unless the user explicitly asks. The executor should commit at each checkpoint listed below, staging only `SRSRN/` files (and the plan file where noted).

## File Structure

```text
SRSRN/
├── App.tsx
├── navigation/
│   ├── RootNavigator.tsx
│   └── types.ts
├── screens/
│   └── HomeScreen.tsx
├── launcher/
│   └── features.ts
├── features/
│   ├── whip/
│   │   ├── WhipUrlScreen.tsx
│   │   ├── PublisherScreen.tsx
│   │   ├── useWhipSession.ts
│   │   ├── validation.ts
│   │   └── types.ts
│   └── whep/
│       ├── WhepUrlScreen.tsx
│       ├── PlayerScreen.tsx
│       ├── useWhepSession.ts
│       ├── validation.ts
│       └── types.ts
├── __tests__/
│   ├── util.ts
│   ├── App.test.tsx
│   ├── HomeScreen.test.tsx
│   ├── whip-validation.test.ts
│   ├── WhipUrlScreen.test.tsx
│   ├── whep-validation.test.ts
│   ├── WhepUrlScreen.test.tsx
│   ├── PublisherScreen.test.tsx
│   └── PlayerScreen.test.tsx
├── jest.setup.js
└── jest.config.js
```

`useWhipSession.ts` / `useWhepSession.ts` implement the **media lifecycle** the spec assigns to each feature. They are feature-local and independent; there is no shared session abstraction. All other framework files (`package.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc.js`, `Gemfile`, `ios/`, `android/`) come from the RN 0.86 template and are customized only as described in Tasks 8-9.

## Interfaces Between Tasks

- **Task 1** produces a building, testable RN 0.86 project shell at `SRSRN/` with dependencies installed.
- **Task 2** produces `navigation/types.ts` (`RootStackParamList`), `navigation/RootNavigator.tsx`, and `App.tsx`. All later screens are typed against `RootStackParamList`.
- **Task 3** produces `launcher/features.ts` (`LAUNCHER_FEATURES`, `LauncherFeature`) and `screens/HomeScreen.tsx` (consumes `LauncherFeature[]`, navigates to `WhipUrl` / `WhepUrl`).
- **Tasks 4-5** produce `features/<proto>/validation.ts` (`DEFAULT_<PROTO>_URL`, `validate<Proto>Url`) and `features/<proto>/<Proto>UrlScreen.tsx` (navigate to `Publisher`/`Player` with the typed URL param).
- **Tasks 6-7** produce `features/<proto>/types.ts` (session status + hook result), `features/<proto>/use<Proto>Session.ts`, and `features/<proto>/<Publisher|Player>Screen.tsx`. Screens consume the hook and render via `RTCView`.
- **Tasks 8-9** customize native projects. They depend on Task 1's scaffold and are otherwise independent of the JS feature work.

---

### Task 1: Scaffold the SRSRN React Native 0.86 Project

**Files:**
- Create: `SRSRN/` (entire generated project)
- Customize: `SRSRN/package.json`, `SRSRN/jest.setup.js`, `SRSRN/jest.config.js`

**Interfaces:**
- Consumes: RN 0.86 template and the verified dependency versions from `WHIPPublisher/package.json`.
- Produces: a buildable, testable independent project at `SRSRN/` with identity `SRSRN`.

- [ ] **Step 1: Generate the project from the RN 0.86 template**

Run from the repo root:
```bash
npx @react-native-community/cli@20.1.0 init SRSRN --version 0.86.0 --pm npm --install-pods false
```
Expected: a fresh `SRSRN/` directory is created with `react-native` `0.86.0`, `react` `19.2.3`, and CLI `20.1.0`. Pod install is deferred to Task 8.

If the CLI does not recognize `--install-pods false`, omit the flag and decline the CocoaPods prompt when it appears (pods are installed in Task 8).

If `npx @react-native-community/cli@20.1.0 init` is unavailable, fall back to:
```bash
npx react-native@0.86.0 init SRSRN --pm npm --skip-install-pods
```
(Use `--skip-install-pods` only if the installed CLI exposes it; otherwise decline the pods prompt.)

- [ ] **Step 2: Pin the exact dependency set**

Edit `SRSRN/package.json` `dependencies` to:
```json
"dependencies": {
  "@react-navigation/native": "^7.3.13",
  "@react-navigation/native-stack": "^7.18.5",
  "react": "19.2.3",
  "react-native": "0.86.0",
  "react-native-gesture-handler": "^3.1.0",
  "react-native-safe-area-context": "^5.5.2",
  "react-native-screens": "^4.26.2",
  "react-native-webrtc": "124.0.7"
}
```
Keep the template's `devDependencies` (CLI `20.1.0`, RN presets/configs `0.86.0`, `@types/jest` ^29.5.13, `@types/react` ^19.2.0, `@types/react-test-renderer` ^19.1.0, `jest` ^29.6.3, `react-test-renderer` `19.2.3`, `typescript` ^5.8.3, `eslint` ^8.19.0, `prettier` 2.8.8). Set `"engines": { "node": ">=22.11.0" }`.

If the template added `@react-native/new-app-screen`, remove it (the SRSRN app does not use the template screen).

- [ ] **Step 3: Install dependencies**

Run:
```bash
cd SRSRN && npm install
```
Expected: install completes. Then verify:
```bash
npm ls react react-native react-native-webrtc @react-navigation/native @react-navigation/native-stack
```
Expected: React 19.2.3, RN 0.86.0, WebRTC 124.0.7, Navigation 7.x stack 7.x, no invalid peer dependencies.

- [ ] **Step 4: Replace the WebRTC test mock with a controllable factory**

Overwrite `SRSRN/jest.setup.js` exactly:
```js
/* eslint-env jest */

jest.mock('react-native-webrtc', () => {
  const mockPCInstances = [];

  function makeMockTrack(kind) {
    return {
      id: `${kind}-track-${mockPCInstances.length}`,
      kind,
      label: `mock-${kind}`,
      enabled: true,
      stop: jest.fn(),
    };
  }

  function makeLocalStream() {
    const tracks = [makeMockTrack('audio'), makeMockTrack('video')];
    return {
      id: `local-stream-${mockPCInstances.length}`,
      addTrack: jest.fn(),
      getTracks: jest.fn(() => tracks),
      toURL: jest.fn(() => 'mock-stream-url'),
    };
  }

  function makeEmptyStream() {
    const tracks = [];
    return {
      id: `remote-stream-${mockPCInstances.length}`,
      addTrack: jest.fn(t => tracks.push(t)),
      getTracks: jest.fn(() => tracks),
      toURL: jest.fn(() => 'mock-stream-url'),
    };
  }

  function makeMockPC() {
    const offerDeferred = {};
    offerDeferred.promise = new Promise((resolve, reject) => {
      offerDeferred.resolve = resolve;
      offerDeferred.reject = reject;
    });
    const instance = {
      addEventListener: jest.fn(),
      addTransceiver: jest.fn(),
      addTrack: jest.fn(),
      createOffer: jest.fn(() => offerDeferred.promise),
      setLocalDescription: jest.fn(() => Promise.resolve()),
      setRemoteDescription: jest.fn(() => Promise.resolve()),
      close: jest.fn(),
      _offerDeferred: offerDeferred,
    };
    mockPCInstances.push(instance);
    return instance;
  }

  return {
    mediaDevices: {
      getUserMedia: jest.fn(() => Promise.resolve(makeLocalStream())),
      enumerateDevices: jest.fn(),
    },
    MediaStream: jest.fn().mockImplementation(() => makeEmptyStream()),
    MediaStreamTrack: jest.fn(),
    RTCPeerConnection: jest.fn().mockImplementation(() => makeMockPC()),
    RTCSessionDescription: jest.fn(),
    RTCIceCandidate: jest.fn(),
    RTCView: 'RTCView',
    RTCPIPView: 'RTCPIPView',
    registerGlobals: jest.fn(),
    __mockPCInstances: mockPCInstances,
    __resetWebRtcMocks() {
      mockPCInstances.length = 0;
    },
  };
});
```

- [ ] **Step 5: Wire the Jest setup file**

Overwrite `SRSRN/jest.config.js` exactly:
```js
module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
};
```

- [ ] **Step 6: Create the deferred test helper**

Create `SRSRN/__tests__/util.ts`:
```ts
export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function makeDeferred<T = unknown>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

export type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

export function okResponse(sdp: string): FetchResponse {
  return {ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(sdp)};
}

export function errorResponse(status: number, statusText: string): FetchResponse {
  return {ok: false, status, statusText, text: () => Promise.resolve('')};
}

const ANSWER_SDP = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=mid:0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=mid:1\r\n';

export function defaultAnswerSdp(): string {
  return ANSWER_SDP;
}
```
The media-screen test files define their own `installFetchOk()` helper (shown in Tasks 6-7), which returns a `{deferred}` and wires an abort-aware `global.fetch`. Tests that need a fetch that never resolves assign `global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise)` directly. For multi-attempt races, sequence attempts via the per-PC `createOffer` deferred and assert through `webrtc.__mockPCInstances`.

- [ ] **Step 7: Confirm the shell builds and tests run**

Run:
```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```
Expected: TypeScript passes, lint passes (the template's App screen is fine), and the template's single test passes. If the template's `__tests__/App.test.tsx` references the template screen that you removed, replace it with the test in Task 2 Step 1 now and re-run.

- [ ] **Step 8: Commit checkpoint**

```bash
git add SRSRN
git commit -m "feat(srsrn): scaffold independent React Native 0.86 SRSRN app"
```
Stage only `SRSRN/`. Do not stage `WHIPPublisher/` or `WHEPPlayer/`.

### Task 2: Typed Root Navigator and App

**Files:**
- Create: `SRSRN/navigation/types.ts`
- Create: `SRSRN/navigation/RootNavigator.tsx`
- Modify: `SRSRN/App.tsx`
- Create: `SRSRN/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: nothing (root of the app).
- Produces: `RootStackParamList` (`Home`, `WhipUrl`, `Publisher`, `WhepUrl`, `Player`) and an `App` that renders the navigator with `Home` as the initial route. Later tasks import `RootStackParamList` from `navigation/types`.

- [ ] **Step 1: Write the App smoke test (TDD - failing first)**

Create `SRSRN/__tests__/App.test.tsx`:
```tsx
/**
 * @format
 */
jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
  createNavigationContainerRef: () => ({current: null}),
}));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: {children: React.ReactNode}) => children,
    Screen: () => null,
  }),
}));
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {it} from '@jest/globals';
import App from '../App';

it('renders without crashing with Home as the initial route', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
```
Run `npm test -- App.test` — expect failure (the placeholder `App.tsx` does not yet render `RootNavigator`).

- [ ] **Step 2: Define the root param list**

Create `SRSRN/navigation/types.ts`:
```ts
export type RootStackParamList = {
  Home: undefined;
  WhipUrl: undefined;
  Publisher: {whipUrl: string};
  WhepUrl: undefined;
  Player: {whepUrl: string};
};
```

- [ ] **Step 3: Implement the root navigator**

Create `SRSRN/navigation/RootNavigator.tsx`:
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```
This will not type-check until Tasks 3-7 add the imported screens. To keep Task 2 independently testable, temporarily comment out the four feature imports and the four `Stack.Screen` lines, run the App smoke test, then restore them as the feature screens land. Re-run `npx tsc --noEmit` after each later task to confirm the imports resolve.

- [ ] **Step 4: Implement App.tsx**

Overwrite `SRSRN/App.tsx`:
```tsx
import 'react-native-gesture-handler';
import React from 'react';
import {RootNavigator} from './navigation/RootNavigator';

export default function App(): React.JSX.Element {
  return <RootNavigator />;
}
```

- [ ] **Step 5: Run the App smoke test**

```bash
cd SRSRN && npm test -- App.test
```
Expected: the App smoke test passes. TypeScript may still report missing feature modules (resolved by Tasks 3-7); keep the feature imports commented until Task 3 lands if you want a green `tsc` at every step.

- [ ] **Step 6: Commit checkpoint**

```bash
git add SRSRN/navigation SRSRN/App.tsx SRSRN/__tests__/App.test.tsx
git commit -m "feat(srsrn): add typed root navigator with Home as initial route"
```

---

### Task 3: Launcher Configuration and Home Screen

**Files:**
- Create: `SRSRN/launcher/features.ts`
- Create: `SRSRN/screens/HomeScreen.tsx`
- Create: `SRSRN/__tests__/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` route names `WhipUrl` and `WhepUrl`.
- Produces: `LAUNCHER_FEATURES: LauncherFeature[]` and `HomeScreen` which renders one card per feature and navigates to the feature's destination.

- [ ] **Step 1: Write the Home screen tests (TDD - failing first)**

Create `SRSRN/__tests__/HomeScreen.test.tsx`:
```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {HomeScreen} from '../screens/HomeScreen';
import {LAUNCHER_FEATURES, LauncherFeature} from '../launcher/features';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}

function render(features?: LauncherFeature[]) {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'Home-test', name: 'Home' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <HomeScreen navigation={navigation} route={route} features={features} />,
    );
  });
  return {tree, navigate};
}

describe('HomeScreen', () => {
  it('renders a card for each launcher feature from the default config', () => {
    const {tree} = render();
    expect(tree.root.findAllByProps({testID: 'launcher-whip-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-whep-action'}).length).toBeGreaterThan(0);
  });

  it('navigates to WhipUrl when the WHIP card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-whip-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('WhipUrl');
  });

  it('navigates to WhepUrl when the WHEP card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-whep-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('WhepUrl');
  });

  it('renders an additional launcher entry without layout changes', () => {
    const extra: LauncherFeature = {
      id: 'hls',
      title: 'HLS Play',
      description: 'Future entry.',
      actionLabel: 'Open HLS',
      color: '#999',
      destination: 'WhipUrl',
    };
    const {tree} = render([...LAUNCHER_FEATURES, extra]);
    // The third card's action button renders - layout shape is unchanged.
    // (Use an existence check, not an exact count: React 19's test renderer
    // represents forwardRef host components like View twice, which would
    // double any findAllByProps count on a View testID.)
    expect(tree.root.findAllByProps({testID: 'launcher-hls-action'}).length).toBeGreaterThan(0);
  });
});
```
Run `npm test -- HomeScreen` - expect failure (`HomeScreen` and `launcher/features` do not exist yet).

- [ ] **Step 2: Define the launcher configuration**

Create `SRSRN/launcher/features.ts`:
```ts
import type {RootStackParamList} from '../navigation/types';

export type LauncherDestination = Extract<
  keyof RootStackParamList,
  'WhipUrl' | 'WhepUrl'
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
];
```

- [ ] **Step 3: Implement HomeScreen**

Create `SRSRN/screens/HomeScreen.tsx`:
```tsx
import React from 'react';
import {Button, StyleSheet, Text, View, FlatList} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {LAUNCHER_FEATURES, type LauncherFeature} from '../launcher/features';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  features?: LauncherFeature[];
};

export function HomeScreen({navigation, features}: Props): React.JSX.Element {
  const list = features ?? LAUNCHER_FEATURES;
  const renderItem = ({item}: {item: LauncherFeature}) => (
    <View
      testID="launcher-card"
      style={[styles.card, {borderColor: item.color}]}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <Button
        testID={`launcher-${item.id}-action`}
        title={item.actionLabel}
        onPress={() => navigation.navigate(item.destination)}
      />
    </View>
  );
  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        keyExtractor={item => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16},
  card: {borderWidth: 2, borderRadius: 8, padding: 12, marginBottom: 12, gap: 8},
  title: {fontSize: 16, fontWeight: '700'},
  description: {fontSize: 14, color: '#444'},
});
```

- [ ] **Step 4: Run the Home tests**

```bash
cd SRSRN && npm test -- HomeScreen
```
Expected: all four Home screen tests pass.

- [ ] **Step 5: Commit checkpoint**

```bash
git add SRSRN/launcher SRSRN/screens/HomeScreen.tsx SRSRN/__tests__/HomeScreen.test.tsx
git commit -m "feat(srsrn): add launcher configuration and Home screen"
```

### Task 4: WHIP URL Entry

**Files:**
- Create: `SRSRN/features/whip/validation.ts`
- Create: `SRSRN/features/whip/WhipUrlScreen.tsx`
- Create: `SRSRN/__tests__/whip-validation.test.ts`
- Create: `SRSRN/__tests__/WhipUrlScreen.test.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` route `WhipUrl` and `Publisher`.
- Produces: `DEFAULT_WHIP_URL`, `validateWhipUrl`, and `WhipUrlScreen` that navigates to `Publisher` with `{whipUrl}`.

- [ ] **Step 1: Write the validation tests (TDD - failing first)**

Create `SRSRN/__tests__/whip-validation.test.ts`:
```ts
import {DEFAULT_WHIP_URL, validateWhipUrl} from '../features/whip/validation';

describe('validateWhipUrl', () => {
  it('rejects empty input', () => {
    expect(validateWhipUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateWhipUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateWhipUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateWhipUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_WHIP_URL', () => {
    expect(validateWhipUrl(DEFAULT_WHIP_URL)).toEqual({ok: true, url: DEFAULT_WHIP_URL});
  });
  it('accepts a valid https URL', () => {
    expect(validateWhipUrl('https://example.com/whip')).toEqual({
      ok: true,
      url: 'https://example.com/whip',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateWhipUrl('  https://example.com/whip  ')).toEqual({
      ok: true,
      url: 'https://example.com/whip',
    });
  });
  it('DEFAULT_WHIP_URL matches the legacy value byte-for-byte', () => {
    expect(DEFAULT_WHIP_URL).toBe(
      'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream',
    );
  });
});
```
Run `npm test -- whip-validation` - expect failure.

- [ ] **Step 2: Implement validation**

Create `SRSRN/features/whip/validation.ts`:
```ts
export const DEFAULT_WHIP_URL =
  'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateWhipUrl(input: string): ValidationResult {
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
Run `npm test -- whip-validation` - expect pass.

- [ ] **Step 3: Write the URL screen tests (TDD - failing first)**

Create `SRSRN/__tests__/WhipUrlScreen.test.tsx`:
```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {WhipUrlScreen} from '../features/whip/WhipUrlScreen';
import {DEFAULT_WHIP_URL} from '../features/whip/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'whip-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'WhipUrl-test', name: 'WhipUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<WhipUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('WhipUrlScreen', () => {
  it('prefills the input with DEFAULT_WHIP_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'whip-url-input').props.value).toBe(DEFAULT_WHIP_URL);
  });
  it('navigates to Publisher with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Publisher', {whipUrl: DEFAULT_WHIP_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for non-http(s) URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText('ftp://host/x');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'whip-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/whip');
    });
    expect(input.props.value).toBe('https://example.com/whip');
  });
});
```
Run `npm test -- WhipUrlScreen` - expect failure.

- [ ] **Step 4: Implement WhipUrlScreen**

Create `SRSRN/features/whip/WhipUrlScreen.tsx`:
```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_WHIP_URL, validateWhipUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'WhipUrl'>;

export function WhipUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_WHIP_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateWhipUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('Publisher', {whipUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>WHIP server URL</Text>
      <TextInput
        testID="whip-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="whip-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="whip-url-connect" title="Connect" onPress={onConnect} />
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
Run `npm test -- WhipUrlScreen` - expect pass.

- [ ] **Step 5: Commit checkpoint**

```bash
git add SRSRN/features/whip/validation.ts SRSRN/features/whip/WhipUrlScreen.tsx \
        SRSRN/__tests__/whip-validation.test.ts SRSRN/__tests__/WhipUrlScreen.test.tsx
git commit -m "feat(srsrn): add WHIP URL entry screen with preserved default URL"
```

### Task 5: WHEP URL Entry

**Files:**
- Create: `SRSRN/features/whep/validation.ts`
- Create: `SRSRN/features/whep/WhepUrlScreen.tsx`
- Create: `SRSRN/__tests__/whep-validation.test.ts`
- Create: `SRSRN/__tests__/WhepUrlScreen.test.tsx`

**Interfaces:** symmetric to Task 4 but for WHEP. `DEFAULT_WHEP_URL` is byte-for-byte the legacy WHEP default; the screen navigates to `Player` with `{whepUrl}`.

- [ ] **Step 1: Write the validation tests (TDD - failing first)**

Create `SRSRN/__tests__/whep-validation.test.ts`, mirroring `whip-validation.test.ts` but importing from `../features/whep/validation`, calling `validateWhepUrl`, and asserting:
```ts
it('DEFAULT_WHEP_URL matches the legacy value byte-for-byte', () => {
  expect(DEFAULT_WHEP_URL).toBe(
    'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream',
  );
});
it('does not collide with the WHIP default', () => {
  expect(DEFAULT_WHEP_URL).not.toBe(
    'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream',
  );
});
```
Plus the empty/whitespace/unparseable/non-http(s)/accept-default/accept-https/trim cases identical in shape to Task 4 Step 1.

- [ ] **Step 2: Implement validation**

Create `SRSRN/features/whep/validation.ts`:
```ts
export const DEFAULT_WHEP_URL =
  'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateWhepUrl(input: string): ValidationResult {
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
Run `npm test -- whep-validation` - expect pass.

- [ ] **Step 3: Write the URL screen tests (TDD - failing first)**

Create `SRSRN/__tests__/WhepUrlScreen.test.tsx`, mirroring `WhipUrlScreen.test.tsx` with testIDs `whep-url-input`, `whep-url-error`, `whep-url-connect`, asserting navigation to `Player` with `{whepUrl: DEFAULT_WHEP_URL}`.

- [ ] **Step 4: Implement WhepUrlScreen**

Create `SRSRN/features/whep/WhepUrlScreen.tsx`:
```tsx
import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_WHEP_URL, validateWhepUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'WhepUrl'>;

export function WhepUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_WHEP_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateWhepUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('Player', {whepUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>WHEP server URL</Text>
      <TextInput
        testID="whep-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="whep-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="whep-url-connect" title="Connect" onPress={onConnect} />
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
Run `npm test -- WhepUrlScreen` - expect pass.

- [ ] **Step 5: Commit checkpoint**

```bash
git add SRSRN/features/whep/validation.ts SRSRN/features/whep/WhepUrlScreen.tsx \
        SRSRN/__tests__/whep-validation.test.ts SRSRN/__tests__/WhepUrlScreen.test.tsx
git commit -m "feat(srsrn): add WHEP URL entry screen with preserved default URL"
```

---

### Task 6: WHIP Publisher with Generation-Guarded Session

**Files:**
- Create: `SRSRN/features/whip/types.ts`
- Create: `SRSRN/features/whip/useWhipSession.ts`
- Create: `SRSRN/features/whip/PublisherScreen.tsx`
- Create: `SRSRN/__tests__/PublisherScreen.test.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` route `Publisher` (`{whipUrl: string}`), `react-native-webrtc` (`RTCPeerConnection`, `mediaDevices.getUserMedia`, `MediaStream`, `RTCSessionDescription`, `RTCView`).
- Produces: a WHIP feature that creates send-only transceivers, acquires camera+mic, POSTs the offer SDP with `Content-Type: application/sdp`, applies the plain-text answer, renders the local preview, and tears down on Stop/unmount/failure. The hook enforces attempt identity, fetch abort, stale-attempt isolation, and idempotent cleanup.

- [ ] **Step 1: Define WHIP session types**

Create `SRSRN/features/whip/types.ts`:
```ts
import type {MediaStream} from 'react-native-webrtc';

export type WhipSessionStatus = 'idle' | 'starting' | 'active' | 'error';

export type UseWhipSessionResult = {
  status: WhipSessionStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 2: Implement useWhipSession**

Create `SRSRN/features/whip/useWhipSession.ts`:
```ts
import React from 'react';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import type {WhipSessionStatus} from './types';

// react-native-webrtc 124.0.7's public typings do not surface the peer
// connection's inherited addEventListener overloads. Describe only the
// listener signature this hook uses; keep the assertion narrow.
type PCEventListener = (
  type: 'iceconnectionstatechange',
  listener: (event: {readonly type: string}) => void,
) => void;
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

type Attempt = {
  id: number;
  pc: PCWithListener;
  stream: MediaStream | null;
  abort: AbortController;
  closed: boolean;
};

export function useWhipSession(whipUrl: string) {
  const [status, setStatus] = React.useState<WhipSessionStatus>('idle');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    try {
      attempt.abort.abort();
    } catch {
      // AbortController.abort never throws; ignore defensively.
    }
    if (attempt.stream) {
      attempt.stream.getTracks().forEach(t => t.stop());
    }
    attempt.pc.close();
  }, []);

  const stop = React.useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt) {
      cleanupAttempt(attempt);
    }
    attemptRef.current = null;
    setStream(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupAttempt]);

  const start = React.useCallback(async () => {
    if (attemptRef.current !== null) {
      return; // duplicate/concurrent Start guard
    }
    setErrorMessage(null);
    setStatus('starting');

    counterRef.current += 1;
    const attempt: Attempt = {
      id: counterRef.current,
      pc: new RTCPeerConnection() as PCWithListener,
      stream: null,
      abort: new AbortController(),
      closed: false,
    };
    attemptRef.current = attempt;

    try {
      attempt.pc.addEventListener('iceconnectionstatechange', () => {});
      attempt.pc.addTransceiver('audio', {direction: 'sendonly'});
      attempt.pc.addTransceiver('video', {direction: 'sendonly'});

      const mediaStream = await mediaDevices.getUserMedia({video: true, audio: true});
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      attempt.stream = mediaStream;
      mediaStream.getTracks().forEach(t => attempt.pc.addTrack(t));
      setStream(mediaStream);

      const offer = await attempt.pc.createOffer();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await attempt.pc.setLocalDescription(offer);
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }

      const response = await fetch(whipUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: offer.sdp,
        signal: attempt.abort.signal,
      });
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      if (!response.ok) {
        throw new Error(`Server responded ${response.status} ${response.statusText}`);
      }

      const answerSDP = await response.text();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await attempt.pc.setRemoteDescription(
        new RTCSessionDescription({type: 'answer', sdp: answerSDP}),
      );
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      setStatus('active');
    } catch (err) {
      if (attemptRef.current === attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setStream(null);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStatus('error');
      } else {
        // Stale attempt: release its resources but do not touch current UI.
        cleanupAttempt(attempt);
      }
    }
  }, [whipUrl, isCurrent, cleanupAttempt]);

  React.useEffect(() => {
    return () => {
      const attempt = attemptRef.current;
      if (attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
      }
    };
  }, [cleanupAttempt]);

  return {status, stream, errorMessage, start, stop};
}
```

- [ ] **Step 3: Implement PublisherScreen**

Create `SRSRN/features/whip/PublisherScreen.tsx`:
```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useWhipSession} from './useWhipSession';

type Props = NativeStackScreenProps<RootStackParamList, 'Publisher'>;

export function PublisherScreen({route}: Props): React.JSX.Element {
  const {whipUrl} = route.params;
  const {status, stream, errorMessage, start, stop} = useWhipSession(whipUrl);
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="publisher-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="publisher-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="publisher-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {stream !== null && (
        <View style={styles.videoContainer}>
          <RTCView
            testID="publisher-video"
            streamURL={stream.toURL()}
            objectFit="cover"
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

- [ ] **Step 4: Write the publisher tests (TDD)**

> **Timing & flushing note (read before writing the tests):** `start()` is async with multiple `await` points. Use **asynchronous** `act` everywhere a hook await must settle:
> - Make `pressStart` async: `async function pressStart(tree) { await ReactTestRenderer.act(async () => { findByTestID(tree.root, 'publisher-start').props.onPress(); }); }` and `await pressStart(tree)` at every call site. Make each `it` that calls `pressStart` `async`.
> - After `await pressStart(tree)`, the hook has flushed through `getUserMedia` (mock resolves immediately) and is suspended at `createOffer` (deferred). `setStream` has run, so the preview is already visible at that point.
> - Each deferred resolution (`resolveOffer(pc)`, `deferred.resolve(...)`, `fetchDeferred.reject(...)`) must be its own `await ReactTestRenderer.act(async () => {...})` block so the hook advances to the next suspension.
> - To test **Stop during media acquisition**, override `getUserMedia` to a deferred for that one test: `const gum = makeDeferred(); webrtc.mediaDevices.getUserMedia = jest.fn(() => gum.promise);` then `await pressStart`, assert suspended, press Stop, then `await act(async () => gum.resolve(localStream))` and assert the stale attempt does not call `setStream`.
> - The assertion invariants below are what must hold. Tune the flush sequence until they do.

Create `SRSRN/__tests__/PublisherScreen.test.tsx`:
```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {PublisherScreen} from '../features/whip/PublisherScreen';
import {DEFAULT_WHIP_URL} from '../features/whip/validation';
import {
  makeDeferred,
  okResponse,
  errorResponse,
  defaultAnswerSdp,
  type FetchResponse,
} from './util';

const webrtc = require('react-native-webrtc');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'publisher-video'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'Publisher-test',
    name: 'Publisher' as const,
    params: {whipUrl: DEFAULT_WHIP_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<PublisherScreen navigation={navigation} route={route} />);
  });
  return tree;
}

function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'publisher-start').props.onPress();
  });
}
function resolveOffer(pc: { _offerDeferred: { resolve: (v: unknown) => void } }) {
  ReactTestRenderer.act(() => {
    pc._offerDeferred.resolve({type: 'offer', sdp: 'v=0\r\n'});
  });
}

describe('PublisherScreen - no work before Start', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('creates no peer connection, media, or transceivers before Start', () => {
    render();
    expect(webrtc.RTCPeerConnection).not.toHaveBeenCalled();
    expect(webrtc.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});

describe('PublisherScreen - happy path', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
  });

  it('acquires camera+mic, adds send-only transceivers, posts SDP, and applies the answer', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);

    const pc = webrtc.__mockPCInstances[0];
    expect(pc.addTransceiver).toHaveBeenCalledWith('audio', {direction: 'sendonly'});
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', {direction: 'sendonly'});

    // getUserMedia resolves on the first act flush; preview appears.
    expect(webrtc.mediaDevices.getUserMedia).toHaveBeenCalledWith({video: true, audio: true});
    const localStream = webrtc.mediaDevices.getUserMedia.mock.results[0].value;
    expect(localStream.getTracks().length).toBe(2);
    expect(pc.addTrack).toHaveBeenCalledTimes(2);
    expect(hasVideo(tree.root)).toBe(true);

    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      DEFAULT_WHIP_URL,
      expect.objectContaining({
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: 'v=0\r\n',
      }),
    );
    expect(pc.setRemoteDescription).toHaveBeenCalled();
  });
});

describe('PublisherScreen - duplicate Start', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('creates only one peer connection when Start is pressed rapidly twice', () => {
    const tree = render();
    pressStart(tree);
    pressStart(tree);
    expect(webrtc.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });
});

describe('PublisherScreen - cancellation during each stage', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('Stop during media acquisition closes the pc and leaves no session', async () => {
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    // Stop before resolving createOffer (media already awaited via microtask).
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'publisher-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('Stop during HTTP negotiation aborts fetch and closes the pc', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    // Fetch is now in flight.
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'publisher-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
    // The aborted fetch should reject with AbortError and be ignored.
    await ReactTestRenderer.act(async () => {
      // No resolve; abort already rejected it via installAbortableFetch semantics.
    });
  });

  it('Stop during answer application closes the pc and leaves no session', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });
    expect(pc.setRemoteDescription).toHaveBeenCalled();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'publisher-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('unmount tears down any active session', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(pc.close).toHaveBeenCalled();
  });
});

describe('PublisherScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('a stale attempt completing does not close a newer attempt or replace its resources', async () => {
    const tree = render();
    await pressStart(tree); // attempt A -> A's preview shown, suspended at createOffer
    const pcA = webrtc.__mockPCInstances[0];
    // Stop A (stale). attemptRef becomes null; A's pc is closed and preview cleared.
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'publisher-stop').props.onPress();
    });
    await pressStart(tree); // attempt B -> B's preview shown, suspended at createOffer
    const pcB = webrtc.__mockPCInstances[1];
    expect(pcB).toBeDefined();

    // Now resolve A's offer. A resumes, sees it is no longer current, cleans up
    // only itself (idempotent), and returns without touching B or the UI.
    resolveOffer(pcA);
    expect(pcA.close).toHaveBeenCalled();
    expect(pcB.close).not.toHaveBeenCalled();
    // B's preview must still be showing - A's completion did not replace it.
    expect(hasVideo(tree.root)).toBe(true);
  });
});

describe('PublisherScreen - visible errors', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
  });

  it('a non-2xx HTTP response shows a user-visible error and cleans up', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(errorResponse(500, 'Server Error'));
    });
    expect(pc.close).toHaveBeenCalled();
    expect(findByTestID(tree.root, 'publisher-error').props.children).toContain('500');
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('a network failure shows a user-visible error and cleans up', async () => {
    const fetchDeferred = makeDeferred<FetchResponse>();
    global.fetch = jest.fn(() => fetchDeferred.promise) as unknown as typeof fetch;
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      fetchDeferred.reject(new Error('Network request failed'));
    });
    expect(pc.close).toHaveBeenCalled();
    expect(findByTestID(tree.root, 'publisher-error').props.children).toContain('Network');
  });
});

function installFetchOk() {
  const deferred = makeDeferred<FetchResponse>();
  global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
    const d = makeDeferred<FetchResponse>();
    if (opts && opts.signal) {
      const signal = opts.signal as AbortSignal;
      if (signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        d.reject(err);
      } else {
        signal.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          d.reject(err);
        });
      }
    }
    deferred.promise.then(d.resolve, d.reject);
    return d.promise;
  }) as unknown as typeof fetch;
  return {deferred};
}
```
Run `npm test -- PublisherScreen` - expect every test to pass after the hook and screen exist. If a timing assertion fails, adjust the number of `await act` flushes so each deferred resolution is its own `await act(async () => {...})` block.

- [ ] **Step 5: Run type-check, lint, and the WHIP tests**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test -- PublisherScreen whip-validation WhipUrlScreen
```
Expected: TypeScript passes, lint passes, all WHIP tests pass.

- [ ] **Step 6: Commit checkpoint**

```bash
git add SRSRN/features/whip/types.ts SRSRN/features/whip/useWhipSession.ts \
        SRSRN/features/whip/PublisherScreen.tsx SRSRN/__tests__/PublisherScreen.test.tsx
git commit -m "feat(srsrn): add WHIP publisher with generation-guarded session"
```


### Task 7: WHEP Player with Generation-Guarded Session

**Files:**
- Create: `SRSRN/features/whep/types.ts`
- Create: `SRSRN/features/whep/useWhepSession.ts`
- Create: `SRSRN/features/whep/PlayerScreen.tsx`
- Create: `SRSRN/__tests__/PlayerScreen.test.tsx`

**Interfaces:**
- Consumes: `RootStackParamList` route `Player` (`{whepUrl: string}`), `react-native-webrtc` (`RTCPeerConnection`, `MediaStream`, `RTCSessionDescription`, `RTCView`).
- Produces: a WHEP feature that creates receive-only transceivers, creates an empty `MediaStream`, collects remote tracks via the peer connection's `track` listener, POSTs the offer SDP, applies the plain-text answer, renders the remote stream, and tears down on Stop/unmount/failure. Start is explicit - entering Player does **not** create a peer connection.

- [ ] **Step 1: Define WHEP session types**

Create `SRSRN/features/whep/types.ts`:
```ts
import type {MediaStream} from 'react-native-webrtc';

export type WhepSessionStatus = 'idle' | 'starting' | 'active' | 'error';

export type UseWhepSessionResult = {
  status: WhepSessionStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
};
```

- [ ] **Step 2: Implement useWhepSession**

Create `SRSRN/features/whep/useWhepSession.ts`:
```ts
import React from 'react';
import {
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import type {WhepSessionStatus} from './types';

// react-native-webrtc 124.0.7 does not surface the peer connection's
// addEventListener overloads or its RTCTrackEvent in public typings.
type PCTrackEvent = {
  readonly track: MediaStreamTrack | null;
  readonly streams: MediaStream[];
};
type PCEventListener = {
  (type: 'iceconnectionstatechange', listener: (event: {readonly type: string}) => void): void;
  (type: 'track', listener: (event: PCTrackEvent) => void): void;
};
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

type Attempt = {
  id: number;
  pc: PCWithListener;
  stream: MediaStream;
  abort: AbortController;
  closed: boolean;
};

export function useWhepSession(whepUrl: string) {
  const [status, setStatus] = React.useState<WhepSessionStatus>('idle');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    try {
      attempt.abort.abort();
    } catch {
      // ignore
    }
    attempt.stream.getTracks().forEach(t => t.stop());
    attempt.pc.close();
  }, []);

  const stop = React.useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt) {
      cleanupAttempt(attempt);
    }
    attemptRef.current = null;
    setStream(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupAttempt]);

  const start = React.useCallback(async () => {
    if (attemptRef.current !== null) {
      return; // duplicate/concurrent Start guard
    }
    setErrorMessage(null);
    setStatus('starting');

    counterRef.current += 1;
    const pc = new RTCPeerConnection() as PCWithListener;
    const mediaStream = new MediaStream();
    const attempt: Attempt = {
      id: counterRef.current,
      pc,
      stream: mediaStream,
      abort: new AbortController(),
      closed: false,
    };
    attemptRef.current = attempt;

    try {
      pc.addEventListener('iceconnectionstatechange', () => {});
      pc.addTransceiver('audio', {direction: 'recvonly'});
      pc.addTransceiver('video', {direction: 'recvonly'});

      pc.addEventListener('track', event => {
        if (event.track) {
          mediaStream.addTrack(event.track);
          if (isCurrent(attempt)) {
            setStream(mediaStream);
          }
        }
      });

      const offer = await pc.createOffer();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await pc.setLocalDescription(offer);
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: offer.sdp,
        signal: attempt.abort.signal,
      });
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      if (!response.ok) {
        throw new Error(`Server responded ${response.status} ${response.statusText}`);
      }

      const answerSDP = await response.text();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await pc.setRemoteDescription(
        new RTCSessionDescription({type: 'answer', sdp: answerSDP}),
      );
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      setStatus('active');
    } catch (err) {
      if (attemptRef.current === attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setStream(null);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStatus('error');
      } else {
        cleanupAttempt(attempt);
      }
    }
  }, [whepUrl, isCurrent, cleanupAttempt]);

  React.useEffect(() => {
    return () => {
      const attempt = attemptRef.current;
      if (attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
      }
    };
  }, [cleanupAttempt]);

  return {status, stream, errorMessage, start, stop};
}
```

- [ ] **Step 3: Implement PlayerScreen**

Create `SRSRN/features/whep/PlayerScreen.tsx`:
```tsx
import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useWhepSession} from './useWhepSession';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({route}: Props): React.JSX.Element {
  const {whepUrl} = route.params;
  const {status, stream, errorMessage, start, stop} = useWhepSession(whepUrl);
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {stream !== null && (
        <View style={styles.videoContainer}>
          <RTCView
            testID="player-video"
            streamURL={stream.toURL()}
            objectFit="cover"
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

- [ ] **Step 4: Write the player tests (TDD)**

> **Timing & flushing note (read before writing the tests):** Same model as the WHIP suite. Make `pressStart` async (`await ReactTestRenderer.act(async () => { onPress(); })`) and `await` it at every call site. WHEP has no `getUserMedia`, so after `await pressStart(tree)` the hook is suspended at `createOffer`. Resolve one deferred per `await act(async () => {...})` block. `hasVideo` is `false` until a remote `track` event fires (simulated via `fireTrackEvent`), so the obsolete-attempt test correctly expects `hasVideo` to remain `false`.

Create `SRSRN/__tests__/PlayerScreen.test.tsx`:
```tsx
/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {PlayerScreen} from '../features/whep/PlayerScreen';
import {DEFAULT_WHEP_URL} from '../features/whep/validation';
import {
  makeDeferred,
  okResponse,
  errorResponse,
  defaultAnswerSdp,
  type FetchResponse,
} from './util';

const webrtc = require('react-native-webrtc');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'player-video'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'Player-test',
    name: 'Player' as const,
    params: {whepUrl: DEFAULT_WHEP_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<PlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}
function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'player-start').props.onPress();
  });
}
function resolveOffer(pc: { _offerDeferred: { resolve: (v: unknown) => void } }) {
  ReactTestRenderer.act(() => {
    pc._offerDeferred.resolve({type: 'offer', sdp: 'v=0\r\n'});
  });
}
function fireTrackEvent(pc: { addEventListener: jest.Mock }, track: unknown) {
  const calls = pc.addEventListener.mock.calls.filter(c => c[0] === 'track');
  expect(calls.length).toBe(1);
  ReactTestRenderer.act(() => {
    calls[0][1]({track, streams: []});
  });
}
function installFetchOk() {
  const deferred = makeDeferred<FetchResponse>();
  global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
    const d = makeDeferred<FetchResponse>();
    if (opts && opts.signal) {
      const signal = opts.signal as AbortSignal;
      if (signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        d.reject(err);
      } else {
        signal.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          d.reject(err);
        });
      }
    }
    deferred.promise.then(d.resolve, d.reject);
    return d.promise;
  }) as unknown as typeof fetch;
  return {deferred};
}

describe('PlayerScreen - no work before Start', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('creates no peer connection or transceivers before Start', () => {
    render();
    expect(webrtc.RTCPeerConnection).not.toHaveBeenCalled();
  });
});

describe('PlayerScreen - happy path', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
  });

  it('adds receive-only transceivers, posts SDP, applies the answer, and renders remote track', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    expect(pc.addTransceiver).toHaveBeenCalledWith('audio', {direction: 'recvonly'});
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', {direction: 'recvonly'});
    expect(webrtc.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });
    expect(pc.setRemoteDescription).toHaveBeenCalled();

    // Simulate the remote track arriving; the listener must render it.
    const remoteTrack = {id: 'remote-video', kind: 'video', stop: jest.fn()};
    fireTrackEvent(pc, remoteTrack);
    expect(hasVideo(tree.root)).toBe(true);
  });
});

describe('PlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('creates only one peer connection when Start is pressed rapidly twice', () => {
    const tree = render();
    pressStart(tree);
    pressStart(tree);
    expect(webrtc.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerScreen - cancellation during each stage', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('Stop during SDP creation closes the pc and leaves no session', () => {
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('Stop during HTTP negotiation aborts fetch and closes the pc', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('Stop during answer application closes the pc and leaves no session', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('unmount tears down any active session', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(okResponse(defaultAnswerSdp()));
    });
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(pc.close).toHaveBeenCalled();
  });
});

describe('PlayerScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('a stale attempt completing does not close a newer attempt or update UI', () => {
    const tree = render();
    pressStart(tree); // attempt A
    const pcA = webrtc.__mockPCInstances[0];
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    pressStart(tree); // attempt B
    const pcB = webrtc.__mockPCInstances[1];
    resolveOffer(pcA);
    expect(pcA.close).toHaveBeenCalled();
    expect(pcB.close).not.toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('PlayerScreen - visible errors', () => {
  beforeEach(() => {
    webrtc.__resetWebRtcMocks();
  });

  it('a non-2xx HTTP response shows a user-visible error and cleans up', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      deferred.resolve(errorResponse(503, 'Service Unavailable'));
    });
    expect(pc.close).toHaveBeenCalled();
    expect(findByTestID(tree.root, 'player-error').props.children).toContain('503');
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('a network failure shows a user-visible error and cleans up', async () => {
    const fetchDeferred = makeDeferred<FetchResponse>();
    global.fetch = jest.fn(() => fetchDeferred.promise) as unknown as typeof fetch;
    const tree = render();
    pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      fetchDeferred.reject(new Error('Network request failed'));
    });
    expect(pc.close).toHaveBeenCalled();
    expect(findByTestID(tree.root, 'player-error').props.children).toContain('Network');
  });
});
```
Run `npm test -- PlayerScreen` - expect pass. Adjust `await act` flush counts if needed so each deferred resolution is isolated.

- [ ] **Step 5: Run full JS verification**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test
```
Expected: TypeScript passes, lint passes, every Jest suite passes (App, Home, WHIP validation/screen, WHEP validation/screen, Publisher, Player).

- [ ] **Step 6: Commit checkpoint**

```bash
git add SRSRN/features/whep/types.ts SRSRN/features/whep/useWhepSession.ts \
        SRSRN/features/whep/PlayerScreen.tsx SRSRN/__tests__/PlayerScreen.test.tsx
git commit -m "feat(srsrn): add WHEP player with generation-guarded session and explicit Start"
```

---

### Task 8: iOS Native Configuration and Build

**Files:**
- Modify: `SRSRN/ios/SRSRN/Info.plist`
- Modify: `SRSRN/android/app/src/main/res/values/strings.xml` is Android (Task 9)
- Modify: `SRSRN/ios/SRSRN.xcodeproj/project.pbxproj` (display name / signing via Xcode)
- Regenerate: `SRSRN/ios/Podfile.lock`

**Interfaces:**
- Consumes: the JS app from Tasks 2-7 and the RN 0.86 native template.
- Produces: an Xcode workspace that builds and launches with display name `SRS RN`, camera + microphone usage descriptions, and local HTTP networking enabled.

- [ ] **Step 1: Set the display name to SRS RN**

Edit `SRSRN/ios/SRSRN/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>SRS RN</string>
```
Leave `CFBundleName` as `$(PRODUCT_NAME)`.

- [ ] **Step 2: Add camera and microphone usage descriptions**

In `SRSRN/ios/SRSRN/Info.plist`, ensure:
```xml
<key>NSCameraUsageDescription</key>
<string>Camera permission is required for video streaming</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone permission is required for audio streaming</string>
```

- [ ] **Step 3: Preserve local HTTP networking for the default endpoints**

In `SRSRN/ios/SRSRN/Info.plist`, ensure `NSAppTransportSecurity` allows local networking but keeps arbitrary loads off:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```
This matches the legacy apps and permits the `http://192.168.1.100:1985/...` defaults during development.

- [ ] **Step 4: Install CocoaPods**

```bash
cd SRSRN && pod install --project-directory=ios
```
Expected: pods install resolves React Native 0.86 and react-native-webrtc 124 without errors. If the template ships a `Gemfile`, prefer `bundle exec pod install --project-directory=ios` after `bundle install`.

- [ ] **Step 5: Open the workspace and configure signing**

Open `SRSRN/ios/SRSRN.xcworkspace` in Xcode, select the `SRSRN` target, and under **Signing & Capabilities** set a development Team and a bundle identifier that does not collide with `WHIPPublisher` or `WHEPPlayer`. Record the chosen bundle ID in the commit message.

- [ ] **Step 6: Build and run on a device**

```bash
cd SRSRN && npx react-native run-ios --device
```
If device selection is ambiguous, run `xcrun xctrace list devices` and pass the exact device name. Expected: the app compiles, installs, and launches into the `SRS RN` Home screen.

- [ ] **Step 7: Resolve only evidence-backed build failures**

For each failure, capture the first compiler/linker error, classify it (template drift, WebRTC, signing, or local Xcode setting), apply the narrowest correction, and rerun the build. Do not carry speculative workarounds.

- [ ] **Step 8: Commit checkpoint**

```bash
git add SRSRN/ios
git commit -m "feat(srsrn): configure iOS display name, permissions, and local networking"
```

### Task 9: Android Native Configuration Validation

**Files:**
- Modify: `SRSRN/android/app/src/main/AndroidManifest.xml`
- Modify: `SRSRN/android/app/src/main/res/values/strings.xml`
- Modify: `SRSRN/android/gradle.properties` (or `android/app/build.gradle` manifest placeholder) for cleartext

**Interfaces:**
- Consumes: the RN 0.86 Android template.
- Produces: a structurally valid Android project with camera, microphone, and Internet permissions and cleartext development traffic permitted. No emulator/device runtime claim.

- [ ] **Step 1: Add camera, microphone, and Internet permissions**

In `SRSRN/android/app/src/main/AndroidManifest.xml`, ensure inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

- [ ] **Step 2: Permit cleartext development traffic**

Keep the template's `android:usesCleartextTraffic="${usesCleartextTraffic}"` placeholder on the `<application>` element, and set the placeholder to `true` for development. In `SRSRN/android/gradle.properties` add (or in `android/app/build.gradle` `defaultConfig` `manifestPlaceholders`):
```
usesCleartextTraffic=true
```
This permits the `http://192.168.1.100:1985/...` defaults during development.

- [ ] **Step 3: Set the app name to SRS RN**

In `SRSRN/android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">SRS RN</string>
```

- [ ] **Step 4: Validate the Gradle configuration**

```bash
cd SRSRN/android && ./gradlew tasks --quiet
```
Expected: Gradle configures successfully and lists tasks. No Android runtime claim is made.

- [ ] **Step 5: Commit checkpoint**

```bash
git add SRSRN/android
git commit -m "feat(srsrn): configure Android permissions, app name, and cleartext"
```

### Task 10: Final Verification and Legacy-App Preservation Audit

**Files:**
- Review: all `SRSRN/` files
- Verify: `WHIPPublisher/` and `WHEPPlayer/` are untouched

**Interfaces:**
- Consumes: the completed app from Tasks 1-9.
- Produces: an auditable final status distinguishing verified work from device/endpoint-dependent checks.

- [ ] **Step 1: Verify exact dependency versions**

```bash
cd SRSRN && node -e "const p=require('./package.json'); console.log(p.dependencies.react, p.dependencies['react-native'], p.dependencies['react-native-webrtc'])"
```
Expected: `19.2.3 0.86.0 124.0.7`.

- [ ] **Step 2: Run the full automated suite**

```bash
cd SRSRN && npx tsc --noEmit && npm run lint && npm test -- --watchAll=false
```
Expected: TypeScript passes, lint passes, all Jest suites pass.

- [ ] **Step 3: Confirm legacy apps are unchanged**

```bash
git diff --stat -- WHIPPublisher WHEPPlayer
```
Expected: no output (nothing modified under either legacy app).

- [ ] **Step 4: Audit for template artifacts and whitespace errors**

```bash
git status --short
git diff --check
```
Expected: no whitespace errors; only `SRSRN/` and the plan/spec docs are touched.

- [ ] **Step 5: iOS functional checks (device and endpoint permitting)**

On the launched device:
1. Launch into the protocol-grid Home page.
2. Open WHIP, retain or edit its URL, press Start, confirm local preview/publishing, then press Stop.
3. Return Home and confirm publishing has ended.
4. Open WHEP, retain or edit its URL, press Start, confirm remote media, then press Stop.
5. Confirm navigation away ends playback.
6. Deny camera/microphone permission once and confirm the error is understandable and recoverable on retry.
7. Point the URL at an unreachable host and confirm the error is understandable and recoverable.

If a physical device or a reachable SRS endpoint at `192.168.1.100:1985` is unavailable, complete all automated and native build checks and explicitly report these manual steps as pending. Do not claim endpoint-dependent behavior was verified when it was not observed.

- [ ] **Step 6: Report verification faithfully**

List npm install, pod install, TypeScript, lint, Jest, Xcode build, app launch, WHIP publish, WHEP play, and Android Gradle outcomes separately. Mark unperformed device or SRS-dependent checks as pending rather than passing.

- [ ] **Step 7: Final commit**

```bash
git add SRSRN
git commit -m "test(srsrn): final verification and legacy-app preservation audit" --allow-empty
```
(Use `--allow-empty` only if there is nothing left to stage; otherwise omit it.)

---

## Self-Review Checklist

Before declaring the plan complete, verify each item against the approved specification:

- [ ] Every file in the spec's architecture tree is created (`App.tsx`, `navigation/RootNavigator.tsx`, `navigation/types.ts`, `screens/HomeScreen.tsx`, `launcher/features.ts`, `features/whip/{WhipUrlScreen,PublisherScreen,validation,types}.ts`, `features/whep/{WhepUrlScreen,PlayerScreen,validation,types}.ts`).
- [ ] `useWhipSession.ts` / `useWhepSession.ts` are feature-local media-lifecycle files (spec: "Each feature owns its ... media lifecycle"); no cross-protocol session abstraction exists.
- [ ] `DEFAULT_WHIP_URL` is byte-for-byte `http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream`.
- [ ] `DEFAULT_WHEP_URL` is byte-for-byte `http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream`.
- [ ] Home is the initial route; Home, WhipUrl, Publisher, WhepUrl, and Player all mount through the unified navigator.
- [ ] WHIP uses `sendonly` audio+video transceivers, `getUserMedia({video, audio})`, `addTrack`, `Content-Type: application/sdp`, plain-text answer SDP, `setRemoteDescription`, and local preview via `RTCView`.
- [ ] WHEP uses `recvonly` audio+video transceivers, an empty `MediaStream` populated in the `track` listener, the same SDP POST contract, and remote rendering via `RTCView`.
- [ ] Both features start only on explicit Start; no peer connection or negotiation before Start (WHEP explicitly replaces standalone auto-start).
- [ ] Each Start creates one uniquely identified attempt; duplicate Start is blocked (`attemptRef.current !== null`).
- [ ] `isCurrent(attempt)` is checked after every await; stale attempts return early and clean up their own resources without touching UI.
- [ ] `AbortController` is passed to `fetch` via `signal`; non-abortable operations are guarded by `isCurrent`.
- [ ] `cleanupAttempt` is idempotent (`closed` flag) and closes the pc, stops owned tracks, and aborts.
- [ ] Unmount (`useEffect` cleanup) tears down the active attempt for both features.
- [ ] Non-successful HTTP responses throw before `setRemoteDescription`; visible errors render via `publisher-error` / `player-error`.
- [ ] iOS display name is `SRS RN`; camera + microphone usage descriptions and `NSAllowsLocalNetworking` are present.
- [ ] Android adds `CAMERA`, `RECORD_AUDIO`, `INTERNET` permissions and permits cleartext development traffic; app name is `SRS RN`.
- [ ] No TODO/TBD/placeholders remain; every code block is complete and committed-ready.
- [ ] Type signatures are consistent: `RootStackParamList` matches route names and params used by every screen; `UseWhipSessionResult` / `UseWhepSessionResult` match what the screens destructure.
- [ ] `WHIPPublisher/` and `WHEPPlayer/` are never modified; `git diff --stat -- WHIPPublisher WHEPPlayer` is empty.

## Execution Options

After self-review, offer the user one of:

1. **Subagent-Driven Execution (Recommended)** - use `superpowers:subagent-driven-development` to implement task-by-task with verification between tasks.
2. **Inline Execution** - use `superpowers:executing-plans` to implement the plan step-by-step in this session.

Do not scaffold or implement `SRSRN/` until the user selects an execution mode.
