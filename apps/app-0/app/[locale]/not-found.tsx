import React from "react";
import { fetchOneEntry } from "@builder.io/sdk-react";
import { NotFoundContent } from "@repo/components";
import { DEFAULT_LOCALE } from "@repo/components/utils";
import { BUILDER_API_KEY, getSiteContext } from "../../lib/builder";
import RenderBuilderContent from "../../components/RenderBuilderContent";
import PageShell from "../../components/PageShell";

// 404s should not re-render on every request — revalidate daily.
export const revalidate = 86400;

// Next.js passes no params to not-found, so the 404 page itself is rendered in
// the default locale (the surrounding <html lang> still reflects the URL's
// locale, since the layout is shared).
export default async function NotFound() {
  const [page404, siteContext] = await Promise.all([
    fetchOneEntry({
      model: "page",
      apiKey: BUILDER_API_KEY,
      userAttributes: { urlPath: "/404" },
      locale: DEFAULT_LOCALE,
    }),
    getSiteContext(DEFAULT_LOCALE),
  ]);

  return (
    <PageShell siteContext={siteContext} locale={DEFAULT_LOCALE}>
      <div className="container mx-auto flex lg:min-h-[550px] items-center justify-center">
        {page404 ? (
          <div className="w-full">
            <RenderBuilderContent
              content={page404}
              model="page"
              locale={DEFAULT_LOCALE}
            />
          </div>
        ) : (
          <NotFoundContent
            errorCode="404"
            title="Page Not Found"
            description="The page you're looking for doesn't exist or has been moved."
            backButtonText="Go Back"
            homeButtonText="Return Home"
          />
        )}
      </div>
    </PageShell>
  );
}
