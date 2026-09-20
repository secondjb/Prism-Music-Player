import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./App.css";

// Global frontend error bridge: forwards all runtime errors to Rust stderr / dev-output.log
const reportFrontendLog = (level: string, message: string) => {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    invoke("log_frontend_message", { level, message }).catch(() => {});
  }
};

window.addEventListener("error", (e) => {
  const msg = `${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ""}`;
  reportFrontendLog("WINDOW_ERROR", msg);
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = `Unhandled Rejection: ${e.reason?.stack || e.reason}`;
  reportFrontendLog("UNHANDLED_REJECTION", msg);
});

function safeFormatArg(a: any): string {
  if (a instanceof Error) {
    return `${a.name}: ${a.message}\n${a.stack || ""}`;
  }
  if (typeof HTMLElement !== "undefined" && a instanceof HTMLElement) {
    return `<${a.tagName.toLowerCase()}${a.id ? ` id="${a.id}"` : ""}${a.className ? ` class="${a.className}"` : ""}>`;
  }
  if (typeof a === "object" && a !== null) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(a, (_k, v) => {
        if (typeof v === "object" && v !== null) {
          if (typeof HTMLElement !== "undefined" && v instanceof HTMLElement) {
            return `<${v.tagName.toLowerCase()}>`;
          }
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      });
    } catch {
      return String(a);
    }
  }
  return String(a);
}

const origConsoleError = console.error;
console.error = (...args) => {
  try {
    origConsoleError(...args);
    const formatted = args.map(safeFormatArg).join(" ");
    reportFrontendLog("CONSOLE_ERROR", formatted);
  } catch {}
};

const origConsoleWarn = console.warn;
console.warn = (...args) => {
  try {
    origConsoleWarn(...args);
    const formatted = args.map(safeFormatArg).join(" ");
    reportFrontendLog("CONSOLE_WARN", formatted);
  } catch {}
};

const origConsoleLog = console.log;
console.log = (...args) => {
  try {
    origConsoleLog(...args);
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.startsWith('[Perf:') || first.startsWith('[AudioPerf:') || first.startsWith('[Frontend:')) {
      const formatted = args.map(safeFormatArg).join(" ");
      reportFrontendLog("INFO", formatted);
    }
  } catch {}
};

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = `Uncaught error in React component tree: ${error.toString()}\n${error.stack}\n${errorInfo.componentStack}`;
    origConsoleError("Uncaught error in React component tree:", error, errorInfo);
    reportFrontendLog("REACT_CRASH", msg);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-zinc-400 max-w-md font-mono bg-zinc-900 p-4 rounded-xl border border-white/10 text-left overflow-auto max-h-48 mb-4">
            {this.state.error?.toString() || "Unknown error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
          >
            Reload Player
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

