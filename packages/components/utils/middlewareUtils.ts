import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  getLocaleFromPathname,
  matchAcceptLanguage,
  matchLocale,
  removeLocaleFromPathname,
} from "./localeUtils";

const LOCALE_COOKIE = "preferred_language";
const ONE_YEAR = 31536000;

// Builder's visual editor loads pages with `builder.*` query params (or the
// __builder_editing__ path). Those requests must never be redirected away from
// the URL the editor asked for.
const isBuilderEditorRequest = (url: URL) =>
  url.pathname.includes("/__builder_editing__") ||
  Array.from(url.searchParams.keys()).some((key) => key.startsWith("builder."));

/**
 * Locale routing. Pages live under app/[locale]/..., English (US) is served at
 * the root, every other locale is prefixed ("/de-DE/about").
 *
 *  - "/en-US/x"        -> redirect to "/x" (one canonical URL), remember choice
 *  - "/de-de/x"        -> redirect to canonical casing "/de-DE/x"
 *  - "/de-DE/x"        -> pass through, remember choice in the cookie
 *  - "/x" (no locale)  -> redirect to the visitor's preferred locale (cookie,
 *                         then Accept-Language) when it is not the default,
 *                         otherwise rewrite internally to "/en-US/x"
 *
 * An explicit locale in the URL always wins over the browser's preference.
 */
export const handleLocale = (request: NextRequest) => {
  const url = request.nextUrl.clone();
  const isEditor = isBuilderEditorRequest(url);
  const cookieLocale = matchLocale(request.cookies.get(LOCALE_COOKIE)?.value);

  const rememberLocale = (response: NextResponse, locale: string) => {
    if (cookieLocale !== locale) {
      response.cookies.set(LOCALE_COOKIE, locale, {
        maxAge: ONE_YEAR,
        path: "/",
      });
    }
    return response;
  };

  const pathLocale = getLocaleFromPathname(url.pathname);

  if (pathLocale) {
    const firstSegment = url.pathname.split("/").filter(Boolean)[0];
    const rest = removeLocaleFromPathname(url.pathname);

    if (pathLocale === DEFAULT_LOCALE && !isEditor) {
      url.pathname = rest;
      return rememberLocale(NextResponse.redirect(url), pathLocale);
    }
    if (firstSegment !== pathLocale && !isEditor) {
      url.pathname = `/${pathLocale}${rest === "/" ? "" : rest}`;
      return rememberLocale(NextResponse.redirect(url), pathLocale);
    }
    return isEditor ? NextResponse.next() : rememberLocale(NextResponse.next(), pathLocale);
  }

  const preferred =
    cookieLocale ?? matchAcceptLanguage(request.headers.get("accept-language"));

  if (!isEditor && preferred && preferred !== DEFAULT_LOCALE) {
    url.pathname = `/${preferred}${url.pathname === "/" ? "" : url.pathname}`;
    return rememberLocale(NextResponse.redirect(url), preferred);
  }

  // Default locale: serve app/[locale] with locale = en-US without exposing it.
  url.pathname = `/${DEFAULT_LOCALE}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
};

export const handleErrorRedirect = (request: NextRequest) => {
  const url = new URL(request.url);
  // The /500 page itself carries errorCode; don't redirect it to itself.
  if (url.pathname === "/500") return;

  const errorCode = url.searchParams.get("errorCode");
  const errorMessage = url.searchParams.get("errorMessage");

  if (errorCode && /^5[0-9]{2}$/.test(errorCode)) {
    const redirectUrl = new URL("/500", request.url);
    redirectUrl.searchParams.set("errorCode", errorCode);
    if (errorMessage) {
      redirectUrl.searchParams.set("errorMessage", errorMessage);
    }
    return NextResponse.redirect(redirectUrl);
  }
};

export const handleDeploymentProtection = (request: NextRequest, response: NextResponse) => {
  // Handle Vercel deployment protection bypass for Builder.io
  // This allows Builder.io to access password-protected Vercel deployments
  
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";
  const builderBypass = request.headers.get("x-builder-bypass");
  
  // Check if this is a Builder.io request that needs bypass
  const isBuilderRequest = builderBypass || 
    userAgent.includes("builder.io") || 
    userAgent.includes("BuilderBot") ||
    url.searchParams.has("builder.overrides") ||
    url.pathname.includes("/__builder_editing__");
  
  if (isBuilderRequest) {
    // Set headers to bypass Vercel deployment protection
    response.headers.set("x-vercel-protection-bypass", process.env.VERCEL_PROTECTION_BYPASS || "");
    
    // Also set the Builder.io specific headers if needed
    if (builderBypass) {
      response.headers.set("x-builder-bypass", builderBypass);
    }
  }
  
  return response;
};