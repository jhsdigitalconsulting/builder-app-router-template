import type { RegisteredComponent } from "@builder.io/sdk-react";
import { themeableInputs, heroicInputs, withImage } from "../../../registry/shared";
import Tabs from "./index";

export const registration: RegisteredComponent[] = [
  {
    component: Tabs,
    name: "Tabs",
    friendlyName: "Tabs",
    ...withImage(),
    shouldReceiveBuilderProps: {
      builderBlock: true,
      builderContext: true,
    },
    inputs: [
      ...themeableInputs,
      ...heroicInputs,
      {
        name: "tabs",
        type: "list",
        defaultValue: [
          {
            headline: "Tab 1",
            type: "content",
            content: { blocks: [] },
          },
          {
            headline: "Tab 2",
            type: "content",
            content: { blocks: [] },
          },
          {
            headline: "Tab 3",
            type: "content",
            content: { blocks: [] },
          },
        ],
        subFields: [
          {
            name: "headline",
            type: "string",
            defaultValue: "Tab Title",
            helperText: "Tab title displayed in navigation",
          },
          {
            name: "type",
            type: "string",
            enum: ["content", "link"],
            defaultValue: "content",
            helperText:
              "Tab type: content (shows blocks) or link (navigates to URL)",
          },
          {
            name: "content",
            type: "uiBlocks",
            hideFromUI: true,
            showIf: (options) => options.get("type") === "content",
            defaultValue: {
              blocks: [],
            },
            helperText: "Content blocks to display when tab is active",
          },
          {
            name: "href",
            type: "CMSLink",
            defaultValue: { type: "url", href: "#" },
            showIf: (options) => options.get("type") === "link",
            helperText: "Where the tab links to: a page or entry in Builder, or an external URL",
          },
        ],
        helperText: "List of tabs to display",
      },
    ],
    defaultStyles: {
      display: "block",
    },
  },
];
