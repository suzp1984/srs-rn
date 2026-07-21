# WHIPPublisher — Editable WHIP URL Start Page

Date: 2026-07-21
Scope: `WHIPPublisher/` app only. `WHEPPlayer/` is unchanged.

## Problem

The WHIP server URL is hardcoded in `WHIPPublisher/App.tsx:19`. Users cannot change the URL without rebuilding the app. We want a start page with an editable URL input, prefilled with the current hardcoded value, that navigates to the existing publisher once a valid URL is entered. This mirrors the change already made to `WHEPPlayer/`.

## Goals

- Add an initial URL entry screen with an editable `TextInput` prefilled with the current default URL.
- Strictly validate the input before letting the user proceed.
- Preserve today's WebRTC publish/teardown behavior, including the explicit `Start` button, on a dedicated publisher screen.
- Keep the WHIPPublisher app small, single-purpose, and easy to run under Jest.

## Non-goals

- No persistence of the URL between app launches.
- No history of recently used URLs.
- No new in-app error UI for connection failures beyond what exists today (`console.error` + early return).
- No auto-start on the publisher screen — camera+mic access remains gated behind a `Start` button.
- No changes to WHEPPlayer.

## Approach

Two screens managed by React Navigation's native stack.

- `UrlEntry` (initial route): text input + Connect button + inline validation error.
- `Publisher`: the existing WebRTC logic, parameterized on a `whipUrl` route param. Keeps today's explicit `Start` / `Stop` buttons — camera+mic capture only begins when the user taps `Start`.

The user enters or edits the URL, taps `Connect`, and — on successful validation — is pushed onto the Publisher screen. The default back arrow returns them to the URL entry screen; a `useEffect` cleanup tears down the peer connection and stops all local tracks on unmount so the camera/mic light goes off whether the user tapped `Stop` first or not.

## Dependencies

Add to `WHIPPublisher/package.json`:

- `@react-navigation/native`
- `@react-navigation/native-stack`
- `react-native-screens`
- `react-native-gesture-handler`

`react-native-safe-area-context` is already a dependency. After `npm install`, run `pod install --project-directory=ios` for the native modules in `react-native-screens` and `react-native-gesture-handler`.

## File layout

```
WHIPPublisher/
├── App.tsx                       # NavigationContainer + stack + DEFAULT_WHIP_URL passthrough
├── urlValidation.ts              # DEFAULT_WHIP_URL + validateWhipUrl
├── types.ts                      # RootStackParamList
├── screens/
│   ├── UrlEntryScreen.tsx        # input + validator + Connect button
│   └── PublisherScreen.tsx       # existing WebRTC logic, param'd on whipUrl
└── __tests__/
    ├── App.test.tsx              # renders UrlEntry as initial route
    ├── PublisherScreen.test.tsx  # renders with fake route/navigation
    └── urlValidation.test.ts     # pure validator tests
```

### `urlValidation.ts`

```ts
export const DEFAULT_WHIP_URL =
  'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateWhipUrl(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return {ok: false, message: 'Please enter a URL'};
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

Identical rules and error strings to the WHEP validator — renamed only.

### `types.ts`

```ts
export type RootStackParamList = {
  UrlEntry: undefined;
  Publisher: {whipUrl: string};
};
```

### `App.tsx`

- Wraps a `NavigationContainer` around a native stack with `UrlEntry` as initial route and `Publisher` as the second route.
- Header titles: `WHIP URL` and `Publisher`.
- Imports `'react-native-gesture-handler'` at the very top (required by React Navigation).

### `screens/UrlEntryScreen.tsx`

- Local state: `url: string` (initialized to `DEFAULT_WHIP_URL`), `error: string | null`.
- Renders a `TextInput` with:
  - `value={url}` / `onChangeText={setUrl}`
  - `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`
  - `keyboardType="url"`
  - `testID="whip-url-input"`
- Renders a `Button` labeled `Connect` (`testID="whip-url-connect"`). On press:
  1. Run `validateWhipUrl(url)`.
  2. If invalid, set `error` to the returned message.
  3. If valid, clear `error` and call `navigation.navigate('Publisher', {whipUrl})`.
- Renders an inline `<Text testID="whip-url-error">` for `error` when non-null.

### `screens/PublisherScreen.tsx`

- Reads `whipUrl` from `route.params`.
- Holds the same `pc` / `stream` state and the same `startPublishing` / `stopPublishing` logic that lives in today's `App.tsx`, with two changes:
  1. `fetch(...)` uses `route.params.whipUrl` instead of the module-level constant.
  2. Teardown is centralized in a `useEffect` cleanup that runs `stopPublishing` — so navigating back via gesture, hardware back, or the `Stop` button follows one teardown path.
- **Keeps today's explicit `Start` / `Stop` buttons.** Does NOT auto-start on mount. Camera+mic capture only begins when the user taps `Start`.
- Uses a `cancelled` flag inside `startPublishing` to guard setState-after-unmount.
- Uses `pcRef` and `streamRef` so the cleanup effect can access the latest peer connection / stream without re-subscribing.
- Renders the `RTCView` in the same 300×400 bordered container as today.
- Preserves the `PCWithListener` / `PCEventListener` type shim from today's `App.tsx`.

## Data flow

```
UrlEntryScreen.state.url
  → validateWhipUrl(url)
  → navigation.navigate('Publisher', {whipUrl})
  → PublisherScreen route.params.whipUrl
  → user taps Start
  → fetch(whipUrl, {method: 'POST', body: offer.sdp})
```

No global state, no context, no persistence.

## Error handling

- **Validation errors**: shown inline on `UrlEntry`. User stays on that screen until validation passes. No preflight HTTP check on `Connect` — the Publisher screen's `fetch` is the real check, matching WHEP.
- **WebRTC / fetch errors on `Publisher`**: unchanged from today — `console.error` and early return. The `useEffect` cleanup still tears down the peer connection and stops all tracks when the user leaves the screen, so no leaked resources and the camera/mic indicator turns off.

## Testing

- `__tests__/App.test.tsx` — renders `<App />` (which now includes the `NavigationContainer`). Asserts no throw. Exercises navigator wiring; confirms `UrlEntry` is the initial route. Includes the same `jest.mock('react-native-gesture-handler', () => ({}))` + `@react-navigation/native` / `@react-navigation/native-stack` mocks as the WHEP suite.
- `__tests__/PublisherScreen.test.tsx` — renders `<PublisherScreen />` directly with fake `route` and `navigation` props (`{params: {whipUrl: DEFAULT_WHIP_URL}}`, stub `navigation.goBack`). Asserts no throw. Since capture is gated behind the `Start` button, this render test does not touch `getUserMedia`.
- `__tests__/urlValidation.test.ts` — pure unit tests for `validateWhipUrl`:
  - empty / whitespace-only → `ok: false`
  - `"not a url"` → `ok: false`
  - `"ftp://host/x"` → `ok: false` (wrong scheme)
  - `DEFAULT_WHIP_URL` → `ok: true`
  - a valid `https://` URL → `ok: true`

`react-native-webrtc` is already effectively noop under Jest, as relied on by the current snapshot test.

## Migration & rollout

- Single feature branch (`feature/whip-url-entry-screen`), merged to `main` on completion.
- PR notes the new dependencies and the `pod install` step.
- No data migration — nothing is persisted.

## Divergence from WHEP

- Publisher screen keeps the explicit `Start` button; WHEP auto-starts. Rationale: WHIP acquires camera+mic on start, so the user should arm capture explicitly. The URL entry screen is a routing gate, not a capture gate.
- Screen name is `Publisher` (not `Player`); route param key is `whipUrl` (not `whepUrl`); validator is `validateWhipUrl` (not `validateWhepUrl`); testIDs use the `whip-url-*` prefix.
- Otherwise the structure is verbatim WHEP.

## Open questions

None.
