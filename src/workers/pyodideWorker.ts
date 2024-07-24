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

let stdinBusBuffer: undefined | SharedArrayBuffer;

let clearInterruptSignal: () => void = () => {};
let checkInterruptSignal: () => void = () => {};

self.onmessage = (event: MessageEvent<MessageToPyodideWorker>): void => {
  const { data } = event;

  if (data.kind === MessageToPyodideWorkerKind.SetSharedBuffers) {
    pyodideProm.then((pyodide) => {
      stdinBusBuffer = data.stdinBusBuffer;

      const { interruptBuffer } = data;
      pyodide.setInterruptBuffer(new Int32Array(interruptBuffer));
      clearInterruptSignal = () => {
        Atomics.store(new Int32Array(interruptBuffer), 0, 0);
      };
      checkInterruptSignal = () => {
        pyodide.checkInterrupt();
      };

      typesafePostMessage({ kind: MessageFromPyodideWorkerKind.WorkerReady });
    });
    return;
  }

  if (data.kind === MessageToPyodideWorkerKind.Run) {
    stdin = "";

    clearInterruptSignal();

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
  if (stdinBusBuffer === undefined) {
    throw new Error("Called handleStdinRequest before stdinBusBuffer was set.");
  }

  while (true) {
    const indexOfFirstNewline = stdin.indexOf("\n");
    if (indexOfFirstNewline !== -1) {
      const line = stdin.slice(0, indexOfFirstNewline + 1);
      stdin = stdin.slice(indexOfFirstNewline + 1);
      console.log("returning stdin", line);
      return line;
    }

    const i32arr = new Int32Array(stdinBusBuffer);
    Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
    typesafePostMessage({ kind: MessageFromPyodideWorkerKind.StdinRequest });
    waitUntilStdinBusBufferIsReady();

    const byteLength = new Uint32Array(stdinBusBuffer)[1];
    const newInputBytes = new Uint8Array(stdinBusBuffer, 8, byteLength).slice();
    Atomics.store(new Uint32Array(stdinBusBuffer), 1, 0);
    const newInputString = new TextDecoder().decode(newInputBytes);
    stdin += newInputString;
  }
}

function handleStdoutRequest(output: Uint8Array): number {
  if (stdinBusBuffer === undefined) {
    throw new Error(
      "Called handleStdoutRequest before stdinBusBuffer was set."
    );
  }

  const outputLength = output.length;

  const i32arr = new Int32Array(stdinBusBuffer);
  Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StdoutUpdate,
    output,
  });
  waitUntilStdinBusBufferIsReady();

  return outputLength;
}

function handleStderrRequest(output: Uint8Array): number {
  if (stdinBusBuffer === undefined) {
    throw new Error(
      "Called handleStderrRequest before stdinBusBuffer was set."
    );
  }

  const outputLength = output.length;

  const i32arr = new Int32Array(stdinBusBuffer);
  Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Waiting);
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StderrUpdate,
    output,
  });
  waitUntilStdinBusBufferIsReady();

  return outputLength;
}

function typesafePostMessage(message: MessageFromPyodideWorker): void {
  self.postMessage(message);
}

function waitUntilStdinBusBufferIsReady(): void {
  if (stdinBusBuffer === undefined) {
    throw new Error(
      "Called waitUntilMainThreadUnsetsWaitingFlag before stdinBusBuffer was set."
    );
  }

  const i32arr = new Int32Array(stdinBusBuffer);
  Atomics.wait(i32arr, 0, PyodideWorkerSignalCode.Waiting);
  checkInterruptSignal();
}
