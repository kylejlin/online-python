import type { PyodideInterface } from "pyodide";

/* eslint-disable no-restricted-globals */

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

const consoleEntries: ConsoleEntry[] = [];

const pyodideProm = loadPyodide().then((pyodide) => {
  pyodide.setStdin({ stdin: handleStdinRequest });
  pyodide.setStdout({ write: handleStdoutRequest });
  pyodide.setStderr({ write: handleStderrRequest });
  return pyodide;
});

interface PyodideWorkerMessage {
  kind: "run";
  code: string;
}

type ConsoleEntryKind = "input" | "output" | "error";

interface ConsoleEntry {
  readonly kind: ConsoleEntryKind;
  readonly value: string;
}

self.onmessage = (event: MessageEvent<PyodideWorkerMessage>) => {
  const { data } = event;
  if (data.kind === "run") {
    pyodideProm.then((pyodide) => {
      try {
        consoleEntries.splice(0, consoleEntries.length);
        pyodide.runPython(data.code);
        self.postMessage({ succeeded: true, consoleEntries });
      } catch (error) {
        self.postMessage({
          succeeded: false,
          consoleEntries,
          errorString: String(error),
        });
      }
    });
    return;
  }

  throw new Error("Invalid message kind: " + data.kind);
};

function handleStdinRequest(): string {
  const fullConsoleText = consoleEntries
    .map((segment) => segment.value)
    .join("");
  const promptMessage = fullConsoleText.slice(
    fullConsoleText.lastIndexOf("\n") + 1
  );
  const raw = window.prompt(promptMessage) ?? "";
  const normalized = raw.endsWith("\n") ? raw : raw + "\n";
  const entry: ConsoleEntry = { kind: "input", value: normalized };
  consoleEntries.push(entry);
  return normalized;
}

function handleStdoutRequest(output: Uint8Array): number {
  const text = new TextDecoder().decode(output);
  const entry: ConsoleEntry = { kind: "output", value: text };
  consoleEntries.push(entry);
  return output.length;
}

function handleStderrRequest(output: Uint8Array): number {
  const text = new TextDecoder().decode(output);
  const entry: ConsoleEntry = { kind: "error", value: text };
  consoleEntries.push(entry);
  return output.length;
}

export {};
