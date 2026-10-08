import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
export default function robots(): MetadataRoute.Robots {
  return siteConfig.indexing && siteConfig.origin
    ? { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteConfig.origin}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
}
