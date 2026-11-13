import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localizePath,
} from "@repo/components/utils";

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };

// Locales whose pages are generated at build time. Every other locale is
// rendered on first request and then cached (ISR), because inline localization
// serves the same URLs in all 36 locales and pre-building them all would
// multiply build-time Builder fetches by 36. Add locales here to prebuild them.
export const PREBUILD_LOCALES: string[] = [DEFAULT_LOCALE];

// The locale comes from the [locale] route segment (the proxy rewrites
// unprefixed URLs to the default locale). The catch-all segments are therefore
// only the Builder urlPath.
export function toUrlPath(segments: string[] | undefined): string {
  const parts = Array.isArray(segments) ? segments : [];
  return "/" + parts.join("/");
}

// Absolute URLs for a path in every locale plus x-default, for hreflang
// (metadata alternates and the sitemap). The default locale is unprefixed.
export function buildLocaleAlternates(
  path: string,
  locale: string,
  origin: string = process.env.NEXT_PUBLIC_SITE_URL || ""
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    languages[l] = `${origin}${localizePath(path, l)}`;
  }
  languages["x-default"] = `${origin}${localizePath(path, DEFAULT_LOCALE)}`;
  return { canonical: languages[locale], languages };
}

export function formatLastUpdatedDate(
  dateInput: unknown,
  locale: string = DEFAULT_LOCALE
): string {
  if (!dateInput) return "Date not available";

  const date = new Date(dateInput as string | number);

  if (isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Server-side preview detection from the route's searchParams.
// Builder injects builder.preview / builder.space when editing.
export function isPreviewingFromSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): boolean {
  if (!searchParams) return false;
  return (
    searchParams["builder.preview"] !== undefined ||
    searchParams["builder.space"] !== undefined ||
    searchParams["builder.overrides.preview"] !== undefined
  );
}
