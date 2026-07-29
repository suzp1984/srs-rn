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

// pressStart is async: it awaits an asynchronous act so the hook flushes
// through the synchronous setup (pc, transceivers, listeners) and suspends
// at createOffer (deferred). After `await pressStart(tree)` the status is
// 'starting', the button is "Stop", and the PC is in __mockPCInstances[0].
async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'player-start').props.onPress();
  });
}

// resolveOffer is async: each deferred resolution must be its own `await act`
// block so the hook advances to the next suspension (here: fetch).
async function resolveOffer(pc: { _offerDeferred: { resolve: (v: unknown) => void } }) {
  await ReactTestRenderer.act(async () => {
    pc._offerDeferred.resolve({type: 'offer', sdp: 'v=0\r\n'});
  });
}

function fireTrackEvent(pc: { addEventListener: jest.Mock }, track: unknown) {
  const calls = pc.addEventListener.mock.calls.filter(c => c[0] === 'track');
  expect(calls.length).toBe(1);
  const listener = calls[0][1] as (event: {track: unknown; streams: unknown[]}) => void;
  ReactTestRenderer.act(() => {
    listener({track, streams: []});
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
    jest.clearAllMocks();
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
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
  });

  it('adds receive-only transceivers, posts SDP, applies the answer, and renders remote track', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    expect(pc.addTransceiver).toHaveBeenCalledWith('audio', {direction: 'recvonly'});
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', {direction: 'recvonly'});
    expect(webrtc.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    await resolveOffer(pc);
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
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('creates only one peer connection when Start is pressed rapidly twice', async () => {
    const tree = render();
    // Press Start twice within a single act block: state updates from the
    // first press (setStatus('starting')) are batched and not visible to the
    // second press, so both calls find the Start button. The duplicate guard
    // in start() sees attemptRef.current set and returns immediately.
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(webrtc.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerScreen - cancellation during each stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('Stop during SDP creation closes the pc and leaves no session', async () => {
    const tree = render();
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('Stop during HTTP negotiation aborts fetch and closes the pc', async () => {
    // installFetchOk wires an abort-aware fetch; we do not resolve the
    // deferred - the abort signal rejects it with AbortError.
    installFetchOk();
    const tree = render();
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
    // Flush the aborted fetch rejection (handled by the stale-attempt catch).
    await ReactTestRenderer.act(async () => {});
  });

  it('Stop during answer application closes the pc and leaves no session', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
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
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
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
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('a stale attempt completing does not close a newer attempt or update UI', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    const pcA = webrtc.__mockPCInstances[0];
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    await pressStart(tree); // attempt B
    const pcB = webrtc.__mockPCInstances[1];
    await resolveOffer(pcA);
    expect(pcA.close).toHaveBeenCalled();
    expect(pcB.close).not.toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);
  });

  it('a stale attempt late-arriving remote track does not render or replace the current UI', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    const pcA = webrtc.__mockPCInstances[0];
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'player-stop').props.onPress();
    });
    await pressStart(tree); // attempt B
    const pcB = webrtc.__mockPCInstances[1];
    // Stale attempt A's late-arriving remote track must not update UI or
    // disturb the active attempt B - the isCurrent(attempt) guard in the
    // track listener should short-circuit setStream.
    fireTrackEvent(pcA, {id: 'stale-video', kind: 'video', stop: jest.fn()});
    expect(hasVideo(tree.root)).toBe(false);
    expect(pcB.close).not.toHaveBeenCalled();
  });
});

describe('PlayerScreen - visible errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
  });

  it('a non-2xx HTTP response shows a user-visible error and cleans up', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
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
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
    await ReactTestRenderer.act(async () => {
      fetchDeferred.reject(new Error('Network request failed'));
    });
    expect(pc.close).toHaveBeenCalled();
    expect(findByTestID(tree.root, 'player-error').props.children).toContain('Network');
  });
});
