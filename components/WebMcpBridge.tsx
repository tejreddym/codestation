"use client";

import { useEffect } from "react";
import { initWebMcp, registerActiveWebMcpTool } from "@/lib/webmcp/registry";
import { getTool } from "@/config/tools";
import type { RegisteredToolId } from "@/config/tools";

export default function WebMcpBridge({ toolId }: { toolId?: RegisteredToolId }) {
  useEffect(() => {
    initWebMcp();
    if (toolId) {
      const toolDef = getTool(toolId);
      if (toolDef) {
        const cleanup = registerActiveWebMcpTool(toolDef);
        return () => {
          cleanup();
        };
      }
    }
  }, [toolId]);

  return null;
}
