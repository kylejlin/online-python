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
  readonly consoleInputValue: string;
}

export class App extends React.Component<AppProps, AppState> {
  manualIsMounted: boolean;
  isComposingInput: boolean;
  stdin: string;
  sharedBuffer: SharedArrayBuffer;

  typesafePostMessage: (message: MessageToPyodideWorker) => void;
  terminatePyodideWorker: () => void;

  constructor(props: AppProps) {
    super(props);

    this.bindMethods();

    this.state = {
      isPyodideWorkerReady: false,
      editorValue: DEFAULT_EDITOR_VALUE,
      consoleText: "",
      consoleInputValue: "",
    };

    this.manualIsMounted = false;

    this.isComposingInput = false;

    this.stdin = "";

    this.sharedBuffer = new SharedArrayBuffer(8 + STDIN_BUFFER_SIZE);

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
      sharedBuffer: this.sharedBuffer,
    });
  }

  componentWillUnmount(): void {
    this.terminatePyodideWorker();

    this.manualIsMounted = false;
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleRunRequest = this.handleRunRequest.bind(this);
    this.handleConsoleInputChange = this.handleConsoleInputChange.bind(this);
    this.handleConsoleInputCompositionStart =
      this.handleConsoleInputCompositionStart.bind(this);
    this.handleConsoleInputCompositionEnd =
      this.handleConsoleInputCompositionEnd.bind(this);
    this.handleConsoleInputKeydown = this.handleConsoleInputKeydown.bind(this);
    this.handlePyodideWorkerMessage =
      this.handlePyodideWorkerMessage.bind(this);
    this.unsetWaitingFlag = this.unsetWaitingFlag.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header">
          {this.state.isPyodideWorkerReady ? (
            <button
              className="Button SmallSideMargin"
              onClick={this.handleRunRequest}
            >
              Run
            </button>
          ) : (
            <div className="PyodideLoadingNotification SmallSideMargin">
              Loading...
            </div>
          )}
        </header>

        <main className="Main">
          <div className="EditorContainer">
            <Editor
              defaultLanguage="python"
              defaultValue={DEFAULT_EDITOR_VALUE}
              onChange={this.handleEditorChange}
            />
          </div>

          <div className="ConsoleContainer">
            <div className="Console">
              <span className={"ConsoleText"}>{this.state.consoleText}</span>

              <input
                className="ConsoleInput"
                size={Math.max(1, this.state.consoleInputValue.length)}
                value={this.state.consoleInputValue}
                onChange={this.handleConsoleInputChange}
                onCompositionStart={this.handleConsoleInputCompositionStart}
                onCompositionEnd={this.handleConsoleInputCompositionEnd}
                onKeyDown={this.handleConsoleInputKeydown}
              />
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
    this.unsetWaitingFlag();
    this.typesafePostMessage({
      kind: MessageToPyodideWorkerKind.Run,
      code: this.state.editorValue,
    });
  }

  handleConsoleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const inputValue = event.target.value;

    if (this.isComposingInput) {
      this.setState((prevState) => ({
        ...prevState,
        consoleInputValue: inputValue,
      }));
      return;
    }

    this.stdin += inputValue;
    this.setState((prevState) => ({
      ...prevState,
      consoleText: prevState.consoleText + inputValue,
      consoleInputValue: "",
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
      this.setState(
        (prevState) => ({
          ...prevState,
          consoleText:
            prevState.consoleText + new TextDecoder().decode(data.output),
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
    this.setState((prevState) => ({
      ...prevState,
      consoleText: prevState.consoleText + composedData,
      consoleInputValue: "",
    }));
  }

  handleConsoleInputKeydown(
    event: React.KeyboardEvent<HTMLInputElement>
  ): void {
    if (event.key === "Enter") {
      this.stdin += "\n";
      this.transferStdinToSharedBufferIfWaitingFlagIsSet();
      this.setState((prevState) => ({
        ...prevState,
        consoleText: prevState.consoleText + "\n",
        consoleInputValue: "",
      }));
    }
  }

  transferStdinToSharedBufferIfWaitingFlagIsSet(): void {
    const i32arr = new Int32Array(this.sharedBuffer);
    if (Atomics.load(i32arr, 0) !== PyodideWorkerSignalCode.Waiting) {
      return;
    }

    const stdinBytes = new TextEncoder().encode(this.stdin);
    this.stdin = "";

    Atomics.store(new Uint32Array(this.sharedBuffer), 1, stdinBytes.length);
    const stdinBytesView = new Uint8Array(this.sharedBuffer, 8);
    for (let i = 0; i < stdinBytes.length; ++i) {
      const byte = stdinBytes[i];
      Atomics.store(stdinBytesView, i, byte);
    }

    this.unsetWaitingFlag();
  }

  unsetWaitingFlag(): void {
    const i32arr = new Int32Array(this.sharedBuffer);
    Atomics.store(i32arr, 0, PyodideWorkerSignalCode.Ready);
    Atomics.notify(i32arr, 0);
  }
}
