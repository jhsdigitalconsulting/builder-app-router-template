import type { RegisteredComponent } from "@builder.io/sdk-react";
import { themeableInputs, withImage, type Inputs } from "../../../registry/shared";
import Button from "./index";

// Inputs are shared between the hidden Core:Button override and the visible
// Button entry, so define them once.
const buttonInputs: Inputs = [
  ...themeableInputs,
  {
    name: "maskOpacity",
    type: "number",
    defaultValue: 0.3,
    min: 0,
    max: 1,
    step: 0.1,
    helperText: "Opacity of the overlay mask (0-1)",
  },
  {
    name: "outlined",
    type: "boolean",
    defaultValue: false,
    helperText: "Use outlined button style instead of filled",
  },
  {
    name: "label",
    type: "string",
    required: true,
    defaultValue: "Learn More",
    helperText: "The text content of the button",
  },
  {
    name: "href",
    type: "CMSLink",
    defaultValue: { type: "url", href: "#" },
    helperText: "Where the button links to: a page or entry in Builder, or an external URL",
  },
  {
    name: "className",
    type: "string",
    advanced: true,
    defaultValue: "",
    helperText: "Additional CSS classes to apply to the button",
  },
];

// Registering both a hidden Core:Button override and a visible Button keeps
// Builder's built-in button mapped to this component while still exposing it
// in the insert menu. Both entries are kept intentionally — do not collapse.
export const registration: RegisteredComponent[] = [
  {
    component: Button,
    name: "Core:Button",
    hideFromInsertMenu: true,
    override: false,
    ...withImage(),
    inputs: buttonInputs,
  },
  {
    component: Button,
    name: "Button",
    override: true,
    ...withImage(),
    inputs: buttonInputs,
  },
];
