import type { ThemeConfig } from "antd";
import { theme } from "antd";

/**
 * The Ant Design theme.
 *
 * Lifted out of `App.tsx`, where it was ~150 of that file's 247 lines and the
 * reason the shell was hard to read. It is also the whole of Ant's half of the
 * rebrand (Phase 8): the palette below is still Coriander's
 * `corigreen`/`warmstone`, and swapping it is an edit to this file plus
 * `tailwind.config.js`, rather than a sweep.
 *
 * The hex values are duplicated from the Tailwind palette rather than imported
 * from it — Ant needs literal colours at config time and Tailwind's are produced
 * by its own build. The comments name the Tailwind token each one mirrors, so a
 * change to one side is findable from the other.
 */
export const koraTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
        token: {
          // Primary Colors
          colorPrimary: "#88A764",
          colorPrimaryHover: "#6D8650",
          colorPrimaryActive: "#52643C",
          colorPrimaryText: "#1B2114",
          colorPrimaryTextHover: "#1B2114",
          colorPrimaryTextActive: "#1B2114",

          // Text Colors
          colorText: "#18181b", // zinc-900
          colorTextSecondary: "#71717a", // zinc-500
          colorTextTertiary: "#a1a1aa", // zinc-400

          // Background Colors
          colorBgContainer: "#fafaf9", // warmstone-50
          colorBgElevated: "#f5f5f4", // warmstone-100
          colorBgLayout: "#e7e5e4", // warmstone-200

          // Border Colors
          colorBorder: "#d4d4d8", // zinc-300
          colorBorderSecondary: "#e4e4e7", // zinc-200

          // Component Specific
          borderRadius: 16, // rounded-2xl
          borderRadiusLG: 24,
          borderRadiusSM: 8,
          borderRadiusXS: 4,

          // Font
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeightStrong: 600,

          // Control
          controlHeight: 40,
          controlHeightLG: 48,
          controlHeightSM: 32,
          controlPaddingHorizontal: 16,
          controlPaddingHorizontalSM: 12,

          // Layout
          margin: 16,
          marginLG: 24,
          marginSM: 12,
          marginXS: 8,
          marginXXS: 4,
          padding: 16,
          paddingLG: 24,
          paddingSM: 12,
          paddingXS: 8,
          paddingXXS: 4,
        },
        // Components
        components: {
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            controlHeightLG: 48,
            controlHeightSM: 32,
            paddingInline: 16,
            paddingBlock: 8,
            lineHeight: 1.5,
          },
          DatePicker: {
            borderRadius: 8,
            controlHeight: 40,
            paddingBlock: 8,
            paddingInline: 12,
            lineHeight: 1.5,
          },
          Modal: {
            borderRadiusLG: 32,
            paddingContentHorizontal: 32,
            paddingContentVertical: 24,
            titleFontSize: 24,
            lineHeight: 1.5,
          },
          Card: {
            borderRadius: 16,
            padding: 24,
            lineHeight: 1.5,
          },
          Typography: {
            margin: 0,
            padding: 0,
          },
          Form: {
            labelFontSize: 12,
            labelColor: "#71717a", // zinc-500
            verticalLabelPadding: 2,
            fontSize: 12,
          },
          Input: {
            borderRadius: 8,
            controlHeight: 48,
          },
          Select: {
            borderRadius: 8,
            controlHeight: 48,
            borderRadiusLG: 8,
          },
          Dropdown: {
            borderRadiusLG: 16,
          },
          Table: {
            colorBgSolidHover: "#e7e5e4",
            borderRadiusLG: 16,
            headerBg: "#e7e5e4",
            headerBorderRadius: 16,
            headerSplitColor: "transparent",
            headerColor: "#71717a",
            headerFilterHoverBg: "transparent",
            headerSortActiveBg: "transparent",
            headerSortHoverBg: "transparent",
          },
        },
};
