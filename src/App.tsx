import React from "react";
import "./App.css";
import Editor from "@monaco-editor/react";

function App() {
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

export default App;
