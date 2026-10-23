import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Header } from "./index";

const meta = {
  title: "Navigation/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    theme: {
      control: "select",
      options: ["light", "dark", "accent", "gradient", "transparent-light", "transparent-dark"],
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

const navAttributes = {
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

const defaultNav = {
  data: {
    level1: [
      { text: "Home", href: "/" },
      { text: "About", href: "/about" },
      { text: "Services", href: "/services" },
      { text: "Blog", href: "/blog" },
      { text: "Contact", href: "/contact" },
    ],
  },
  ...navAttributes,
};

export const Default: Story = {
  args: {
    navigation: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: defaultNav,
    },
    logo: "https://placehold.co/400x100.png?text=Logo",
  },
};

export const WithDropdowns: Story = {
  args: {
    navigation: {
      "@type": "@builder.io/core:Reference",
      id: "mock",
      model: "navigation",
      value: {
        ...navAttributes,
        data: {
          level1: [
            { text: "Home", href: "/" },
            {
              text: "Services",
              level2: [
                { text: "Consulting", href: "/services/consulting" },
                {
                  text: "Development",
                  href: "/services/development",
                  level3: [
                    { text: "Web", href: "/services/development/web" },
                    { text: "Mobile", href: "/services/development/mobile" },
                  ],
                },
              ],
            },
            { text: "Blog", href: "/blog" },
            { text: "Contact", href: "/contact" },
          ],
        },
      },
    },
    logo: "https://placehold.co/400x100.png?text=Logo",
  },
};

export const Dark: Story = {
  args: {
    ...Default.args,
    theme: "dark",
  },
};
