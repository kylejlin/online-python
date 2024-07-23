import React from "react";
import "./App.css";
import { Editor, loader } from "@monaco-editor/react";
import { pyodideProm, PyodideInterface } from "./pyodide";

loader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")\nprint("Done")';

interface AppProps {}

interface AppState {
  readonly hasPyodideLoaded: boolean;
  readonly editorValue: string;
  readonly consoleEntries: readonly ConsoleEntry[];
}

type ConsoleEntryKind = "input" | "output" | "error";

interface ConsoleEntry {
  readonly kind: ConsoleEntryKind;
  readonly value: string;
}

export class App extends React.Component<AppProps, AppState> {
  pyodide: undefined | PyodideInterface;
  pyodideWorker: undefined | Worker;

  synchronousConsoleEntries: ConsoleEntry[];

  constructor(props: AppProps) {
    super(props);

    this.state = {
      hasPyodideLoaded: false,
      editorValue: DEFAULT_EDITOR_VALUE,
      consoleEntries: [],
    };

    this.synchronousConsoleEntries = [];

    this.bindMethods();
  }

  componentDidMount(): void {
    pyodideProm.then((pyodide) => {
      pyodide.setStdin({ stdin: this.handleStdinRequest });
      pyodide.setStdout({ write: this.handleStdoutRequest });
      pyodide.setStderr({ write: this.handleStderrRequest });

      this.pyodide = pyodide;

      this.setState({
        hasPyodideLoaded: true,
      });
    });

    const pyodideWorker = new Worker(
      new URL("./workers/pyodideWorker.ts", import.meta.url)
    );
    pyodideWorker.onmessage = (event) => {
      console.log("worker response received", event.data);
    };
    this.pyodideWorker = pyodideWorker;
  }

  componentWillUnmount(): void {
    this.pyodideWorker?.terminate();
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleRunRequest = this.handleRunRequest.bind(this);
    this.handleStdinRequest = this.handleStdinRequest.bind(this);
    this.handleStdoutRequest = this.handleStdoutRequest.bind(this);
    this.handleStderrRequest = this.handleStderrRequest.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header">
          {this.state.hasPyodideLoaded ? (
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
              {this.state.consoleEntries.map((segment, index) => (
                <span
                  className={
                    "ConsoleText" +
                    (segment.kind === "input"
                      ? " ConsoleText--stdin"
                      : segment.kind === "error"
                      ? " ConsoleText--stderr"
                      : " ConsoleText--stdout")
                  }
                  key={index}
                >
                  {segment.value}
                </span>
              ))}
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
    if (this.pyodideWorker !== undefined) {
      this.pyodideWorker.postMessage({
        kind: "run",
        code: this.state.editorValue,
      });
    }

    this.synchronousConsoleEntries = [];
    this.setState({ consoleEntries: [] }, () => {
      try {
        this.pyodide!.runPython(this.state.editorValue);
      } catch (error) {
        this.setState((prevState) => ({
          ...prevState,
          consoleEntries: prevState.consoleEntries.concat([
            { kind: "error", value: String(error) },
          ]),
        }));
      }
    });
  }

  handleStdinRequest(): string {
    const fullConsoleText = this.synchronousConsoleEntries
      .map((segment) => segment.value)
      .join("");
    const promptMessage = fullConsoleText.slice(
      fullConsoleText.lastIndexOf("\n") + 1
    );
    const raw = window.prompt(promptMessage) ?? "";
    const normalized = raw.endsWith("\n") ? raw : raw + "\n";
    const entry: ConsoleEntry = { kind: "input", value: normalized };
    this.setState((prevState) => ({
      ...prevState,
      consoleEntries: prevState.consoleEntries.concat([entry]),
    }));
    this.synchronousConsoleEntries.push(entry);
    return normalized;
  }

  handleStdoutRequest(output: Uint8Array): number {
    const text = new TextDecoder().decode(output);
    const entry: ConsoleEntry = { kind: "output", value: text };
    this.setState((prevState) => ({
      ...prevState,
      consoleEntries: prevState.consoleEntries.concat([entry]),
    }));
    this.synchronousConsoleEntries.push(entry);
    return output.length;
  }

  handleStderrRequest(output: Uint8Array): number {
    const text = new TextDecoder().decode(output);
    const entry: ConsoleEntry = { kind: "error", value: text };
    this.setState((prevState) => ({
      ...prevState,
      consoleEntries: prevState.consoleEntries.concat([entry]),
    }));
    this.synchronousConsoleEntries.push(entry);
    return output.length;
  }
}
