import type { RegisteredComponent } from "@builder.io/sdk-react";
import { standardThemes, withImage } from "../../../registry/shared";
import Header from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: Header,
    name: "Header",
    ...withImage(),
    inputs: [
      {
        name: "theme",
        type: "string",
        enum: standardThemes,
        defaultValue: "light",
        friendlyName: "Theme",
        helperText: "Visual theme for the header background, text and links.",
      },
      {
        name: "navigation",
        type: "reference",
        model: "navigation",
        friendlyName: "Navigation",
        helperText:
          "Pick the Navigation entry shown here. Leave empty to use the built-in default menu.",
      },
      {
        name: "logo",
        type: "file",
        allowedFileTypes: ["jpeg", "jpg", "png", "svg", "webp", "gif"],
        friendlyName: "Logo",
        helperText: "Leave empty to use the logo from the Site context.",
      },
    ],
  },
];
