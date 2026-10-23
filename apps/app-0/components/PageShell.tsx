import React from "react";
import type { ModelReference, SiteContext } from "@repo/types";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

interface PageShellProps {
  siteContext?: SiteContext | null;
  headerOverride?: ModelReference | null;
  footerOverride?: ModelReference | null;
  locale?: string;
  children: React.ReactNode;
}

// Shared page chrome: header (symbol override -> site default -> bare Header),
// the main landmark, and footer (same resolution).
export default function PageShell({
  siteContext,
  headerOverride,
  footerOverride,
  locale,
  children,
}: PageShellProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader
        siteContext={siteContext}
        override={headerOverride}
        locale={locale}
      />
      <main id="main-content" role="main" className="flex-grow">
        {children}
      </main>
      <SiteFooter
        siteContext={siteContext}
        override={footerOverride}
        locale={locale}
      />
    </div>
  );
}
