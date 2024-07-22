import React from "react";
import "./App.css";
import { Editor, loader } from "@monaco-editor/react";

loader.config({
  paths: {
    vs: process.env.PUBLIC_URL + "/monaco_support_0.46.0/min/vs",
  },
});

const DEFAULT_EDITOR_VALUE =
  'x = int(input("Enter a number: "))\ny = int(input("Enter a second number: "))\nz = x + y\nprint(f"The sum of the two numbers is {z}")';

interface AppProps {}

interface AppState {
  readonly editorValue: string;
}

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    this.state = {
      editorValue: DEFAULT_EDITOR_VALUE,
    };

    this.bindMethods();
  }

  bindMethods(): void {
    this.handleEditorChange = this.handleEditorChange.bind(this);
  }

  render() {
    return (
      <div className="App">
        <header className="Header"></header>

        <main className="Main">
          <div className="EditorContainer">
            <Editor
              defaultLanguage="python"
              defaultValue={DEFAULT_EDITOR_VALUE}
              onChange={this.handleEditorChange}
            />
          </div>

          <div className="Console"></div>
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
}
