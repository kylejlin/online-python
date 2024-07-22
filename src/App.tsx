import React from "react";
import "./App.css";
import Editor from "@monaco-editor/react";

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
        <Editor
          height="90vh"
          defaultLanguage="python"
          defaultValue={DEFAULT_EDITOR_VALUE}
          onChange={this.handleEditorChange}
        />
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
