import { cache } from "react";
import { fetchOneEntry } from "@builder.io/sdk-react";
import { DEFAULT_LOCALE } from "@repo/components/utils";
import type { SiteContext } from "@repo/types";

// Central Builder.io constants for the App Router.
export const BUILDER_API_KEY = process.env
  .NEXT_PUBLIC_BUILDER_API_KEY as string;

export const SITE_CONTEXT_NAME =
  process.env.NEXT_PUBLIC_SITE_CONTEXT_NAME || "builder-app-template";

// site-context is a global, largely locale-independent model fetched in the
// layout. noTargeting matches the original Gen1 behavior. Wrapped in React
// cache() so the per-locale fetch is deduped across layout, generateMetadata,
// and the page component within a single request render.
export const getSiteContext = cache(
  async (locale: string = DEFAULT_LOCALE): Promise<SiteContext | null> => {
    const siteContext = await fetchOneEntry({
      model: "site-context",
      apiKey: BUILDER_API_KEY,
      query: { name: SITE_CONTEXT_NAME },
      options: { noTargeting: true },
      enrich: true,
      locale,
    });

    if (!siteContext) {
      console.error("ERROR: No site context found for name:", SITE_CONTEXT_NAME);
    }

    return (siteContext as SiteContext | null) || null;
  }
);
