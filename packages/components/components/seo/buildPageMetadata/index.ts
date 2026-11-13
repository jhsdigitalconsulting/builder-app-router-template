import type { Metadata as NextMetadata } from "next";
import { toOpenGraphLocale } from "../../../utils/localeUtils";

// Server-safe replacement for the meta-tag portion of the old SEOHead.
// Returns a Next.js App Router Metadata object (no hooks, no next/head).
// Use from a route's generateMetadata() or the exported `metadata`.
export interface BuildPageMetadataArgs {
  title: string;
  description: string;
  siteName?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "event" | "product" | "profile" | "place";
  publishedDate?: string;
  author?: string;
  keywords?: string | string[];
  // BCP 47 locale of the rendered content, e.g. "de-CH" (-> og:locale de_CH).
  locale?: string;
  // Absolute (or metadataBase-relative) canonical URL for this locale.
  canonical?: string;
  // hreflang map: locale (or "x-default") -> URL, for every locale variant.
  languages?: Record<string, string>;
}

export function buildPageMetadata({
  title,
  description,
  siteName,
  image,
  url,
  type = "website",
  publishedDate,
  author,
  keywords,
  locale,
  canonical,
  languages,
}: BuildPageMetadataArgs): NextMetadata {
  const keywordList = Array.isArray(keywords)
    ? keywords
    : keywords
      ? [keywords]
      : undefined;

  // Next's OpenGraph type only accepts a subset of values; map the rest
  // to "website" while preserving the original intent for known types.
  const ogType: "website" | "article" | "profile" =
    type === "article" || type === "profile" ? type : "website";

  const metadata: NextMetadata = {
    title,
    description,
    keywords: keywordList,
    ...((canonical || languages) && {
      alternates: {
        ...(canonical && { canonical }),
        ...(languages && { languages }),
      },
    }),
    openGraph: {
      title,
      description,
      type: ogType,
      ...(url && { url }),
      ...(siteName && { siteName }),
      ...(locale && { locale: toOpenGraphLocale(locale) }),
      ...(image && { images: [{ url: image }] }),
      ...(type === "article" &&
        (publishedDate || author) && {
          publishedTime: publishedDate,
          authors: author ? [author] : undefined,
        }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [image] }),
    },
  };

  return metadata;
}
