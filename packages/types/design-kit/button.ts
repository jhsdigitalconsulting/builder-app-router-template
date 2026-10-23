import type { LinkValue } from "../cms";

export const buttonInputs = [
    {
      name: "buttonLabel",
      type: "string",
      defaultValue: "LEARN MORE",
      helperText: "Call-to-action button text",
    },
    {
      name: "buttonHref",
      type: "CMSLink",
      defaultValue: { type: "url", href: "#" },
      helperText: "Where the button links to: a page or entry in Builder, or an external URL",
    },
  ] as const;

  export interface Button {
    buttonLabel: string;
    buttonHref: LinkValue;
  }
