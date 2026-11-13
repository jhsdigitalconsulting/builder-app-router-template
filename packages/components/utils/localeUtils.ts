// Single source of truth for locales. Locales are ISO language-REGION tags
// (BCP 47), e.g. "en-US", "de-CH". They must match the locale names configured
// in the Builder.io space exactly, because the same value is passed to
// fetchOneEntry({ locale }) and <Content locale>.
//
// This module is pure (no next/server, no node APIs) so it is safe to import
// from the proxy, server components, and browser code alike.

import enabledLocales from './enabled-locales.json';

export const DEFAULT_LOCALE = 'en-US';

// Every locale this project knows how to serve (the catalog). Used to seed
// Builder (`pnpm sync:locales --push`). It is NOT what the site serves.
export const KNOWN_LOCALES: string[] = [
  // English, by market
  'en-US', 'en-CA', 'en-MX', 'en-BR', 'en-GB', 'en-IE', 'en-AU', 'en-SG',
  'en-HK', 'en-IN', 'en-AT', 'en-CH', 'en-DE', 'en-FR', 'en-ES', 'en-BE',
  'en-NL', 'en-SE', 'en-NO', 'en-DK', 'en-FI',
  // German
  'de-DE', 'de-AT', 'de-CH',
  // French
  'fr-FR', 'fr-CH', 'fr-BE',
  // Spanish
  'es-ES', 'es-MX',
  // Dutch
  'nl-NL', 'nl-BE',
  // Portuguese
  'pt-BR',
  // Swedish, Norwegian (Bokmål), Danish, Finnish
  'sv-SE', 'nb-NO', 'da-DK', 'fi-FI',
];

// The locales the site actually serves: those enabled in the Builder space.
// enabled-locales.json is regenerated from Builder on every `pnpm dev` /
// `pnpm build` (scripts/generate-locales.mjs) because the proxy runs at the
// edge and cannot fetch Builder per request. The default locale is always
// enabled so the site never has zero locales.
export const SUPPORTED_LOCALES: string[] = Array.from(
  new Set([DEFAULT_LOCALE, ...enabledLocales.locales])
);

// The region used when a visitor only tells us a language ("de", "fr", ...).
// "en" maps to the default locale. "no" is an alias for Norwegian Bokmål.
const LANGUAGE_FALLBACKS: Record<string, string> = {
  en: DEFAULT_LOCALE,
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  nl: 'nl-NL',
  pt: 'pt-BR',
  sv: 'sv-SE',
  nb: 'nb-NO',
  no: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
};

/** Canonical casing for an exact (case-insensitive) locale match, else null. */
export function normalizeLocale(
  input: string | null | undefined,
  supportedLocales: string[] = SUPPORTED_LOCALES
): string | null {
  if (!input) return null;
  const lower = input.trim().toLowerCase();
  return supportedLocales.find((l) => l.toLowerCase() === lower) ?? null;
}

/**
 * Best supported locale for a language tag: exact match first ("de-CH"), then
 * the language's default region ("de" or "de-LI" -> "de-DE").
 */
export function matchLocale(
  tag: string | null | undefined,
  supportedLocales: string[] = SUPPORTED_LOCALES
): string | null {
  const exact = normalizeLocale(tag, supportedLocales);
  if (exact) return exact;
  const language = tag?.trim().toLowerCase().split('-')[0];
  if (!language) return null;
  const fallback = LANGUAGE_FALLBACKS[language];
  if (fallback && supportedLocales.includes(fallback)) return fallback;
  // Any supported region of that language, in list order.
  return (
    supportedLocales.find((l) => l.toLowerCase().startsWith(`${language}-`)) ??
    null
  );
}

/** Highest-priority supported locale in an Accept-Language header. */
export function matchAcceptLanguage(
  header: string | null | undefined,
  supportedLocales: string[] = SUPPORTED_LOCALES
): string | null {
  if (!header) return null;
  const candidates = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality, index };
    })
    .filter((c) => c.tag && c.tag !== '*' && c.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of candidates) {
    const match = matchLocale(tag, supportedLocales);
    if (match) return match;
  }
  return null;
}

/**
 * Extract the (canonical) locale from a pathname's first segment, matching
 * case-insensitively. Returns null when the first segment is not a locale.
 */
export function getLocaleFromPathname(
  pathname: string,
  supportedLocales: string[] = SUPPORTED_LOCALES
): string | null {
  const first = pathname.split('/').filter(Boolean)[0];
  return normalizeLocale(first, supportedLocales);
}

/** Remove a leading locale segment from a pathname. */
export function removeLocaleFromPathname(
  pathname: string,
  supportedLocales: string[] = SUPPORTED_LOCALES
): string {
  const segments = pathname.split('/').filter(Boolean);
  if (normalizeLocale(segments[0], supportedLocales)) {
    return '/' + segments.slice(1).join('/');
  }
  return pathname;
}

/**
 * Public URL path for a locale. The default locale lives at the root
 * ("/about"); every other locale is prefixed ("/de-DE/about").
 */
export function localizePath(
  path: string,
  locale: string,
  defaultLocale: string = DEFAULT_LOCALE
): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

/** "en-US" -> "en_US", the format Open Graph's og:locale expects. */
export function toOpenGraphLocale(locale: string): string {
  return locale.replace('-', '_');
}
