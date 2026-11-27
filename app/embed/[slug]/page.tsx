import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTool, tools } from "@/config/tools";
import EmbedToolView from "@/components/EmbedToolView";

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};

  return {
    title: `${tool.name} — Embed`,
    description: tool.description,
    alternates: { canonical: `https://codestation.in/tools/${tool.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function EmbedToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <Suspense
      fallback={
        <main style={{ padding: "16px" }} data-embed-mode="true">
          <p role="status">Loading {tool.name}…</p>
        </main>
      }
    >
      <EmbedToolView
        slug={tool.slug}
        toolId={tool.id}
        name={tool.name}
        category={tool.category}
      />
    </Suspense>
  );
}
