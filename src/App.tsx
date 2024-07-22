import React from "react";
import "./App.css";
import { Editor, loader } from "@monaco-editor/react";
import { pyodideProm, PyodideInterface, simulatedStdout } from "./pyodide";

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
  readonly isConsoleAcceptingInput: boolean;
  readonly consoleInputValue: string;
}

export class App extends React.Component<AppProps, AppState> {
  pyodide: undefined | PyodideInterface;

  constructor(props: AppProps) {
    super(props);

    this.state = {
      hasPyodideLoaded: false,
      editorValue: DEFAULT_EDITOR_VALUE,
      isConsoleAcceptingInput: false,
      consoleInputValue: "",
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
    this.handleConsoleInputChange = this.handleConsoleInputChange.bind(this);
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
              <span className="ConsoleOutput">{DEFAULT_EDITOR_VALUE}</span>
              {this.state.isConsoleAcceptingInput && (
                <input
                  className="ConsoleInput"
                  size={Math.max(1, this.state.consoleInputValue.length)}
                  value={this.state.consoleInputValue}
                  onChange={this.handleConsoleInputChange}
                />
              )}
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

  handleConsoleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({
      consoleInputValue: event.target.value,
    });
  }

  handleRunRequest(): void {
    simulatedStdout.splice(0, simulatedStdout.length);
    this.pyodide!.runPython(this.state.editorValue);
  }
}
