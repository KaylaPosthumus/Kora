import React from "react";
import KoraBtn from "./buttons/KoraBtn";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time throws so one broken page does not white-screen the whole app.
 *
 * Error boundaries have no hook equivalent — `componentDidCatch` only exists on a
 * class — so this stays a class component.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="w-full h-full flex flex-col justify-center items-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Something went wrong</h1>
        <p className="text-zinc-500 max-w-md">
          This page failed to load. Reloading usually fixes it — if it keeps happening,
          the details are in the browser console.
        </p>
        {import.meta.env.DEV && (
          <pre className="max-w-2xl overflow-x-auto text-left text-xs text-zinc-500 bg-stone-100 p-4 rounded-lg">
            {error.message}
          </pre>
        )}
        <KoraBtn onClick={() => window.location.reload()}>Reload the page</KoraBtn>
      </div>
    );
  }
}

export default ErrorBoundary;
