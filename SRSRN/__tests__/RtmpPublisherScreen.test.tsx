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
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

  it('renders no RTMPPublisher and creates no instance before Start', () => {
    const tree = render();
    expect(rtmp.__mockRtmpInstances.length).toBe(0);
    expect(hasPreview(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

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
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

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
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

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
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(() => {
      ReactTestRenderer.act(() => instanceA.__fireOnConnectionSuccess(null));
    }).not.toThrow();
  });
});

describe('RtmpPublisherScreen - obsolete attempt isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

  it('a stale attempt late-arriving callbacks do not disturb the newer attempt', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    const instanceA = rtmp.__mockRtmpInstances[0];
    pressStop(tree); // Stop A
    await pressStart(tree); // attempt B
    const instanceB = rtmp.__mockRtmpInstances[1];
    ReactTestRenderer.act(() => {
      instanceA.__fireOnConnectionSuccess(null);
    });
    ReactTestRenderer.act(() => {
      instanceA.__fireOnConnectionFailed('stale');
    });
    expect(hasError(tree.root)).toBe(false);
    expect(hasPreview(tree.root)).toBe(true);
    ReactTestRenderer.act(() => {
      instanceB.__fireOnConnectionSuccess(null);
    });
    expect(hasPreview(tree.root)).toBe(true);
    expect(hasError(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - visible errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

  it('onConnectionFailed shows a user-visible error and unmounts the publisher', async () => {
    const tree = render();
    await pressStart(tree);
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[0].__fireOnConnectionFailed('handshake refused');
    });
    expect(findByTestID(tree.root, 'rtmp-publisher-error').props.children).toBe('handshake refused');
    expect(hasPreview(tree.root)).toBe(false);
  });
});

describe('RtmpPublisherScreen - idempotent cleanup and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rtmp.__resetRtmpMocks();
  });

  it('Stop then unmount is idempotent: no double-cleanup, no throw on late events', async () => {
    const tree = render();
    await pressStart(tree);
    const instance = rtmp.__mockRtmpInstances[0];
    pressStop(tree);
    expect(instance.stopStream).toHaveBeenCalledTimes(1);
    expect(() => {
      ReactTestRenderer.act(() => tree.unmount());
    }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnConnectionSuccess(null));
    }).not.toThrow();
    expect(() => {
      ReactTestRenderer.act(() => instance.__fireOnConnectionFailed('late'));
    }).not.toThrow();
  });

  it('a failed start leaves the screen ready for a fresh Start', async () => {
    const tree = render();
    await pressStart(tree); // attempt A
    ReactTestRenderer.act(() => {
      rtmp.__mockRtmpInstances[0].__fireOnConnectionFailed('first attempt failed');
    });
    expect(findByTestID(tree.root, 'rtmp-publisher-error').props.children).toBe('first attempt failed');
    expect(hasPreview(tree.root)).toBe(false);
    expect(tree.root.findAllByProps({testID: 'rtmp-publisher-start'}).length).toBeGreaterThan(0);
    await pressStart(tree); // attempt B
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
