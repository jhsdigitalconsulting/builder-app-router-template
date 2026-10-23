import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOneEntry, fetchEntries } from "@builder.io/sdk-react";
import { PageSchema, buildPageMetadata, FAQSchemaData } from "@repo/components";
import type { SiteContext } from "@repo/types";
import { BUILDER_API_KEY, getSiteContext } from "../../lib/builder";
import {
  resolvePageParams,
  formatLastUpdatedDate,
  isPreviewingFromSearchParams,
} from "../../lib/page-utils";
import RenderBuilderContent from "../../components/RenderBuilderContent";
import PageShell from "../../components/PageShell";

// ISR window (seconds) for published Builder.io content. Must be a literal —
// App Router segment config is statically analyzed and rejects runtime/env
// expressions. Editors still get instant updates via Builder preview mode.
export const revalidate = 300;

// Deduplicate the page fetch across generateMetadata and the Page component
// within the same request render using React.cache().
const fetchPage = cache(async (urlPath: string, locale: string) =>
  fetchOneEntry({
    model: "page",
    apiKey: BUILDER_API_KEY,
    userAttributes: { urlPath },
    enrich: true,
    locale,
  })
);

// Directories / pages that have their own route implementations.
const EXCLUDED_DIRECTORIES = ["/blogs"];
const STANDALONE_PAGES = ["/404"];

const toLabel = (segment: string) =>
  segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

// Build a breadcrumb trail (Home + one entry per path segment), resolving each
// label from the page model's breadcrumbTitle → title → slug fallback chain.
// The current page entry is reused directly; ancestors are fetched in parallel.
async function buildBreadcrumbTrail(
  urlPath: string,
  currentPage: any,
  siteUrl: string
): Promise<{ label: string; href: string }[]> {
  const segments = urlPath.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const resolvedSegments = await Promise.all(
    segments.map(async (segment, index) => {
      const segmentPath = "/" + segments.slice(0, index + 1).join("/");
      const isLast = index === segments.length - 1;

      let label: string;
      if (isLast) {
        label =
          currentPage?.data?.metadata?.breadcrumbTitle ||
          currentPage?.data?.title ||
          toLabel(segment);
      } else {
        try {
          const ancestorPage = await fetchOneEntry({
            model: "page",
            apiKey: BUILDER_API_KEY,
            userAttributes: { urlPath: segmentPath },
            fields: "data.title,data.metadata",
            options: { noTargeting: true },
          });
          label =
            ancestorPage?.data?.metadata?.breadcrumbTitle ||
            ancestorPage?.data?.title ||
            toLabel(segment);
        } catch {
          label = toLabel(segment);
        }
      }

      return { label, href: `${siteUrl}${segmentPath}` };
    })
  );

  return [{ label: "Home", href: siteUrl }, ...resolvedSegments];
}

function extractFaqItems(blocks: any[]): Array<{ name: string; text: string }> {
  if (!Array.isArray(blocks)) return [];
  const items: Array<{ name: string; text: string }> = [];
  for (const block of blocks) {
    if (block?.component?.name === "Accordion" && block?.component?.options?.isFAQ) {
      const groups: any[] = block.component.options.groups || [];
      for (const group of groups) {
        if (group.headline && group.schemaAnswer) {
          items.push({ name: group.headline, text: group.schemaAnswer });
        }
      }
    }
    if (block?.children?.length) {
      items.push(...extractFaqItems(block.children));
    }
  }
  return items;
}

function shouldExcludePath(url: string): boolean {
  if (!url) return true;
  const isExcludedDirectory = EXCLUDED_DIRECTORIES.some((dir) =>
    url.startsWith(dir)
  );
  const isStandalonePage = STANDALONE_PAGES.includes(url);
  return isExcludedDirectory || isStandalonePage;
}

export async function generateStaticParams(): Promise<{ page: string[] }[]> {
  const pages = await fetchEntries({
    model: "page",
    apiKey: BUILDER_API_KEY,
    fields: "data.url",
    options: { noTargeting: true },
  });

  return pages
    .map((page) => String(page.data?.url))
    .filter((url) => !shouldExcludePath(url))
    .map((url) => ({
      page: url.split("/").filter(Boolean),
    }));
}

interface PageRouteProps {
  params: Promise<{ page?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: PageRouteProps): Promise<Metadata> {
  const { page: segments } = await params;
  const { locale, urlPath } = resolvePageParams(segments);

  const [page, siteContext] = await Promise.all([
    fetchPage(urlPath, locale),
    getSiteContext(locale),
  ]);

  const base = buildPageMetadata({
    title: page?.data?.title || "",
    description: page?.data?.metadata?.description || "",
    siteName: siteContext?.data?.siteName,
    image: page?.data?.image,
    url: page?.data?.url,
    type: "website",
    keywords: page?.data?.metadata?.keywords,
  });

  // The original page forced noindex.
  return {
    ...base,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params, searchParams }: PageRouteProps) {
  const { page: segments } = await params;
  const resolvedSearchParams = await searchParams;
  const { locale, urlPath } = resolvePageParams(segments);

  const [page, siteContext] = await Promise.all([
    fetchPage(urlPath, locale),
    getSiteContext(locale),
  ]);

  const isPreviewing = isPreviewingFromSearchParams(resolvedSearchParams);

  if (!page && !isPreviewing) {
    notFound();
  }

  const lastUpdatedDate = formatLastUpdatedDate(page?.lastUpdated);
  const site = siteContext as SiteContext | null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const breadcrumbTrail = await buildBreadcrumbTrail(urlPath, page, siteUrl);
  const faqItems = extractFaqItems(page?.data?.blocks || []);
  const breadcrumbSchema =
    breadcrumbTrail.length > 1
      ? breadcrumbTrail.map((c, i) => ({
          position: i + 1,
          name: c.label,
          item: c.href,
        }))
      : undefined;

  const toIso = (timestamp?: number) =>
    timestamp ? new Date(timestamp).toISOString() : undefined;

  const orgAddress = site?.data.organization?.address;

  return (
    <PageShell
      siteContext={site}
      headerOverride={page?.data?.header}
      footerOverride={page?.data?.footer}
      locale={locale}
    >
        {site && (
          <PageSchema
            title={page?.data?.title || ""}
            description={page?.data?.metadata?.description || ""}
            url={page?.data?.url ? `${siteUrl}${page.data.url}` : siteUrl}
            siteName={site.data.siteName}
            siteUrl={siteUrl}
            organizationName={site.data.organization?.name || site.data.siteName}
            organizationDescription={site.data.organization?.description}
            logo={site.data.logo}
            sameAs={site.data.socialNetworks?.map((network) => network.href)}
            address={
              orgAddress
                ? {
                    streetAddress: orgAddress.address1,
                    addressLocality: orgAddress.city,
                    addressRegion: orgAddress.state,
                    postalCode: orgAddress.postalCode,
                    addressCountry: orgAddress.country,
                  }
                : undefined
            }
            contactPoint={
              site.data.contact
                ? [
                    {
                      contactType: "customer service",
                      telephone: site.data.contact.telephone,
                      email: site.data.contact.email,
                      areaServed: site.data.contact.areaServed,
                      availableLanguage: site.data.contact.availableLanguages?.map(
                        (lang) => lang.language
                      ),
                    },
                  ]
                : undefined
            }
            image={page?.data?.image}
            keywords={page?.data?.metadata?.keywords}
            publishedDate={toIso(page?.firstPublished) || toIso(page?.lastUpdated)}
            modifiedDate={toIso(page?.lastUpdated)}
            breadcrumb={breadcrumbSchema}
          />
        )}
        {faqItems.length > 0 && <FAQSchemaData items={faqItems} />}
        <RenderBuilderContent
          content={page}
          model="page"
          locale={locale}
          data={{ siteContext: site, lastUpdatedDate, pageContext: { breadcrumbs: breadcrumbTrail } }}
        />
    </PageShell>
  );
}
