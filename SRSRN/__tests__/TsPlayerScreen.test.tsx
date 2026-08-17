/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import {TsPlayerScreen} from '../features/ts/TsPlayerScreen';
import {DEFAULT_TS_URL} from '../features/ts/validation';

const vlc = require('react-native-vlc-media-player');

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasVideo(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'ts-video'}).length > 0;
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'ts-player-error'}).length > 0;
}

function render() {
  const navigation = {goBack: () => {}, navigate: () => {}, addListener: () => () => {}} as never;
  const route = {
    key: 'TsPlayer-test',
    name: 'TsPlayer' as const,
    params: {tsUrl: DEFAULT_TS_URL},
  } as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<TsPlayerScreen navigation={navigation} route={route} />);
  });
  return tree;
}

async function pressStart(tree: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    findByTestID(tree.root, 'ts-player-start').props.onPress();
  });
}
function pressStop(tree: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => {
    findByTestID(tree.root, 'ts-player-stop').props.onPress();
  });
}

describe('TsPlayerScreen - no work before Start', () => {
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

describe('TsPlayerScreen - happy path', () => {
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

describe('TsPlayerScreen - duplicate Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('creates only one VLCPlayer when Start is pressed rapidly twice', async () => {
    const tree = render();
    await ReactTestRenderer.act(async () => {
      const btn = findByTestID(tree.root, 'ts-player-start');
      btn.props.onPress();
      btn.props.onPress();
    });
    expect(vlc.__mockVlcInstances.length).toBe(1);
  });
});

describe('TsPlayerScreen - cancellation during each stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

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
    expect(tree.root.findAllByProps({testID: 'ts-player-start'}).length).toBeGreaterThan(0);
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

describe('TsPlayerScreen - obsolete attempt isolation', () => {
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

describe('TsPlayerScreen - visible errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('an onError event shows a generic user-visible error and unmounts the VLCPlayer', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      vlc.__mockVlcInstances[0].__fireOnError({target: 1});
    });
    expect(findByTestID(tree.root, 'ts-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
  });
});

describe('TsPlayerScreen - idempotent cleanup and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vlc.__resetVlcMocks();
  });

  it('Stop then unmount is idempotent: no double-cleanup, no throw on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instance = vlc.__mockVlcInstances[0];
    pressStop(tree);
    expect(instance.stopPlayer).toHaveBeenCalledTimes(1);
    expect(() => {
      ReactTestRenderer.act(() => tree.unmount());
    }).not.toThrow();
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
    expect(findByTestID(tree.root, 'ts-player-error').props.children).toBe('Playback error');
    expect(hasVideo(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'ts-player-start'}).length).toBeGreaterThan(0);
    await pressStart(tree); // attempt B
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
