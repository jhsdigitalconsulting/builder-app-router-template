import React from "react";
import { Footer } from "@repo/components";
import type { ModelReference, SiteContext } from "@repo/types";
import { getSiteContext } from "../lib/builder";
import RenderBuilderContent from "./RenderBuilderContent";

interface SiteFooterProps {
  // Pass the already-fetched Site context to avoid a redundant fetch. When
  // omitted (e.g. not-found.tsx), it is fetched here (the fetch is cached).
  siteContext?: SiteContext | null;
  // Page-level footer symbol reference. When set, it overrides the default
  // site footer for this page only.
  override?: ModelReference | null;
  locale?: string;
}

// Renders the site footer. Resolution order:
//   1. the page-level `override` symbol (per-page footer), then
//   2. the Site context's `defaultFooter` symbol (site default), then
//   3. the bare <Footer> with its Site context fallbacks.
// The resolved symbol is rendered with the Site context as `data` so the
// Footer component's bindings (`state.siteContext.*`) resolve inside it.
export default async function SiteFooter({
  siteContext,
  override,
  locale = "en",
}: SiteFooterProps) {
  const site =
    siteContext ?? ((await getSiteContext(locale)) as SiteContext | null);

  const footerRef =
    override?.model === "symbol" && override.value
      ? override
      : site?.data?.defaultFooter;

  if (footerRef?.model === "symbol" && footerRef.value) {
    return (
      <RenderBuilderContent
        content={footerRef.value}
        model="symbol"
        locale={locale}
        data={{ siteContext: site }}
      />
    );
  }

  return <Footer />;
}
