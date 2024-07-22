import React from "react";
import "./App.css";
import Editor from "@monaco-editor/react";

interface AppProps {}

interface AppState {}

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className="App">
        <Editor
          height="90vh"
          defaultLanguage="python"
          defaultValue="# Some comment"
        />
      </div>
    );
  }
}
