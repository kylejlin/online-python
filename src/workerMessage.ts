export enum MessageToPyodideWorkerKind {
  Run = "run",
  SetSharedBuffers = "setSharedBuffers",
}

export enum PyodideWorkerSignalCode {
  Waiting = 0,
  Ready = 1,
}

export type MessageToPyodideWorker = RunMessage | SetSharedBuffersMessage;

export interface RunMessage {
  readonly kind: MessageToPyodideWorkerKind.Run;
  readonly code: string;
}

export interface SetSharedBuffersMessage {
  readonly kind: MessageToPyodideWorkerKind.SetSharedBuffers;
  readonly stdinBusBuffer: SharedArrayBuffer;
  readonly interruptBuffer: SharedArrayBuffer;
}

export enum MessageFromPyodideWorkerKind {
  WorkerReady = "workerReady",
  Error = "error",
  StdinRequest = "stdinRequest",
  StdoutUpdate = "stdoutUpdate",
  StderrUpdate = "stderrUpdate",
}

export type MessageFromPyodideWorker =
  | WorkerReadyMessage
  | ExecutionErrorMessage
  | StdinRequestMessage
  | StdoutUpdateMessage
  | StderrUpdateMessage;

export interface WorkerReadyMessage {
  readonly kind: MessageFromPyodideWorkerKind.WorkerReady;
}

export interface ExecutionErrorMessage {
  readonly kind: MessageFromPyodideWorkerKind.Error;
  readonly errorString: string;
}

export interface StdinRequestMessage {
  readonly kind: MessageFromPyodideWorkerKind.StdinRequest;
}

export interface StdoutUpdateMessage {
  readonly kind: MessageFromPyodideWorkerKind.StdoutUpdate;
  readonly output: Uint8Array;
}

export interface StderrUpdateMessage {
  readonly kind: MessageFromPyodideWorkerKind.StderrUpdate;
  readonly output: Uint8Array;
}
