import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CenterLogoHeader } from "./index";

const meta = {
  title: "Navigation/CenterLogoHeader",
  component: CenterLogoHeader,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CenterLogoHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultPrimaryNav = {
  data: {
    level1: [
      { text: "Home", href: "/" },
      { text: "About", href: "/about" },
      { text: "Offerings", href: "/offerings" },
      { text: "Services", href: "/services" },
    ],
  },
  ownerId: "",
  lastUpdateBy: null,
  createdDate: 0,
  id: "default",
  "@version": 1,
  name: "Default Navigation",
  modelId: "navigation",
  published: "published",
  priority: 0,
  query: [],
  lastUpdated: 0,
  firstPublished: 0,
  testRatio: 0,
  createdBy: "",
  lastUpdatedBy: "",
};

const defaultSecondaryNav = {
  data: {
    level1: [
      { text: "Podcast", href: "/podcast" },
      { text: "Photography", href: "/photography" },
      { text: "Blog", href: "/blog" },
      { text: "Contact", href: "/contact" },
    ],
  },
  ownerId: "",
  lastUpdateBy: null,
  createdDate: 0,
  id: "default",
  "@version": 1,
  name: "Default Navigation",
  modelId: "navigation",
  published: "published",
  priority: 0,
  query: [],
  lastUpdated: 0,
  firstPublished: 0,
  testRatio: 0,
  createdBy: "",
  lastUpdatedBy: "",
};

export const Default: Story = {
  args: {
    navigation1: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: defaultPrimaryNav,
    },
    navigation2: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: defaultSecondaryNav,
    },
    logo: "https://placehold.co/800x600/EEE/5ce1e6.png",
  },
};

export const WithCustomNav: Story = {
  args: {
    navigation1: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: {
        ...defaultPrimaryNav,
        data: {
          level1: [
            { text: "Dashboard", href: "/dashboard" },
            { text: "Products", href: "/products" },
            { text: "Analytics", href: "/analytics" },
          ],
        },
      },
    },
    navigation2: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: {
        ...defaultSecondaryNav,
        data: {
          level1: [
            { text: "Settings", href: "/settings" },
            { text: "Support", href: "/support" },
          ],
        },
      },
    },
    logo: "/SMA_Logo_Dark_Slim.avif",
  },
};
