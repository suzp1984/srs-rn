# WHEPPlayer — Editable WHEP URL Start Page

Date: 2026-07-21
Scope: `WHEPPlayer/` app only. `WHIPPublisher/` is unchanged.

## Problem

Today the WHEP server URL is hardcoded in `WHEPPlayer/App.tsx:19`. Users cannot change the URL without rebuilding the app. We want a start page with an editable URL input, prefilled with the current hardcoded value, that navigates to the existing player once a valid URL is entered.

## Goals

- Add an initial URL entry screen with an editable `TextInput` prefilled with the current default URL.
- Strictly validate the input before letting the user proceed.
- Preserve today's WebRTC connect/teardown behavior on a dedicated player screen.
- Keep the WHEPPlayer app small, single-purpose, and easy to run under Jest.

## Non-goals

- No persistence of the URL between app launches.
- No history of recently used URLs.
- No new in-app error UI for connection failures beyond what exists today (`console.error` + early return).
- No changes to WHIPPublisher.

## Approach

Two screens managed by React Navigation's native stack.

- `UrlEntry` (initial route): text input + Connect button + inline validation error.
- `Player`: the existing WebRTC logic, parameterized on a `whepUrl` route param.

The user enters or edits the URL, taps Connect, and — on successful validation — is pushed onto the Player screen. The default back arrow (or the stop button) returns them to the URL entry screen, tearing down the peer connection on the way.

## Dependencies

Add to `WHEPPlayer/package.json`:

- `@react-navigation/native`
- `@react-navigation/native-stack`
- `react-native-screens`
- `react-native-gesture-handler`

`react-native-safe-area-context` is already a dependency. After `npm install`, run `pod install --project-directory=ios` for the native modules in `react-native-screens` and `react-native-gesture-handler`.

## File layout

```
WHEPPlayer/
├── App.tsx                       # NavigationContainer + stack + DEFAULT_WHEP_URL
├── types.ts                      # RootStackParamList
├── screens/
│   ├── UrlEntryScreen.tsx        # input + validator + Connect button
│   └── PlayerScreen.tsx          # existing WebRTC logic, param'd on whepUrl
└── __tests__/
    ├── App.test.tsx              # renders UrlEntry as initial route
    ├── PlayerScreen.test.tsx     # renders with fake route/navigation
    └── urlValidation.test.ts     # pure validator tests
```

### `App.tsx`

- Exports `DEFAULT_WHEP_URL` — the exact value currently at `App.tsx:19`:
  `http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream`.
- Wraps a `NavigationContainer` around a native stack with `UrlEntry` as initial route and `Player` as the second route.

### `types.ts`

```ts
export type RootStackParamList = {
  UrlEntry: undefined;
  Player: { whepUrl: string };
};
```

Kept at the top level so both screen files import it without a cycle.

### `screens/UrlEntryScreen.tsx`

- Local state: `url: string` (initialized to `DEFAULT_WHEP_URL`), `error: string | null`.
- Renders a `TextInput` with:
  - `value={url}` / `onChangeText={setUrl}`
  - `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`
  - `keyboardType="url"`
- Renders a `Button` labeled `Connect`. On press:
  1. Run `validateWhepUrl(url)`.
  2. If invalid, set `error` to the returned message.
  3. If valid, clear `error` and call `navigation.navigate('Player', { whepUrl })`.
- Renders an inline `<Text>` for `error` when non-null.
- Header title: `"WHEP URL"`.

Exports a pure validator (co-located in the same file or in a sibling `urlValidation.ts` — implementer's call):

```ts
export function validateWhepUrl(input: string):
  | { ok: true; url: string }
  | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: 'Please enter a URL' };
  let parsed: URL;
  try { parsed = new URL(trimmed); }
  catch { return { ok: false, message: 'Please enter a valid URL' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'URL must start with http:// or https://' };
  }
  return { ok: true, url: trimmed };
}
```

### `screens/PlayerScreen.tsx`

- Reads `whepUrl` from `route.params`.
- Holds the same `pc` / `stream` state and the same `startPlaying` / `stopPlaying` logic that lives in today's `App.tsx`, with two changes:
  1. `fetch(...)` uses `route.params.whepUrl` instead of the module-level constant.
  2. The `Stop` button calls `navigation.goBack()`; teardown lives in a `useEffect` cleanup that runs `stopPlaying`, so navigating back via gesture OR the stop button follows one teardown path.
- Auto-starts on mount via `useEffect` (was gated behind a button in today's app; here the URL screen is the "explicit start" gate).
- Renders the `RTCView` in the same 300×400 bordered container as today.
- Header title: `"Player"`. The default back arrow is provided by React Navigation.

## Data flow

```
UrlEntryScreen.state.url
  → validateWhepUrl(url)
  → navigation.navigate('Player', { whepUrl })
  → PlayerScreen route.params.whepUrl
  → fetch(whepUrl, { method: 'POST', body: offer.sdp })
```

No global state, no context, no persistence.

## Error handling

- **Validation errors**: shown inline on `UrlEntry`. User stays on that screen until validation passes.
- **WebRTC / fetch errors on `Player`**: unchanged from today — `console.error` and early return. The `useEffect` cleanup still tears down the peer connection when the user leaves the screen, so no leaked resources.

## Testing

Retarget the existing render test at the new initial screen and add two focused tests.

- `__tests__/App.test.tsx` — renders `<App />` (which now includes the `NavigationContainer`). Asserts no throw. This exercises the navigator wiring and confirms `UrlEntry` is the initial route.
- `__tests__/PlayerScreen.test.tsx` — renders `<PlayerScreen />` directly with fake `route` and `navigation` props (`{ params: { whepUrl: DEFAULT_WHEP_URL } }`, stub `navigation.goBack`). Asserts no throw. Preserves the render-level coverage that the current snapshot test provides for the WebRTC path.
- `__tests__/urlValidation.test.ts` — pure unit tests for `validateWhepUrl`:
  - empty / whitespace-only → `ok: false`
  - `"not a url"` → `ok: false`
  - `"ftp://host/x"` → `ok: false` (wrong scheme)
  - `DEFAULT_WHEP_URL` → `ok: true`
  - a valid `https://` URL → `ok: true`

If `react-native-screens`'s `enableScreens` misbehaves under Jest, mock it with `jest.mock('react-native-screens', ...)`; otherwise leave it. `react-native-webrtc` is already effectively noop under Jest, as relied on by the current snapshot test.

## Migration & rollout

- Single commit for the code change is fine; PR should note the new dependencies and the `pod install` step.
- No data migration — nothing is persisted.

## Open questions

None.
