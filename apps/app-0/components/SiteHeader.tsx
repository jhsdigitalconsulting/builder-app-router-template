import React from "react";
import { Header } from "@repo/components";
import type { ModelReference, SiteContext } from "@repo/types";
import { getSiteContext } from "../lib/builder";
import RenderBuilderContent from "./RenderBuilderContent";

interface SiteHeaderProps {
  // Pass the already-fetched Site context to avoid a redundant fetch. When
  // omitted (e.g. not-found.tsx), it is fetched here (the fetch is cached).
  siteContext?: SiteContext | null;
  // Page-level header symbol reference. When set, it overrides the default
  // site header for this page only.
  override?: ModelReference | null;
  locale?: string;
}

// Renders the site header. Resolution order:
//   1. the page-level `override` symbol (per-page header), then
//   2. the Site context's `defaultHeader` symbol (site default), then
//   3. the bare <Header> with its Site context fallbacks.
// The resolved symbol is rendered with the Site context as `data` so the
// Header component's bindings (`state.siteContext.*`) resolve inside it.
export default async function SiteHeader({
  siteContext,
  override,
  locale = "en",
}: SiteHeaderProps) {
  const site =
    siteContext ?? ((await getSiteContext(locale)) as SiteContext | null);

  const headerRef =
    override?.model === "symbol" && override.value
      ? override
      : site?.data?.defaultHeader;

  if (headerRef?.model === "symbol" && headerRef.value) {
    return (
      <RenderBuilderContent
        content={headerRef.value}
        model="symbol"
        locale={locale}
        data={{ siteContext: site }}
      />
    );
  }

  return <Header />;
}
