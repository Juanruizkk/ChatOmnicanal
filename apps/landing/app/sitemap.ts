import type { MetadataRoute } from "next";
import { site, siteUrl } from "@/site.config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${site.legalUpdatedAt}T00:00:00Z`);
  return ["/", "/privacidad/", "/terminos/", "/eliminacion-de-datos/"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
  }));
}
