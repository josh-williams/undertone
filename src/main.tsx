import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Unable to load the app.</h1>
        <p>Saved colors remain on this device.</p>
        <button
          onClick={() => {
            location.hash = "";
            location.reload();
          }}
        >
          Reset view & reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
// Preserve the root when the entry module itself is hot-reloaded during development.
const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot)
  import.meta.hot.dispose((data) => {
    data.root = root;
  });
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
