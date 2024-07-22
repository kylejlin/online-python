import React from "react";
import "./App.css";
import { Editor, loader } from "@monaco-editor/react";
import { pyodide } from "./pyodide";

loader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")';

interface AppProps {}

pyodide.then((pyodide) => {
  console.log("loaded");
  console.log("test", pyodide.runPython("5+3"));
});

interface AppState {
  readonly editorValue: string;
  readonly isConsoleAcceptingInput: boolean;
  readonly consoleInputValue: string;
}

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    this.state = {
      editorValue: DEFAULT_EDITOR_VALUE,
      isConsoleAcceptingInput: false,
      consoleInputValue: "",
    };

    this.bindMethods();
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.handleConsoleInputChange = this.handleConsoleInputChange.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header">
          <button className="Button SmallSideMargin">Run</button>
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
}
