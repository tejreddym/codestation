import { siteConfig } from "@/config/site";

type SchemaBase = {
  "@context": "https://schema.org";
  "@type": string;
};

export function JsonLd({ schema }: { schema: SchemaBase | SchemaBase[] }) {
  if (!siteConfig.origin || !siteConfig.indexing) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
