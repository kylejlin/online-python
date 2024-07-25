import React from "react";
import "./App.css";
import { Editor, loader as monacoLoader } from "@monaco-editor/react";
import {
  InterruptSignalCode,
  MessageFromPyodideWorker,
  MessageFromPyodideWorkerKind,
  MessageToPyodideWorker,
  MessageToPyodideWorkerKind,
  PyodideWorkerSignalCode,
} from "./workerMessage";
import { CloseIcon, SettingsIcon } from "./icons";

monacoLoader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const LOCAL_STORAGE_CODE_KEY = "koja.pythonCode";
const LOCAL_STORAGE_SETTINGS_KEY = "koja.settings";

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")\n';
const DEFAULT_SETTINGS: KojaSettings = {
  clearConsoleOnRun: true,
};

const STDIN_BUFFER_SIZE = 400_000;

interface AppProps {}

interface AppState {
  readonly isPyodideWorkerReady: boolean;
  readonly editorValue: string;
  readonly consoleText: readonly ConsoleTextSegment[];
  readonly inputCompositionValue: string;
  readonly isConsoleInputFocused: boolean;
  readonly isRunningCode: boolean;
  readonly isSettingsMenuOpen: boolean;
  readonly isMouseOverSettingsMenu: boolean;
  readonly settings: KojaSettings;
}

type ConsoleTextSegmentKind = "stdin" | "stdout" | "stderr";

interface ConsoleTextSegment {
  readonly kind: ConsoleTextSegmentKind;
  readonly text: string;
}

interface KojaSettings {
  readonly clearConsoleOnRun: boolean;
}

export class App extends React.Component<AppProps, AppState> {
  manualIsMounted: boolean;
  isComposingInput: boolean;
  stdin: string;
  visiblyDeletableStdin: string;
  stdinBusBuffer: SharedArrayBuffer;
  waitBuffer: SharedArrayBuffer;
  interruptBuffer: SharedArrayBuffer;
  consoleInputRef: React.RefObject<HTMLInputElement>;

  typesafePostMessage: (message: MessageToPyodideWorker) => void;
  terminatePyodideWorker: () => void;

  constructor(props: AppProps) {
    super(props);

    this.bindMethods();

    this.state = {
      isPyodideWorkerReady: false,
      editorValue: getInitialEditorValue(),
      consoleText: [],
      inputCompositionValue: "",
      isConsoleInputFocused: false,
      isRunningCode: false,
      isSettingsMenuOpen: false,
      isMouseOverSettingsMenu: false,
      settings: getInitialSettings(),
    };

    this.manualIsMounted = false;

    this.isComposingInput = false;

    this.stdin = "";
    this.visiblyDeletableStdin = "";

    this.stdinBusBuffer = new SharedArrayBuffer(4 + STDIN_BUFFER_SIZE);
    this.waitBuffer = new SharedArrayBuffer(4);
    this.interruptBuffer = new SharedArrayBuffer(4);

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
      kind: MessageToPyodideWorkerKind.SetSharedBuffers,
      stdinBusBuffer: this.stdinBusBuffer,
      waitBuffer: this.waitBuffer,
      interruptBuffer: this.interruptBuffer,
    });
  }

  componentWillUnmount(): void {
    this.terminatePyodideWorker();

    this.manualIsMounted = false;
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleRunRequest = this.handleRunRequest.bind(this);
    this.handleInterruptRequest = this.handleInterruptRequest.bind(this);
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
    this.toggleSettingsMenuVisibility =
      this.toggleSettingsMenuVisibility.bind(this);
    this.handleDownloadCodeButtonClick =
      this.handleDownloadCodeButtonClick.bind(this);
    this.handleUploadCodeButtonClick =
      this.handleUploadCodeButtonClick.bind(this);
    this.handleSettingsButtonBlur = this.handleSettingsButtonBlur.bind(this);
    this.handleSettingsMenuMouseEnter =
      this.handleSettingsMenuMouseEnter.bind(this);
    this.handleSettingsMenuMouseLeave =
      this.handleSettingsMenuMouseLeave.bind(this);
    this.toggleAutomaticConsoleClearSetting =
      this.toggleAutomaticConsoleClearSetting.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header">
          <div className="HeaderItem SmallLeftMargin">
            {this.state.isPyodideWorkerReady ? (
              this.state.isRunningCode ? (
                <button
                  className="Button Button--red"
                  onClick={this.handleInterruptRequest}
                >
                  Stop
                </button>
              ) : (
                <button
                  className="Button Button--green"
                  onClick={this.handleRunRequest}
                >
                  Run
                </button>
              )
            ) : (
              <div className="PyodideLoadingNotification">Loading...</div>
            )}
          </div>

          <div className="HeaderItem SmallLeftMargin">
            <button className="Button" onClick={this.clearConsole}>
              Clear Console
            </button>
          </div>

          <div className="RightAlign">
            <div className="HeaderItem SmallRightMargin">
              <button
                className="ToggleSettingsMenuVisibilityButton"
                onClick={this.toggleSettingsMenuVisibility}
                onBlur={this.handleSettingsButtonBlur}
              >
                {this.state.isSettingsMenuOpen ? (
                  <CloseIcon
                    className="HeaderCloseSettingsIcon"
                    width="24"
                    height="24"
                  />
                ) : (
                  <SettingsIcon
                    className="HeaderOpenSettingsIcon"
                    width="24"
                    height="24"
                  />
                )}
              </button>
            </div>
          </div>
        </header>

        <section
          className={
            "SettingsMenu" +
            (this.state.isSettingsMenuOpen ? "" : " SettingsMenu--hidden")
          }
          onMouseEnter={this.handleSettingsMenuMouseEnter}
          onMouseLeave={this.handleSettingsMenuMouseLeave}
        >
          <div
            className="SettingsMenuItem"
            onClick={this.handleDownloadCodeButtonClick}
          >
            Download code
          </div>
          <div
            className="SettingsMenuItem"
            onClick={this.handleUploadCodeButtonClick}
          >
            Upload code
          </div>
          <div
            className="SettingsMenuItem"
            onClick={this.toggleAutomaticConsoleClearSetting}
          >
            <input
              type="checkbox"
              checked={this.state.settings.clearConsoleOnRun}
              readOnly
            />{" "}
            Clear console on run
          </div>
        </section>

        <main className="Main">
          <div className="EditorContainer">
            <Editor
              defaultLanguage="python"
              value={this.state.editorValue}
              onChange={this.handleEditorChange}
            />
          </div>

          <div
            className="ConsoleContainer"
            onClick={this.focusConsoleInputIfPossible}
          >
            <div className="Console">
              <span className="ConsoleText">
                {this.state.consoleText.map((segment) => (
                  <span className={"ConsoleTextSegment--" + segment.kind}>
                    {segment.text}
                  </span>
                ))}
              </span>
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
    localStorage.setItem(LOCAL_STORAGE_CODE_KEY, value);
  }

  handleRunRequest(): void {
    this.setState(
      (prevState) => ({
        isRunningCode: true,
        consoleText: prevState.settings.clearConsoleOnRun
          ? []
          : prevState.consoleText,
      }),
      () => {
        this.stdin = "";
        this.visiblyDeletableStdin = "";
        this.clearStdinBusBuffer();
        this.interruptPyodideWorker();
        this.typesafePostMessage({
          kind: MessageToPyodideWorkerKind.Run,
          code: this.state.editorValue,
        });
      }
    );
  }

  handleInterruptRequest(): void {
    this.interruptPyodideWorker();
    this.setState({ isRunningCode: false });
  }

  clearStdinBusBuffer(): void {
    Atomics.store(new Uint32Array(this.stdinBusBuffer), 0, 0);
  }

  interruptPyodideWorker(): void {
    Atomics.store(
      new Int32Array(this.interruptBuffer),
      0,
      InterruptSignalCode.Sigint
    );
    this.unsetWaitingFlag();
  }

  clearConsole(): void {
    this.setState({ consoleText: [] });
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
      consoleText: prevState.consoleText.concat([
        { kind: "stdin", text: inputValue },
      ]),
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

    if (data.kind === MessageFromPyodideWorkerKind.ExecutionSucceeded) {
      this.setState({ isRunningCode: false });
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.ExecutionError) {
      if (data.errorString.length === 0) {
        this.setState({ isRunningCode: false });
        return;
      }

      this.visiblyDeletableStdin = "";
      this.setState((prevState) => ({
        ...prevState,
        consoleText: prevState.consoleText.concat([
          { kind: "stderr", text: data.errorString },
        ]),
        isRunningCode: false,
      }));
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.StdinRequest) {
      this.transferStdinToSharedBufferIfWaitingFlagIsSet();
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.StdoutUpdate) {
      const newText = new TextDecoder().decode(data.output);
      if (newText.length === 0) {
        return;
      }

      this.visiblyDeletableStdin = "";
      this.setState(
        (prevState) => ({
          ...prevState,
          consoleText: prevState.consoleText.concat([
            { kind: "stdout", text: newText },
          ]),
        }),
        this.unsetWaitingFlag
      );
      return;
    }

    if (data.kind === MessageFromPyodideWorkerKind.StderrUpdate) {
      const newText = new TextDecoder().decode(data.output);
      if (newText.length === 0) {
        return;
      }

      this.visiblyDeletableStdin = "";
      this.setState(
        (prevState) => ({
          ...prevState,
          consoleText: prevState.consoleText.concat([
            { kind: "stderr", text: newText },
          ]),
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
      consoleText: prevState.consoleText.concat([
        { kind: "stdin", text: composedData },
      ]),
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
          consoleText: prevState.consoleText.concat([
            { kind: "stdout", text: "^R\n" },
            { kind: "stdin", text: getLastLine(newStdin) },
          ]),
        }));

        return;
      }

      this.stdin = withoutLastCharacter(this.stdin);
      this.visiblyDeletableStdin = withoutLastCharacter(
        this.visiblyDeletableStdin
      );
      this.setState((prevState) => ({
        ...prevState,
        consoleText: withoutLastCharacterRemovedFromLastSegment(
          prevState.consoleText
        ),
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
      consoleText: prevState.consoleText.concat([
        { kind: "stdin", text: "\n" },
      ]),
    }));
  }

  handleConsoleInputFocus(): void {
    this.setState({ isConsoleInputFocused: true });
  }

  handleConsoleInputBlur(): void {
    this.setState({ isConsoleInputFocused: false });
  }

  transferStdinToSharedBufferIfWaitingFlagIsSet(): void {
    const i32arr = new Int32Array(this.waitBuffer);
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
    )[0];

    const transferrable = this.stdin.slice(0, lastIndexOfNewline + 1);
    const transferrableBytes = new TextEncoder().encode(transferrable);
    this.stdin = this.stdin.slice(lastIndexOfNewline + 1);
    this.visiblyDeletableStdin = getLastLine(this.stdin);

    new Uint32Array(this.stdinBusBuffer)[0] =
      existingBusContentByteLength + transferrableBytes.byteLength;
    new Uint8Array(this.stdinBusBuffer, 4 + existingBusContentByteLength).set(
      transferrableBytes
    );

    this.unsetWaitingFlag();
  }

  unsetWaitingFlag(): void {
    const i32arr = new Int32Array(this.waitBuffer);
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

  toggleSettingsMenuVisibility(): void {
    this.setState((prevState) => ({
      ...prevState,
      isSettingsMenuOpen: !prevState.isSettingsMenuOpen,
    }));
  }

  handleDownloadCodeButtonClick(): void {
    const blob = new Blob([this.state.editorValue], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "main.py";
    a.click();

    this.setState({ isSettingsMenuOpen: false });
  }

  handleUploadCodeButtonClick(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".py";
    input.addEventListener("change", () => {
      const files = input.files ?? [];
      if (files.length === 0) {
        return;
      }

      const file = files[0];
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const text = reader.result as string;
        this.setState({ editorValue: text });
        localStorage.setItem(LOCAL_STORAGE_CODE_KEY, text);
      });
      reader.readAsText(file);
    });
    input.click();
    this.setState({ isSettingsMenuOpen: false });
  }

  handleSettingsButtonBlur(): void {
    this.setState((prevState) => {
      if (prevState.isMouseOverSettingsMenu) {
        return prevState;
      }

      return { ...prevState, isSettingsMenuOpen: false };
    });
  }

  handleSettingsMenuMouseEnter(): void {
    this.setState({ isMouseOverSettingsMenu: true });
  }

  handleSettingsMenuMouseLeave(): void {
    this.setState({ isMouseOverSettingsMenu: false });
  }

  toggleAutomaticConsoleClearSetting(): void {
    this.setState((prevState) => {
      const newSettings: KojaSettings = {
        ...prevState.settings,
        clearConsoleOnRun: !prevState.settings.clearConsoleOnRun,
      };
      localStorage.setItem(
        LOCAL_STORAGE_SETTINGS_KEY,
        JSON.stringify(newSettings)
      );
      return { ...prevState, settings: newSettings };
    });
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

function withoutLastCharacterRemovedFromLastSegment(
  segments: readonly ConsoleTextSegment[]
): readonly ConsoleTextSegment[] {
  const out = segments.filter((s) => s.text.length > 0);
  if (out.length === 0) {
    return out;
  }

  const lastSegment = out[out.length - 1];
  out[out.length - 1] = {
    ...lastSegment,
    text: withoutLastCharacter(lastSegment.text),
  };
  return out;
}

function getInitialEditorValue(): string {
  const storedCode = localStorage.getItem(LOCAL_STORAGE_CODE_KEY);
  if (storedCode !== null) {
    return storedCode;
  }

  return DEFAULT_EDITOR_VALUE;
}

function getInitialSettings(): KojaSettings {
  const storedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
  if (storedSettings === null) {
    return DEFAULT_SETTINGS;
  }

  try {
    const settings = JSON.parse(storedSettings);
    if (
      typeof settings === "object" &&
      settings !== null &&
      typeof settings.clearConsoleOnRun === "boolean"
    ) {
      return settings;
    }

    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
