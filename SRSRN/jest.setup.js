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
