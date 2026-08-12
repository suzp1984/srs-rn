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

describe('RtmpPlayerScreen - happy path', () => {
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

describe('RtmpPlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

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
    expect(tree.root.findAllByProps({testID: 'rtmp-player-start'}).length).toBeGreaterThan(0);
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

describe('RtmpPlayerScreen - obsolete attempt isolation', () => {
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

describe('RtmpPlayerScreen - visible errors', () => {
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
    expect(findByTestID(tree.root, 'rtmp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('RtmpPlayerScreen - idempotent cleanup and recovery', () => {
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
    expect(findByTestID(tree.root, 'rtmp-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-player-start'}).length).toBeGreaterThan(0);
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
