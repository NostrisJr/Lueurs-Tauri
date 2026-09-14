import clsx from "clsx";
import { Component } from "react";
import type { ReactNode } from "react";
import { createLogger } from "../lib/logger";

const log = createLogger("EditorErrorBoundary");

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    log.error("crash éditeur", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <p className={clsx("font-semibold text-base", "text-danger")}>
          Erreur éditeur
        </p>
        <p className={clsx("text-sm text-center break-all", "text-ink-2")}>
          {error.message}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-accent text-on-inverse"
          )}
        >
          Réessayer
        </button>
      </div>
    );
  }
}
