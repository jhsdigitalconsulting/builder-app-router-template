import type { RegisteredComponent } from "@builder.io/sdk-react";
import { withImage } from "../../../registry/shared";
import CenterLogoHeader from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: CenterLogoHeader,
    name: "CenterLogoHeader",
    friendlyName: "Center Logo Header",
    ...withImage(),
    inputs: [
      {
        name: "navigation1",
        type: "reference",
        model: "navigation",
        friendlyName: "Primary Navigation",
        helperText:
          "Pick the Navigation entry shown here. Leave empty to use the built-in default menu.",
      },
      {
        name: "navigation2",
        type: "reference",
        model: "navigation",
        friendlyName: "Secondary Navigation",
        helperText:
          "Pick the Navigation entry shown here. Leave empty to use the built-in default menu.",
      },
      {
        name: "logo",
        type: "string",
        friendlyName: "Logo URL",
        defaultValue: "https://placehold.co/400x100.png?text=Logo",
      },
    ],
  },
];
