import type { LinkValue } from "../cms";

export const ctaInputs = [
    {
      name: "ctaText",
      type: "string",
      defaultValue: "Learn More",
      helperText: "Primary call-to-action button text",
    },
    {
      name: "ctaUrl",
      type: "CMSLink",
      defaultValue: { type: "url", href: "#" },
      helperText: "Where the primary call to action links to: a page or entry in Builder, or an external URL",
    },
    {
      name: "secondaryCtaText",
      type: "string",
      defaultValue: "",
      helperText: "Secondary call-to-action button text (optional)",
    },
    {
      name: "secondaryCtaUrl",
      type: "CMSLink",
      defaultValue: { type: "url", href: "#" },
      helperText: "Where the secondary call to action links to",
    },
  ] as const;

  export interface CTA {
    ctaText: string;
    ctaUrl: LinkValue;
    secondaryCtaText?: string;
    secondaryCtaUrl?: LinkValue;
  }
