import React from "react";
import "./App.css";
import { Editor, loader as monacoLoader } from "@monaco-editor/react";
import {
  MessageFromPyodideWorker,
  MessageFromPyodideWorkerKind,
  MessageToPyodideWorker,
  MessageToPyodideWorkerKind,
  PyodideWorkerSignalCode,
} from "./workerMessage";

monacoLoader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")\nprint("Done")';

const STDIN_BUFFER_SIZE = 400_000;

interface AppProps {}

interface AppState {
  readonly isPyodideWorkerReady: boolean;
  readonly editorValue: string;
  readonly consoleText: string;
  readonly inputCompositionValue: string;
  readonly isConsoleInputFocused: boolean;
}

export class App extends React.Component<AppProps, AppState> {
  manualIsMounted: boolean;
  isComposingInput: boolean;
  stdin: string;
  visiblyDeletableStdin: string;
  stdinBusBuffer: SharedArrayBuffer;
  consoleInputRef: React.RefObject<HTMLInputElement>;

  typesafePostMessage: (message: MessageToPyodideWorker) => void;
  terminatePyodideWorker: () => void;

  constructor(props: AppProps) {
    super(props);

    this.bindMethods();

    this.state = {
      isPyodideWorkerReady: false,
      editorValue: DEFAULT_EDITOR_VALUE,
      consoleText: "",
      inputCompositionValue: "",
      isConsoleInputFocused: false,
    };

    this.manualIsMounted = false;

    this.isComposingInput = false;

    this.stdin = "";
    this.visiblyDeletableStdin = "";

    this.stdinBusBuffer = new SharedArrayBuffer(8 + STDIN_BUFFER_SIZE);

    this.consoleInputRef = React.createRef();

    this.typesafePostMessage = (): void => {
      throw new Error(
        "typesafePostMessage was called before it was initialized."
      );
    };

    this.terminatePyodideWorker = (): void => {};
  }

  componentDidMount(): void {
    this.manualIsMounted = true;

    const pyodideWorker = new Worker(
      new URL("./workers/pyodideWorker.ts", import.meta.url)
    );

    this.typesafePostMessage = (message: MessageToPyodideWorker): void => {
      pyodideWorker.postMessage(message);
    };
    this.terminatePyodideWorker = (): void => {
      pyodideWorker.terminate();
    };

    pyodideWorker.onmessage = this.handlePyodideWorkerMessage;

    this.typesafePostMessage({
      kind: MessageToPyodideWorkerKind.SetSharedBuffer,
      sharedBuffer: this.stdinBusBuffer,
    });
  }

  componentWillUnmount(): void {
    this.terminatePyodideWorker();

    this.manualIsMounted = false;
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleRunRequest = this.handleRunRequest.bind(this);
    this.clearConsole = this.clearConsole.bind(this);
    this.handleConsoleInputChange = this.handleConsoleInputChange.bind(this);
    this.handleConsoleInputCompositionStart =
      this.handleConsoleInputCompositionStart.bind(this);
    this.handleConsoleInputCompositionEnd =
      this.handleConsoleInputCompositionEnd.bind(this);
    this.handleConsoleInputKeydown = this.handleConsoleInputKeydown.bind(this);
    this.handleConsoleInputSubmit = this.handleConsoleInputSubmit.bind(this);
    this.handleConsoleInputFocus = this.handleConsoleInputFocus.bind(this);
    this.handleConsoleInputBlur = this.handleConsoleInputBlur.bind(this);
    this.handlePyodideWorkerMessage =
      this.handlePyodideWorkerMessage.bind(this);
    this.unsetWaitingFlag = this.unsetWaitingFlag.bind(this);
    this.focusConsoleInputIfPossible =
      this.focusConsoleInputIfPossible.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header">
          <div className="HeaderItem SmallLeftMargin">
            {this.state.isPyodideWorkerReady ? (
              <button
                className="Button Button--green"
                onClick={this.handleRunRequest}
              >
                Run
              </button>
            ) : (
              <div className="PyodideLoadingNotification">Loading...</div>
            )}
          </div>

          <div className="HeaderItem SmallLeftMargin">
            <button className="Button" onClick={this.clearConsole}>
              Clear Console
            </button>
          </div>
        </header>

        <main className="Main">
          <div className="EditorContainer">
            <Editor
              defaultLanguage="python"
              defaultValue={DEFAULT_EDITOR_VALUE}
              onChange={this.handleEditorChange}
            />
          </div>

          <div
            className="ConsoleContainer"
            onClick={this.focusConsoleInputIfPossible}
          >
            <div className="Console">
              <span className="ConsoleText">{this.state.consoleText}</span>
              {this.isComposingInput && (
                <span className="ConsoleText ConsoleText--compositionText">
                  {this.state.inputCompositionValue}
                </span>
              )}
              <span
                className={
                  "ConsoleCursor" +
                  (this.state.isConsoleInputFocused
                    ? " ConsoleCursor--focused"
                    : " ConsoleCursor--unfocused")
                }
              >
                M
              </span>

              <form
                className="ConsoleInputContainer"
                onSubmit={this.handleConsoleInputSubmit}
              >
                <input
                  className="ConsoleInput"
                  value={this.state.inputCompositionValue}
                  onChange={this.handleConsoleInputChange}
                  onCompositionStart={this.handleConsoleInputCompositionStart}
                  onCompositionEnd={this.handleConsoleInputCompositionEnd}
                  onKeyDown={this.handleConsoleInputKeydown}
                  onFocus={this.handleConsoleInputFocus}
                  onBlur={this.handleConsoleInputBlur}
                  ref={this.consoleInputRef}
                />
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  handleEditorChange(value: string | undefined): void {
    if (value === undefined) {
      return;
    }

    this.setState({
      editorValue: value,
    });
  }

  handleRunRequest(): void {
    this.stdin = "";
    this.visiblyDeletableStdin = "";
    this.unsetWaitingFlag();
    this.typesafePostMessage({
      kind: MessageToPyodideWorkerKind.Run,
      code: this.state.editorValue,
    });
  }

  clearConsole(): void {
    this.setState({ consoleText: "" });
  }

  handleConsoleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const inputValue = event.target.value;

    if (this.isComposingInput) {
      this.setState((prevState) => ({
        ...prevState,
        inputCompositionValue: inputValue,
      }));
      return;
    }

    this.stdin += inputValue;
    this.visiblyDeletableStdin = getLastLine(
      this.visiblyDeletableStdin + inputValue
    );
    this.setState((prevState) => ({
      ...prevState,
      consoleText: prevState.consoleText + inputValue,
      inputCompositionValue: "",
    }));
  }

  handlePyodideWorkerMessage(
    event: MessageEvent<MessageFromPyodideWorker>
  ): void {
    const { data } = event;

    if (data.kind === MessageFromPyodideWorkerKind.WorkerReady) {
      this.setState({
        isPyodideWorkerReady: true,
      });
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.Error) {
      if (data.errorString.length === 0) {
        return;
      }

      this.visiblyDeletableStdin = "";
      this.setState((prevState) => ({
        ...prevState,
        consoleText: prevState.consoleText + data.errorString,
      }));
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.StdinRequest) {
      this.transferStdinToSharedBufferIfWaitingFlagIsSet();
      return;
    }

    if (
      data.kind === MessageFromPyodideWorkerKind.StdoutUpdate ||
      data.kind === MessageFromPyodideWorkerKind.StderrUpdate
    ) {
      const newText = new TextDecoder().decode(data.output);
      if (newText.length === 0) {
        return;
      }

      this.visiblyDeletableStdin = "";
      this.setState(
        (prevState) => ({
          ...prevState,
          consoleText: prevState.consoleText + newText,
        }),
        this.unsetWaitingFlag
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _exhaustivenessCheck: never = data;
  }

  handleConsoleInputCompositionStart(): void {
    this.isComposingInput = true;
  }

  handleConsoleInputCompositionEnd(
    event: React.CompositionEvent<HTMLInputElement>
  ): void {
    const composedData = event.data;

    this.isComposingInput = false;

    this.stdin += composedData;
    this.visiblyDeletableStdin = getLastLine(
      this.visiblyDeletableStdin + composedData
    );
    this.setState((prevState) => ({
      ...prevState,
      consoleText: prevState.consoleText + composedData,
      inputCompositionValue: "",
    }));
  }

  handleConsoleInputKeydown(
    event: React.KeyboardEvent<HTMLInputElement>
  ): void {
    if (
      event.key === "Backspace" &&
      !this.isComposingInput &&
      getLastLine(this.stdin).length > 0
    ) {
      if (getLastLine(this.visiblyDeletableStdin).length === 0) {
        const newStdin = withoutLastCharacter(this.stdin);
        this.stdin = newStdin;
        this.visiblyDeletableStdin = getLastLine(newStdin);
        this.setState((prevState) => ({
          ...prevState,
          consoleText: prevState.consoleText + "^R\n" + getLastLine(newStdin),
        }));

        return;
      }

      this.stdin = withoutLastCharacter(this.stdin);
      this.visiblyDeletableStdin = withoutLastCharacter(
        this.visiblyDeletableStdin
      );
      this.setState((prevState) => ({
        ...prevState,
        consoleText: withoutLastCharacter(prevState.consoleText),
      }));
      return;
    }
  }

  handleConsoleInputSubmit(event: React.FormEvent): void {
    event.preventDefault();

    this.stdin += "\n";
    this.visiblyDeletableStdin = "";
    this.transferStdinToSharedBufferIfWaitingFlagIsSet();
    this.setState((prevState) => ({
      ...prevState,
      consoleText: prevState.consoleText + "\n",
    }));
  }

  handleConsoleInputFocus(): void {
    this.setState({ isConsoleInputFocused: true });
  }

  handleConsoleInputBlur(): void {
    this.setState({ isConsoleInputFocused: false });
  }

  transferStdinToSharedBufferIfWaitingFlagIsSet(): void {
    const i32arr = new Int32Array(this.stdinBusBuffer);
    if (Atomics.load(i32arr, 0) !== PyodideWorkerSignalCode.Waiting) {
      return;
    }

    // Since the other worker thread is waiting, we don't need to worry about
    // race conditions.
    // Thus, we can forgo the use of Atomics (except for unsetting the waiting flag).

    const lastIndexOfNewline = this.stdin.lastIndexOf("\n");
    if (lastIndexOfNewline === -1) {
      return;
    }

    const existingBusContentByteLength = new Uint32Array(
      this.stdinBusBuffer
    )[1];

    const transferrable = this.stdin.slice(0, lastIndexOfNewline + 1);
    const transferrableBytes = new TextEncoder().encode(transferrable);
    this.stdin = this.stdin.slice(lastIndexOfNewline + 1);
    this.visiblyDeletableStdin = getLastLine(this.stdin);

    new Uint32Array(this.stdinBusBuffer)[1] =
      existingBusContentByteLength + transferrableBytes.byteLength;
    new Uint8Array(this.stdinBusBuffer, 8 + existingBusContentByteLength).set(
      transferrableBytes
    );

    this.unsetWaitingFlag();
  }

  unsetWaitingFlag(): void {
    const i32arr = new Int32Array(this.stdinBusBuffer);
    Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Ready);
    Atomics.notify(i32arr, 0);
  }

  focusConsoleInputIfPossible(): void {
    const input = this.consoleInputRef.current;
    if (input === null) {
      return;
    }
    input.focus();
  }
}

function getLastLine(text: string): string {
  const lastIndexOfNewline = text.lastIndexOf("\n");
  if (lastIndexOfNewline === -1) {
    return text;
  }

  return text.slice(lastIndexOfNewline + 1);
}

function withoutLastCharacter(text: string): string {
  return text.replace(
    // I transpiled the modern regex `/.$/u` into an
    // "old-fashioned" regex (i.e., regex without Unicode flag support).
    // I used https://mothereff.in/regexpu for transpilation.
    // Below is the result:

    // eslint-disable-next-line no-control-regex
    /(?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])$/,
    ""
  );
}
