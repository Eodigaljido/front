import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { View } from "react-native";
import { fn } from "storybook/test";

import { MessageInput } from "./MessageInput";

const meta = {
  title: "Chat/MessageInput",
  component: MessageInput,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Story />
      </View>
    ),
  ],
  tags: ["autodocs"],
  args: { onSend: fn() },
} satisfies Meta<typeof MessageInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // placeholder: "메세지를 입력",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "입력할 수 없습니다.",
    disabled: true,
  },
};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "여기에 메세지를 입력해주세요.",
  },
};
