import type { CMSLinkProps, LinkValue } from "@repo/types";

const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

// Allows relative paths ("/x" but not "//x"), fragments, and the schemes above.
// Anything else (javascript:, data:, protocol-relative URLs) is rejected, since
// hrefs are CMS-authored and rendered straight into <a href>.
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return !value.startsWith("//") && !value.startsWith("/\\");
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  if (!scheme) return !/[:\\]/.test(value);
  return SAFE_SCHEMES.includes(`${scheme.toLowerCase()}:`);
}

function safeHref(href: string | undefined, fallback: string): string {
  return href && isSafeHref(href) ? href : fallback;
}

// Resolves the value of a CMSLink input (or a legacy plain-string href) to a
// URL. Model references go through the /dynamiclink route, which looks up the
// entry's current URL so links survive slug changes.
export function resolveLinkHref(link: LinkValue | undefined, fallback = "#"): string {
  if (!link) return fallback;
  if (typeof link === "string") return safeHref(link, fallback);
  if (link.type === "model") {
    if (!link.model || !link.referenceId) return safeHref(link.href, fallback);
    return `/dynamiclink/${encodeURIComponent(link.model)}/builder/${encodeURIComponent(link.referenceId)}`;
  }
  return safeHref(link.href, fallback);
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
