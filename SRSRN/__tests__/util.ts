export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function makeDeferred<T = unknown>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

export type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

export function okResponse(sdp: string): FetchResponse {
  return {ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(sdp)};
}

export function errorResponse(status: number, statusText: string): FetchResponse {
  return {ok: false, status, statusText, text: () => Promise.resolve('')};
}

const ANSWER_SDP = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=mid:0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=mid:1\r\n';

export function defaultAnswerSdp(): string {
  return ANSWER_SDP;
}
