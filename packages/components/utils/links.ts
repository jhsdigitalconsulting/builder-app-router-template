import type { CMSLinkProps, LinkValue } from "@repo/types";

// Resolves the value of a CMSLink input (or a legacy plain-string href) to a
// URL. Model references go through the /dynamiclink route, which looks up the
// entry's current URL so links survive slug changes.
export function resolveLinkHref(link: LinkValue | undefined, fallback = "#"): string {
  if (!link) return fallback;
  if (typeof link === "string") return link || fallback;
  if (link.type === "model") {
    if (!link.model || !link.referenceId) return link.href || fallback;
    return `/dynamiclink/${link.model}/builder/${link.referenceId}`;
  }
  return link.href || fallback;
}

export function shouldOpenInNewTab(link: LinkValue | undefined, override?: boolean): boolean {
  if (override) return true;
  return !!link && typeof link !== "string" && !!(link as CMSLinkProps).openInNewTab;
}

export function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

// True when the link has a real destination (not empty and not "#").
export function hasLinkHref(link: LinkValue | undefined): boolean {
  const href = resolveLinkHref(link, "");
  return href !== "" && href !== "#";
}
