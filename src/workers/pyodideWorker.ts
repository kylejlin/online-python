import type { PyodideInterface } from "pyodide";
import {
  MessageFromPyodideWorker,
  MessageFromPyodideWorkerKind,
  MessageToPyodideWorker,
  MessageToPyodideWorkerKind,
  PyodideWorkerSignalCode,
} from "../workerMessage";

export {};

/* eslint-disable no-restricted-globals */

let resolvePyodideProm: (pyodide: PyodideInterface) => void = () => {
  throw new Error(
    "resolvePyodideProm was called before it was set by the Promise callback."
  );
};
let rejectPyodideProm: (error: Error) => void = (error) => {
  throw error;
};
const pyodideProm: Promise<PyodideInterface> = new Promise(
  (resolve, reject) => {
    resolvePyodideProm = resolve;
    rejectPyodideProm = reject;
  }
);

let stdin = "";

let sharedBuffer: undefined | SharedArrayBuffer;

self.onmessage = (event: MessageEvent<MessageToPyodideWorker>): void => {
  const { data } = event;

  if (data.kind === MessageToPyodideWorkerKind.SetSharedBuffer) {
    pyodideProm.then(() => {
      sharedBuffer = data.sharedBuffer;
      typesafePostMessage({ kind: MessageFromPyodideWorkerKind.WorkerReady });
    });
    return;
  }

  if (data.kind === MessageToPyodideWorkerKind.Run) {
    stdin = "";
    pyodideProm.then((pyodide) => {
      try {
        pyodide.runPython(data.code);
      } catch (error) {
        typesafePostMessage({
          kind: MessageFromPyodideWorkerKind.Error,
          errorString: String(error),
        });
      }
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _exhaustivenessCheck: never = data;
};

(self as any).importScripts(
  process.env.PUBLIC_URL + "/pyodide_0.26.1/pyodide.js"
);

const loadPyodide: (options?: {
  indexURL?: string;
  packageCacheDir?: string;
  lockFileURL?: string;
  fullStdLib?: boolean;
  stdLibURL?: string;
  stdin?: () => string;
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
  jsglobals?: object;
  args?: string[];
  env?: {
    [key: string]: string;
  };
  packages?: string[];
  pyproxyToStringRepr?: boolean;
  enableRunUntilComplete?: boolean;
  _node_mounts?: string[];
  _makeSnapshot?: boolean;
  _loadSnapshot?:
    | Uint8Array
    | ArrayBuffer
    | PromiseLike<Uint8Array | ArrayBuffer>;
}) => Promise<PyodideInterface> = (self as any).loadPyodide;

loadPyodide().then((pyodide) => {
  pyodide.setStdin({ stdin: handleStdinRequest });
  pyodide.setStdout({ write: handleStdoutRequest });
  pyodide.setStderr({ write: handleStderrRequest });
  resolvePyodideProm(pyodide);
}, rejectPyodideProm);

function handleStdinRequest(): string {
  if (sharedBuffer === undefined) {
    throw new Error("Called handleStdinRequest before sharedBuffer was set.");
  }

  while (true) {
    const indexOfFirstNewline = stdin.indexOf("\n");
    if (indexOfFirstNewline !== -1) {
      const line = stdin.slice(0, indexOfFirstNewline + 1);
      stdin = stdin.slice(indexOfFirstNewline + 1);
      return line;
    }

    const i32arr = new Int32Array(sharedBuffer);
    Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
    typesafePostMessage({ kind: MessageFromPyodideWorkerKind.StdinRequest });
    Atomics.wait(i32arr, 0, PyodideWorkerSignalCode.Waiting);

    const byteLength = new Uint32Array(sharedBuffer)[1];
    const newInputBytes = new Uint8Array(sharedBuffer, 8, byteLength);
    const newInputString = new TextDecoder().decode(newInputBytes.slice());
    stdin += newInputString;
  }
}

function handleStdoutRequest(output: Uint8Array): number {
  if (sharedBuffer === undefined) {
    throw new Error("Called handleStdoutRequest before sharedBuffer was set.");
  }

  const outputLength = output.length;

  const i32arr = new Int32Array(sharedBuffer);
  Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StdoutUpdate,
    output,
  });
  Atomics.wait(i32arr, 0, PyodideWorkerSignalCode.Waiting);

  return outputLength;
}

function handleStderrRequest(output: Uint8Array): number {
  if (sharedBuffer === undefined) {
    throw new Error("Called handleStderrRequest before sharedBuffer was set.");
  }

  const outputLength = output.length;

  const i32arr = new Int32Array(sharedBuffer);
  Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StderrUpdate,
    output,
  });
  Atomics.wait(i32arr, 0, PyodideWorkerSignalCode.Waiting);

  return outputLength;
}

function typesafePostMessage(message: MessageFromPyodideWorker): void {
  self.postMessage(message);
}
