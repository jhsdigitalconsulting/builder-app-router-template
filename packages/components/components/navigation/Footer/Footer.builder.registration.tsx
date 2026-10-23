import type { RegisteredComponent } from "@builder.io/sdk-react";
import { standardThemes, withImage } from "../../../registry/shared";
import Footer from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: Footer,
    name: "Footer",
    ...withImage(),
    inputs: [
      {
        name: "theme",
        type: "string",
        enum: standardThemes,
        defaultValue: "dark",
        friendlyName: "Theme",
        helperText: "Visual theme for the footer background, text and links.",
      },
      {
        name: "logo",
        type: "file",
        allowedFileTypes: ["jpeg", "jpg", "png", "svg", "webp", "gif"],
        friendlyName: "Logo",
        helperText: "Leave empty to use the logo from the Site context.",
      },
      {
        name: "navigation",
        type: "reference",
        model: "navigation",
        friendlyName: "Footer Navigation",
        helperText:
          "Pick the Navigation entry shown here. Leave empty to use the built-in default menu.",
      },
      {
        name: "socialNetworks",
        type: "list",
        subFields: [
          { name: "name", type: "string" },
          { name: "href", type: "string" },
        ],
      },
    ],
  },
];
