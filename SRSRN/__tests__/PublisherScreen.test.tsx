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

// pressStart is async: it awaits an asynchronous act so the hook flushes
// through getUserMedia (mock resolves immediately) and suspends at createOffer
// (deferred). After `await pressStart(tree)` the preview is already visible.
async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'publisher-start').props.onPress();
  });
}

// resolveOffer is async: each deferred resolution must be its own `await act`
// block so the hook advances to the next suspension (here: fetch).
async function resolveOffer(pc: { _offerDeferred: { resolve: (v: unknown) => void } }) {
  await ReactTestRenderer.act(async () => {
    pc._offerDeferred.resolve({type: 'offer', sdp: 'v=0\r\n'});
  });
}

describe('PublisherScreen - no work before Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
  });

  it('acquires camera+mic, adds send-only transceivers, posts SDP, and applies the answer', async () => {
    const {deferred} = installFetchOk();
    const tree = render();
    await pressStart(tree);

    const pc = webrtc.__mockPCInstances[0];
    expect(pc.addTransceiver).toHaveBeenCalledWith('audio', {direction: 'sendonly'});
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', {direction: 'sendonly'});

    // getUserMedia resolves on the first act flush; preview appears.
    expect(webrtc.mediaDevices.getUserMedia).toHaveBeenCalledWith({video: true, audio: true});
    // mock.results[0].value is the Promise returned by getUserMedia; await it
    // to inspect the resolved MediaStream.
    const localStream = await webrtc.mediaDevices.getUserMedia.mock.results[0].value;
    expect(localStream.getTracks().length).toBe(2);
    expect(pc.addTrack).toHaveBeenCalledTimes(2);
    expect(hasVideo(tree.root)).toBe(true);

    await resolveOffer(pc);
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
      const btn = findByTestID(tree.root, 'publisher-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(webrtc.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });
});

describe('PublisherScreen - cancellation during each stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webrtc.__resetWebRtcMocks();
    global.fetch = jest.fn(() => makeDeferred<FetchResponse>().promise) as unknown as typeof fetch;
  });

  it('Stop during media acquisition closes the pc and leaves no session', async () => {
    // Override getUserMedia with a deferred so we can stop mid-acquisition.
    // Capture a local stream from the default mock first (it is never used by
    // the stale attempt, but keeps the deferred type aligned with MediaStream).
    const localStream = await webrtc.mediaDevices.getUserMedia({video: true, audio: true});
    const gum = makeDeferred<typeof localStream>();
    webrtc.mediaDevices.getUserMedia = jest.fn(() => gum.promise) as never;

    const tree = render();
    await pressStart(tree); // suspended at getUserMedia (deferred)
    const pc = webrtc.__mockPCInstances[0];
    expect(hasVideo(tree.root)).toBe(false); // no preview yet

    // Press Stop while media acquisition is pending.
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'publisher-stop').props.onPress();
    });
    expect(pc.close).toHaveBeenCalled();
    expect(hasVideo(tree.root)).toBe(false);

    // Now resolve gum. The stale attempt must not call setStream.
    await ReactTestRenderer.act(async () => {
      gum.resolve(localStream);
    });
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
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
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

describe('PublisherScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    await resolveOffer(pcA);
    expect(pcA.close).toHaveBeenCalled();
    expect(pcB.close).not.toHaveBeenCalled();
    // B's preview must still be showing - A's completion did not replace it.
    expect(hasVideo(tree.root)).toBe(true);
  });
});

describe('PublisherScreen - visible errors', () => {
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
    await pressStart(tree);
    const pc = webrtc.__mockPCInstances[0];
    await resolveOffer(pc);
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
