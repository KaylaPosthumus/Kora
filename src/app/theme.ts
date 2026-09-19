import type { ThemeConfig } from "antd";
import { theme } from "antd";

/**
 * The Ant Design theme.
 *
 * Lifted out of `App.tsx`, where it was ~150 of that file's 247 lines and the
 * reason the shell was hard to read. It is also the whole of Ant's half of the
 * rebrand (Phase 8): the palette below is still Coriander's
 * `korablue`/`korastone`, and swapping it is an edit to this file plus
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
          colorPrimary: "#2C6FB5",
          colorPrimaryHover: "#22588F",
          colorPrimaryActive: "#1A426C",
          colorPrimaryText: "#0A1826",
          colorPrimaryTextHover: "#0A1826",
          colorPrimaryTextActive: "#0A1826",

          // Text Colors
          colorText: "#2B2B28", // korastone-900
          colorTextSecondary: "#73736E", // korastone-700
          colorTextTertiary: "#9C9C97", // korastone-600

          // Background Colors
          // These three read `warmstone-*` in the comments but held Tailwind's own
          // stone defaults, which were close enough to the old beige to pass. They
          // are the real ramp now, so Ant's surfaces and Tailwind's agree.
          colorBgContainer: "#FDFDFC", // korastone-50
          colorBgElevated: "#FAFAF9", // korastone-100
          colorBgLayout: "#F4F4F2", // korastone-200

          // Border Colors
          // Borders come off the brand ramp too. At a near-white ground the
          // border is what separates a card from the page, so it is the 300 step
          // rather than a lighter one.
          colorBorder: "#E8E8E4", // korastone-300
          colorBorderSecondary: "#F4F4F2", // korastone-200

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
            labelColor: "#73736E", // korastone-700
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
            colorBgSolidHover: "#F4F4F2",
            borderRadiusLG: 16,
            headerBg: "#F4F4F2",
            headerBorderRadius: 16,
            headerSplitColor: "transparent",
            headerColor: "#73736E",
            headerFilterHoverBg: "transparent",
            headerSortActiveBg: "transparent",
            headerSortHoverBg: "transparent",
          },
        },
};
