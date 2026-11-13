import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  handleLocale,
  handleErrorRedirect,
  handleDeploymentProtection,
} from "@repo/components/utils/middlewareUtils";

export function proxy(request: NextRequest) {
  // Use the shared error redirect handler
  const errorRedirect = handleErrorRedirect(request);
  if (errorRedirect) return errorRedirect;

  // Locale routing (redirect / rewrite to app/[locale]). Paths with a file
  // extension (.html, .pdf, ...) are left alone so public files keep working.
  const hasFileExtension = /\.[^/]*$/.test(request.nextUrl.pathname);
  const response = hasFileExtension ? NextResponse.next() : handleLocale(request);

  // Handle Vercel deployment protection for Builder.io
  return handleDeploymentProtection(request, response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - dynamiclink (route handler that redirects to a model entry; must not
     *   be rewritten under /[locale])
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static-asset extensions (images, fonts, css/js, txt/xml/map): these
     *   bypass the proxy entirely so they incur no Edge Middleware Invocation.
     *   Document extensions (.html/.pdf) are deliberately NOT excluded so any
     *   legacy URL redirects still flow through the proxy.
     *
     * /500 is matched (not excluded): handleErrorRedirect skips it itself, and
     * it must be rewritten to /en-US/500 like any other page.
     */
    "/((?!api|dynamiclink|_next/static|_next/image|favicon.ico|.*\\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|txt|xml|map)$).*)",
  ],
};
