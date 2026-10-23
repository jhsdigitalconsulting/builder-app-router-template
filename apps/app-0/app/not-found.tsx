import React from "react";
import { fetchOneEntry } from "@builder.io/sdk-react";
import { NotFoundContent } from "@repo/components";
import { BUILDER_API_KEY, getSiteContext } from "../lib/builder";
import RenderBuilderContent from "../components/RenderBuilderContent";
import PageShell from "../components/PageShell";

// 404s should not re-render on every request — revalidate daily.
export const revalidate = 86400;

export default async function NotFound() {
  const [page404, siteContext] = await Promise.all([
    fetchOneEntry({
      model: "page",
      apiKey: BUILDER_API_KEY,
      userAttributes: { urlPath: "/404" },
    }),
    getSiteContext("en"),
  ]);

  return (
    <PageShell siteContext={siteContext}>
      <div className="container mx-auto flex lg:min-h-[550px] items-center justify-center">
        {page404 ? (
          <div className="w-full">
            <RenderBuilderContent content={page404} model="page" />
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
