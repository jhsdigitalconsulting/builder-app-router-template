import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOneEntry, fetchEntries } from "@builder.io/sdk-react";
import {
  Banner100,
  TileCTA,
  ThemeProvider,
  ArticleSchemaData,
  articleToSchemaData,
  buildPageMetadata,
} from "@repo/components";
import type { SiteContext } from "@repo/types";
import { localizePath, normalizeLocale } from "@repo/components/utils";
import { BUILDER_API_KEY, getSiteContext } from "../../../../lib/builder";
import {
  PREBUILD_LOCALES,
  buildLocaleAlternates,
  isPreviewingFromSearchParams,
} from "../../../../lib/page-utils";
import RenderBuilderContent from "../../../../components/RenderBuilderContent";
import PageShell from "../../../../components/PageShell";

// ISR window (seconds) for published Builder.io content. Must be a literal —
// App Router segment config is statically analyzed and rejects runtime/env
// expressions. Editors still get instant updates via Builder preview mode.
export const revalidate = 300;

function formatDate(timestamp: number, locale: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const fetchArticle = cache(async (handle: string, locale: string) =>
  fetchOneEntry({
    model: "article",
    apiKey: BUILDER_API_KEY,
    query: { "data.handle": handle },
    enrich: true,
    locale,
  })
);

export async function generateStaticParams(): Promise<
  { locale: string; handle: string }[]
> {
  const articles = await fetchEntries({
    model: "article",
    apiKey: BUILDER_API_KEY,
    fields: "data.handle",
    options: { noTargeting: true },
  });

  const handles = articles
    .map((article) => String(article.data?.handle))
    .filter(Boolean);

  return PREBUILD_LOCALES.flatMap((locale) =>
    handles.map((handle) => ({ locale, handle }))
  );
}

interface BlogRouteProps {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: BlogRouteProps): Promise<Metadata> {
  const { locale: rawLocale, handle } = await params;
  const locale = normalizeLocale(rawLocale);
  if (!locale) return {};
  const [article, siteContext] = await Promise.all([
    fetchArticle(handle, locale),
    getSiteContext(locale),
  ]);

  const { canonical, languages } = buildLocaleAlternates(
    `/blogs/${handle}`,
    locale
  );

  return buildPageMetadata({
    title: article?.data?.title || "",
    description: article?.data?.metadata?.description || article?.data?.excerpt || "",
    siteName: (siteContext as SiteContext | null)?.data?.siteName,
    image: article?.data?.image,
    url: handle ? `/blogs/${handle}` : undefined,
    type: "article",
    publishedDate: article?.data?.publishDate,
    author: article?.data?.author,
    keywords: article?.data?.metadata?.keywords,
    locale,
    canonical,
    languages,
  });
}

export default async function BlogPage({
  params,
  searchParams,
}: BlogRouteProps) {
  const { locale: rawLocale, handle } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = normalizeLocale(rawLocale);
  if (!locale || locale !== rawLocale) notFound();

  const [article, siteContext] = await Promise.all([
    fetchArticle(handle, locale),
    getSiteContext(locale),
  ]);

  const isPreviewing = isPreviewingFromSearchParams(resolvedSearchParams);

  if (!article && !isPreviewing) {
    notFound();
  }

  const publishedDate = formatDate(
    article?.data?.publishDate || article?.lastUpdated,
    locale
  );

  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  const rawPublishDate = article?.data?.publishDate || article?.lastUpdated;

  const schemaProps =
    article && rawPublishDate
      ? articleToSchemaData(
          {
            handle: article.data?.handle || "",
            title: article.data?.title || "",
            subtitle: article.data?.subtitle || "",
            image: article.data?.image || "",
            excerpt: article.data?.excerpt || "",
            metadata: {
              description:
                article.data?.description || article.data?.excerpt || "",
              keywords: article.data?.keywords || [],
            },
            publishDate: new Date(rawPublishDate).toISOString(),
            dateModified: article.lastUpdated
              ? new Date(article.lastUpdated).toISOString()
              : undefined,
            author: article.data?.author,
            blocks: article.data?.blocks || [],
          },
          (siteContext as SiteContext | null) || undefined,
          origin
        )
      : null;

  return (
    <PageShell siteContext={siteContext as SiteContext | null} locale={locale}>
        {schemaProps && <ArticleSchemaData {...schemaProps} />}
        <ThemeProvider>
          <Banner100
            backgroundImage={
              article?.data?.image ||
              "https://placehold.co/800x600/EEE/5ce1e6.png"
            }
            backgroundType="image"
            alignment="center"
            theme="accent"
            maskOpacity={0}
          >
            <TileCTA
              eyebrow={article?.data?.subtitle || ""}
              headline={article?.data?.title || ""}
              content={article?.data?.excerpt || ""}
              theme="transparent-dark"
              isHero={true}
              alignment="left"
              maskOpacity={0.1}
              inheritTheme={false}
            />
          </Banner100>
          <article className="w-full max-w-[1200px] mx-auto px-6 md:px-12 lg:px-16 py-8">
            <h6>Published: {publishedDate}</h6>
            <RenderBuilderContent
              content={article}
              model="article"
              locale={locale}
              data={{
                pageContext: {
                  breadcrumbs: [
                    { label: "Home", href: `${origin || ""}${localizePath("/", locale)}` },
                    { label: "Blog", href: `${origin || ""}${localizePath("/blogs", locale)}` },
                    { label: article?.data?.title || "", href: `${origin || ""}${localizePath(`/blogs/${handle}`, locale)}` },
                  ],
                },
              }}
            />
          </article>
        </ThemeProvider>
    </PageShell>
  );
}
