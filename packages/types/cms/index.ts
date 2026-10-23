// CMS Link input type — matches the value shape produced by the CMSLink Builder.io
// custom input (registered via the @jhsdc/builder-input-types plugin).
export interface CMSLinkProps {
  type: "url" | "model";
  href: string;
  model?: string;
  referenceId?: string;
  openInNewTab?: boolean;
}

// Any link field read from Builder. New content stores a CMSLinkProps object;
// a plain string is still accepted so content saved before the CMSLink
// conversion keeps working. Resolve with resolveLinkHref from @repo/components.
export type LinkValue = CMSLinkProps | string;

export interface Level3Item {
  text: string;
  href: LinkValue;
}

export interface Level2Item {
  text: string;
  href: LinkValue;
  level3?: Level3Item[];
}

export interface Level1Item {
  text: string;
  level2?: Level2Item[];
  href?: LinkValue;
}

export interface NavigationData {
  level1: Level1Item[];
}

export interface Metadata {
  description?: string;
  keywords?: string[];
  breadcrumbTitle?: string;
}

export interface SocialNetwork {
  name: string;
  href: string;
}

// A single redirect rule. `urlFrom`/`urlTo` accept plain paths or Next.js
// path-matching syntax (e.g. `/old/:slug*`). `permanentRedirect` selects the
// HTTP status: true → 308 (permanent), false → 307 (temporary).
export interface UrlRedirect {
  urlFrom: string;
  urlTo: string;
  permanentRedirect?: boolean;
}

// Shape of a `url-redirect` model entry's `data`. A single entry holds many
// rules so all redirects can be managed from one place in the Builder editor.
export interface UrlRedirectData {
  redirects: UrlRedirect[];
}

export interface UrlRedirects extends Content {
  data: UrlRedirectData;
}

export interface PageData {
  title: string;
  image: string;
  metadata: Metadata;
  blocks: any[];
  headerNavigation1?: ModelReference | Navigation;
  headerNavigation2?: ModelReference | Navigation;
  footerNavigation?: ModelReference | Navigation;
}

export interface Content {
  ownerId: string;
  lastUpdateBy: string | null;
  createdDate: number;
  id: string;
  "@version": number;
  name: string;
  modelId: string;
  published: string;
  priority: number;
  query: any[];
  lastUpdated: number;
  firstPublished: number;
  testRatio: number;
  createdBy: string;
  lastUpdatedBy: string;
}

export interface ModelReference {
  "@type": string;
  id: string;
  model: string;
  value: Content;
}

export interface Navigation extends Content {
  data: NavigationData;
}

export interface Page extends Content {
  data: PageData;
}

export interface ArticleData {
  handle: string;
  title: string;
  subtitle: string;
  image: string;
  excerpt: string;
  metadata: Metadata;
  publishDate: string;
  dateModified?: string;
  author?: string;
  blocks: any[];
}

export interface Article extends Content {
  data: ArticleData;
}

export interface Collection extends Content {
  data: {
    handle: string;
    metadata: Metadata;
    isEvent: boolean;
    eventInfo: {
      teaches: string[];
      startDate: string;
      endDate: string;
      attendanceMode: "Online Event" | "In-Person Event" | "Hybrid Event";

    };
    blocks: any[];
  };
}

export interface Product extends Content {
  data: {
    handle: string;
    blocks: any[];
  };
}

export interface AddressData {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Address extends Content {
  data: AddressData;
}

export interface SiteContext extends Content {
  meta: {
    shopifyDomain: string;
    lastPreviewUrl: string;
    kind: string;
  };
  data: {
    siteName: string;
    logo: string;
    organization: {
      name: string;
      address: AddressData;
      description: string;
    };
    contact: {
      telephone: string;
      availableLanguages: { language: string }[];
      email: string;
      areaServed: string;
    };
    headerNavigation1?: ModelReference;
    headerNavigation2?: ModelReference;
    footerNavigation1?: ModelReference;
    socialNetworks?: SocialNetwork[];
    googleAnalyticsId?: string;
  };
  metrics: {
    clicks: number;
    impressions: number;
  };
  variations: Record<string, unknown>;
  folders: any[];
}

export interface Location extends Content {
  data: {
    name: string;
    type: "Place" | "Virtual";
    url: string;
    images: [{ image: string, caption: string }];
    address: AddressData;
  };
}

export interface EventData {
  handle: string;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  startDate: number;
  endDate: number;
  address?: AddressData;
  blocks: any[];
}

export interface Event extends Content {
  data: EventData;
}

// Re-export design-kit interfaces for backward compatibility
//export type { Heroic, Themeable, Opaque, CTA, Stylable, Button, Reversible, Alignable, BackgroundType, LayoutReversal, TextAlignments, Theme, standardThemes, opacityInputs, heroicInputs, themeableInputs, buttonInputs, reversibleInputs, alignableInputs, backgroundInputs, ctaInputs, commonInputs } from "../design-kit";
export * from "../design-kit";
export { getThemeClasses } from "../design-kit";
