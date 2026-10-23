import type { MetadataRoute } from "next";
import { fetchEntries } from "@builder.io/sdk-react";
import { BUILDER_API_KEY } from "../lib/builder";

// Regenerate the sitemap at most once per day. Builder `fetchEntries` is an
// uncached fetch in Next 16, so without this every crawler hit re-runs both
// fetches and regenerates the document (Function Invocations + Edge Requests).
export const revalidate = 86400;

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "") ||
    "http://localhost:3000"
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const excludedPaths = process.env.SITEMAP_EXCLUDED_PATHS
    ? process.env.SITEMAP_EXCLUDED_PATHS.split(",").map((p) => p.trim())
    : ["/do-not-publish/"];

  const shouldExcludePath = (path: string): boolean =>
    excludedPaths.some((excludedPath) => path.includes(excludedPath));

  const base = getBaseUrl();

  let pages: any[] = [];
  let posts: any[] = [];

  try {
    const results = await Promise.allSettled([
      fetchEntries({
        model: "page",
        apiKey: BUILDER_API_KEY,
        fields: "data.url,lastUpdated",
        options: { noTargeting: true },
      }),
      fetchEntries({
        model: "article",
        apiKey: BUILDER_API_KEY,
        fields: "data.handle,lastUpdated",
        options: { noTargeting: true },
      }),
    ]);

    pages = results[0].status === "fulfilled" ? results[0].value || [] : [];
    posts = results[1].status === "fulfilled" ? results[1].value || [] : [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const sources = ["Builder.io pages", "Builder.io articles"];
        console.error(`Failed to fetch ${sources[index]}:`, result.reason);
      }
    });
  } catch (error) {
    console.error("Unexpected error in sitemap generation:", error);
  }

  const toUrl = (path: string) => `${base}/${path.replace(/^\/+/, "")}`;
  const toDate = (lastUpdated: unknown) =>
    new Date((lastUpdated as number) || Date.now());

  const entries: MetadataRoute.Sitemap = [
    ...pages
      .filter(
        (page) =>
          page?.data?.url &&
          !shouldExcludePath(page.data.url) &&
          page.data.url !== "/404"
      )
      .map((page) => ({
        url: toUrl(page.data.url),
        lastModified: toDate(page.lastUpdated),
      })),
    {
      url: toUrl("blogs"),
      lastModified: new Date(),
    },
    ...posts
      .filter(
        (post) => post?.data?.handle && !shouldExcludePath(post.data.handle)
      )
      .map((post) => ({
        url: toUrl(`blogs/${post.data.handle}`),
        lastModified: toDate(post.lastUpdated),
      })),
  ];

  return entries;
}
