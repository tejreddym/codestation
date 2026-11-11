"use client";

import React, { Component } from "react";
import type { ToolDefinition, ToolEngine, ToolResult, CustomCanvasSlotProps } from "@/lib/engine/types";
import { ToolErrorBanner } from "./ToolErrorBanner";

export type { CustomCanvasSlotProps };

export class ToolErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Error caught cleanly by boundary
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ToolErrorBanner
          error={this.state.error || new Error("Custom canvas crashed")}
          onDismiss={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function CanvasChild(props: CustomCanvasSlotProps & {
  customCanvas: (props: CustomCanvasSlotProps) => React.ReactNode;
}) {
  return <>{props.customCanvas(props)}</>;
}

export function CustomCanvasSlot({
  definition,
  engine,
  input,
  setInput,
  result,
  isProcessing,
  run,
  customCanvas,
}: CustomCanvasSlotProps & {
  customCanvas?: (props: CustomCanvasSlotProps) => React.ReactNode;
}) {
  if (!customCanvas) {
    return null;
  }

  return (
    <div
      className="custom-canvas-slot"
      data-testid="custom-canvas-slot"
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        background: "var(--surface)",
      }}
    >
      <ToolErrorBoundary>
        <CanvasChild
          definition={definition}
          engine={engine}
          input={input}
          setInput={setInput}
          result={result}
          isProcessing={isProcessing}
          run={run}
          customCanvas={customCanvas}
        />
      </ToolErrorBoundary>
    </div>
  );
}
