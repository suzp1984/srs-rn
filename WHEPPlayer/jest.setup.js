/* eslint-env jest */
jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn(),
  },
  MediaStream: jest.fn().mockImplementation(() => ({
    addTrack: jest.fn(),
    getTracks: jest.fn(() => []),
    toURL: jest.fn(() => ''),
    id: 'mock-stream',
  })),
  MediaStreamTrack: jest.fn(),
  RTCPeerConnection: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    addTransceiver: jest.fn(),
    addTrack: jest.fn(),
    createOffer: jest.fn(),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    close: jest.fn(),
  })),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
  RTCView: 'RTCView',
  RTCPIPView: 'RTCPIPView',
  registerGlobals: jest.fn(),
}));
