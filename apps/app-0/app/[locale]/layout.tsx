import type { Metadata, Viewport } from "next";
import { Poppins, Nothing_You_Could_Do } from "next/font/google";
import "../../styles/globals.css";
import { SiteContextProvider } from "@repo/components";
import { DEFAULT_LOCALE, matchLocale } from "@repo/components/utils";
import { getSiteContext } from "../../lib/builder";

const fontSans = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const fontAccent = Nothing_You_Could_Do({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-accent",
  display: "swap",
});

export const metadata: Metadata = {
  icons: {
    icon: { url: "/favicon.ico", type: "image/png" },
    apple: "/favicon.ico",
  },
  other: {
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EA633F",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // The proxy guarantees a valid locale here. If a request slips past it
  // (e.g. "/foo.html"), fall back to the default so the page still renders
  // and the route's own validation can 404 it.
  const { locale: rawLocale } = await params;
  const locale = matchLocale(rawLocale) ?? DEFAULT_LOCALE;
  const siteContext = await getSiteContext(locale);

  return (
    <html lang={locale}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"
          integrity="sha512-Kc323vGBEqzTmouAECnVceyQqyqdsSiqLQISBL29aUW4U/M7pSPA/gEUZQqv1cwx4OnYxTxve5UMg5GT6L4JJg=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body
        className={`${fontSans.variable} ${fontAccent.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-accent focus:text-white"
        >
          Skip to main content
        </a>
        <SiteContextProvider siteContext={siteContext}>
          {children}
        </SiteContextProvider>
      </body>
    </html>
  );
}
