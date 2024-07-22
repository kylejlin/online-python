import React from "react";
import "./App.css";
import { Editor, loader } from "@monaco-editor/react";
import { pyodideProm, PyodideInterface } from "./pyodide";
import { ConsoleEntry, getGlobalConsoleEntries } from "./console";

loader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")';

interface AppProps {}

interface AppState {
  readonly hasPyodideLoaded: boolean;
  readonly editorValue: string;
  readonly terminalLog: readonly ConsoleEntry[];
}

export class App extends React.Component<AppProps, AppState> {
  pyodide: undefined | PyodideInterface;

  constructor(props: AppProps) {
    super(props);

    this.state = {
      hasPyodideLoaded: false,
      editorValue: DEFAULT_EDITOR_VALUE,
      terminalLog: [],
    };

    this.bindMethods();
  }

  componentDidMount(): void {
    pyodideProm.then((pyodide) => {
      this.pyodide = pyodide;
      this.setState({
        hasPyodideLoaded: true,
      });
    });
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleRunRequest = this.handleRunRequest.bind(this);
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
              {this.state.terminalLog.map((segment, index) => (
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
                  {segment.value + "\n"}
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
    console.log(value);
  }

  handleRunRequest(): void {
    this.pyodide!.runPython(this.state.editorValue);
    this.setState(() => ({
      terminalLog: getGlobalConsoleEntries(),
    }));
  }
}
