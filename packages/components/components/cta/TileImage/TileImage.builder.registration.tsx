import type { RegisteredComponent } from "@builder.io/sdk-react";
import {
  themeableInputs,
  opacityInputs,
  alignableInputs,
  commonInputs,
  withImage,
} from "../../../registry/shared";
import TileImage from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: TileImage,
    name: "TileImage",
    friendlyName: "Tile Image",
    ...withImage(),
    inputs: [
      ...themeableInputs,
      ...opacityInputs,
      ...alignableInputs,
      {
        name: "image",
        type: "file",
        allowedFileTypes: ["jpeg", "jpg", "png", "webp", "avif"],
        required: true,
        defaultValue: "https://placehold.co/400x300/EEE/5ce1e6.png",
        helperText: "Background image for the tile",
      },
      {
        name: "title",
        type: "string",
        required: true,
        defaultValue: "Your Title",
        helperText: "Title displayed over the image (renders as h6)",
      },
      {
        name: "content",
        type: "html",
        required: true,
        defaultValue: "Add your content description here.",
        helperText:
          "Description content displayed over the image (supports HTML formatting)",
      },
      {
        name: "buttonLabel",
        type: "string",
        defaultValue: "Learn More",
        helperText: "Text for the CTA button. Leave empty to hide button.",
      },
      {
        name: "buttonHref",
        type: "CMSLink",
        defaultValue: { type: "url", href: "#" },
        helperText: "Where the button links to: a page or entry in Builder, or an external URL",
        showIf: "options.get('buttonLabel')",
      },
      ...commonInputs,
    ],
    defaultStyles: {
      marginBottom: "20px",
    },
  },
];
