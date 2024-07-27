import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import {
  InterruptSignalCode,
  MessageFromPyodideWorker,
  MessageFromPyodideWorkerKind,
  MessageToPyodideWorker,
  MessageToPyodideWorkerKind,
  PyodideWorkerSignalCode,
} from "../workerMessage";
import { KOJA_VERSION_WITHOUT_V } from "../version";

export {};

/* eslint-disable no-restricted-globals */

const OVERRIDDEN_EXIT_ERR_MSG =
  "exit() called. The default `exit` function is disabled.";

const OVERRIDDEN_QUIT_ERR_MSG =
  "quit() called. The default `quit` function is disabled.";

let exitAndQuitOverrides: undefined | PyProxy;

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

let setWaitingFlag: () => void = () => {};
let waitUntilMainThreadUnsetsWaitingFlag: () => void = () => {};

let clearInterruptSignal: () => void = () => {};
let checkInterruptSignal: () => void = () => {};

self.onmessage = (event: MessageEvent<MessageToPyodideWorker>): void => {
  const { data } = event;

  if (data.kind === MessageToPyodideWorkerKind.SetSharedBuffers) {
    pyodideProm.then((pyodide) => {
      stdinBusBuffer = data.stdinBusBuffer;

      const { waitBuffer } = data;
      setWaitingFlag = () => {
        Atomics.store(
          new Int32Array(waitBuffer),
          0,
          PyodideWorkerSignalCode.Waiting
        );
      };
      waitUntilMainThreadUnsetsWaitingFlag = () => {
        Atomics.wait(
          new Int32Array(waitBuffer),
          0,
          PyodideWorkerSignalCode.Waiting
        );
        checkInterruptSignal();
      };

      const { interruptBuffer } = data;
      pyodide.setInterruptBuffer(new Int32Array(interruptBuffer));
      clearInterruptSignal = () => {
        Atomics.store(
          new Int32Array(interruptBuffer),
          0,
          InterruptSignalCode.NoInterrupt
        );
      };
      checkInterruptSignal = () => {
        pyodide.checkInterrupt();
      };

      pyodide.registerJsModule("js", {});
      pyodide.registerJsModule("pyodide_js", {});
      pyodide.registerJsModule("koja", {
        print_info: () => {
          handleStdoutRequest(
            new TextEncoder().encode(
              `Koja v${KOJA_VERSION_WITHOUT_V}\nCopyright 2024 Kyle Lin.\n`
            )
          );
        },
      });

      typesafePostMessage({ kind: MessageFromPyodideWorkerKind.WorkerReady });
    });
    return;
  }

  if (data.kind === MessageToPyodideWorkerKind.Run) {
    stdin = "";

    clearInterruptSignal();

    pyodideProm.then((pyodide) => {
      // We need to override the `exit` and `quit` functions with
      // our custom implementation.
      // This is because the default `exit` and `quit` functions
      // cause Pyodide to not process subsequent code execution requests correctly.
      // Specifically, subsequent code execution requests will throw the error
      // `TypeError: Cannot read properties of undefined (reading 'callKwargs')`.
      //
      // I don't know why this is.
      // But in any case, it seems we must override the `exit` and `quit` functions
      // to prevent this.
      // If a future version of Pyodide fixes this issue, we can remove exitAndQuitOverrides.
      //
      // Our custom implementation of `exit` and `quit` will throw an error with a unique message.
      // The problem with this is that the error message will be printed to the console,
      // which is different then the expected behavior of `exit` and `quit`.
      //
      // So, in the `catch` clause of the `try` block that runs the user's code,
      // we will check if the thrown error contains OVERRIDDEN_EXIT_ERR_MSG or OVERRIDDEN_QUIT_ERR_MSG.
      // If it does, we send a OverriddenExitOrQuitCalledMessage  instead of an ExecutionErrorMessage.
      // This allows the main thread to distinguish between the user calling `exit` or `quit` and an actual error.
      // The main thread will only write to stderr in the latter case.

      exitAndQuitOverrides =
        exitAndQuitOverrides ??
        ((): PyProxy => {
          const overriddenExit = () => {
            throw new Error(OVERRIDDEN_EXIT_ERR_MSG);
          };
          overriddenExit.toString = () =>
            "Use exit() or Ctrl-D (i.e. EOF) to exit";

          const overriddenQuit = () => {
            throw new Error(OVERRIDDEN_QUIT_ERR_MSG);
          };
          overriddenQuit.toString = () => {
            "Use quit() or Ctrl-D (i.e. EOF) to exit";
          };
          return pyodide.toPy({
            exit: overriddenExit,
            quit: overriddenQuit,
          });
        })();

      try {
        pyodide.runPython(data.code, {
          locals: exitAndQuitOverrides,
          globals: exitAndQuitOverrides,
        });
        typesafePostMessage({
          kind: MessageFromPyodideWorkerKind.ExecutionSucceeded,
        });
      } catch (error) {
        const errorString = String(error);
        if (
          errorString.includes(OVERRIDDEN_EXIT_ERR_MSG) ||
          errorString.includes(OVERRIDDEN_QUIT_ERR_MSG)
        ) {
          typesafePostMessage({
            kind: MessageFromPyodideWorkerKind.OverriddenExitOrQuitCalled,
          });
          return;
        }

        typesafePostMessage({
          kind: MessageFromPyodideWorkerKind.ExecutionError,
          errorString,
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
      return line;
    }

    setWaitingFlag();
    typesafePostMessage({ kind: MessageFromPyodideWorkerKind.StdinRequest });
    waitUntilMainThreadUnsetsWaitingFlag();

    const byteLength = new Uint32Array(stdinBusBuffer)[0];
    const newInputBytes = new Uint8Array(stdinBusBuffer, 4, byteLength).slice();
    Atomics.store(new Uint32Array(stdinBusBuffer), 0, 0);
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

  setWaitingFlag();
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StdoutUpdate,
    output,
  });
  waitUntilMainThreadUnsetsWaitingFlag();

  return outputLength;
}

function handleStderrRequest(output: Uint8Array): number {
  if (stdinBusBuffer === undefined) {
    throw new Error(
      "Called handleStderrRequest before stdinBusBuffer was set."
    );
  }

  const outputLength = output.length;

  setWaitingFlag();
  typesafePostMessage({
    kind: MessageFromPyodideWorkerKind.StderrUpdate,
    output,
  });
  waitUntilMainThreadUnsetsWaitingFlag();

  return outputLength;
}

function typesafePostMessage(message: MessageFromPyodideWorker): void {
  self.postMessage(message);
}
