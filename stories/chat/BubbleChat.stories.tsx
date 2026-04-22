import type { Meta, StoryObj } from "@storybook/react";

import { BubbleChat } from "./BubbleChat";

const meta = {
  title: "Chat/BubbleChat",
  component: BubbleChat,
  tags: ["autodocs"],
} satisfies Meta<typeof BubbleChat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "안녕하세요! 반갑습니다.",
    isMine: false,
    sentAt: new Date(),
    profileImageUrl: "https://avatars.githubusercontent.com/u/108007761?v=4",
    userName: "홍길동",
  },
};

export const MyMessage: Story = {
  args: {
    text: "안녕하세요! 반갑습니다.",
    isMine: true,
    sentAt: new Date(),
  },
};
