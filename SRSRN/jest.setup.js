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

jest.mock('react-native-video', () => {
  const React = require('react');
  const mockVideoInstances = [];

  function makeInstance() {
    const instance = {
      seek: jest.fn(),
      __onLoad: null,
      __onError: null,
      __fireOnLoad(payload) {
        if (instance.__onLoad) {
          instance.__onLoad(payload);
        }
      },
      __fireOnError(payload) {
        if (instance.__onError) {
          instance.__onError(payload);
        }
      },
    };
    mockVideoInstances.push(instance);
    return instance;
  }

  const Video = React.forwardRef((props, ref) => {
    const instanceRef = React.useRef(null);
    if (instanceRef.current === null) {
      instanceRef.current = makeInstance();
    }
    const instance = instanceRef.current;
    // Re-bind the latest onLoad/onError on every render so a per-attempt
    // closure (see useHlsSession) is what __fireOnLoad/__fireOnError invokes.
    instance.__onLoad = props.onLoad;
    instance.__onError = props.onError;
    React.useImperativeHandle(ref, () => instance, []);
    // NOTE: deliberately no cleanup effect that nulls __onLoad/__onError -
    // tests must be able to fire late events on a stale/unmounted instance to
    // verify the isCurrent guard drops them.
    return React.createElement('Video', {testID: props.testID});
  });

  return {
    __esModule: true,
    default: Video,
    Video,
    __mockVideoInstances: mockVideoInstances,
    __resetVideoMocks() {
      mockVideoInstances.length = 0;
    },
  };
});
