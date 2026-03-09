declare module '@expo/vector-icons' {
  import { Component } from 'react';
  export const Ionicons: React.ComponentType<{
    name: string;
    size?: number;
    color?: string;
    [key: string]: unknown;
  }>;
}
