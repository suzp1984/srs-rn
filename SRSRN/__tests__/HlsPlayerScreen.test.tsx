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
      video.__mockVideoInstances[0].__fireOnError({
        error: {errorString: 'Network request failed', localizedDescription: 'Network request failed'},
      });
    });
    expect(findByTestID(tree.root, 'hls-player-error').props.children).toContain('Network');
    expect(hasVideo(tree.root)).toBe(false);
  });
});
