import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Footer as GlobalFooter } from "./index";

const meta = {
  title: "Navigation/GlobalFooter",
  component: GlobalFooter,
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
} satisfies Meta<typeof GlobalFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
