"use client";

import React from "react";
import type { ToolDefinition, ToolEngine } from "@/lib/engine/types";
import { resolveToolKey } from "@/lib/engine/adapters/registryAdapter";
import { UniversalToolShell } from "./UniversalToolShell";

export interface DynamicToolRouteProps {
  slug: string;
  getToolFn: (slugOrId: string) => ToolDefinition | null;
  getEngineFn: (slugOrId: string) => ToolEngine | null;
  onWorkflowChain?: (output: unknown) => void;
}

export function DynamicToolRoute({
  slug,
  getToolFn,
  getEngineFn,
  onWorkflowChain,
}: DynamicToolRouteProps) {
  const resolvedKey = resolveToolKey(slug);
  const definition = getToolFn(resolvedKey) || getToolFn(slug);

  if (!definition) {
    return (
      <main className="shell not-found-page p-12 text-center" data-testid="not-found-page">
        <h1 className="text-3xl font-bold text-stone-800">404</h1>
        <p className="text-stone-600 mt-2">Tool Not Found: {slug}</p>
      </main>
    );
  }

  const engine = getEngineFn(resolvedKey) || getEngineFn(slug);
  if (!engine) {
    return (
      <main className="shell not-found-page p-12 text-center" data-testid="not-found-page">
        <h1 className="text-3xl font-bold text-stone-800">404</h1>
        <p className="text-stone-600 mt-2">Engine Not Found: {slug}</p>
      </main>
    );
  }

  const canonicalUrl = `https://codestation.in/tools/${definition.slug || definition.id}`;

  const geoSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: definition.name,
    description: definition.description,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: definition.category,
    operatingSystem: "All (Web Browser)",
    browserRequirements: "Requires JavaScript. 100% In-Browser. Zero Server Uploads.",
    url: canonicalUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const aeoFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What does ${definition.name} do?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${definition.description} 100% private in-browser computation.`,
        },
      },
      {
        "@type": "Question",
        name: `Is my data private when using ${definition.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. All computations run in the browser without server uploads or external telemetry.",
        },
      },
    ],
  };

  return (
    <main className="shell dynamic-tool-page py-6" data-testid="dynamic-tool-page">
      <link rel="canonical" href={canonicalUrl} data-testid="seo-canonical" />
      <script
        type="application/ld+json"
        data-testid="geo-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(geoSchema) }}
      />
      <script
        type="application/ld+json"
        data-testid="aeo-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aeoFaqSchema) }}
      />
      <UniversalToolShell
        definition={definition}
        engine={engine}
        onWorkflowChain={onWorkflowChain}
      />
    </main>
  );
}

export default DynamicToolRoute;
