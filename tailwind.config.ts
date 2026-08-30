import type { Config } from "tailwindcss";

/**
 * The "Continuity" design system — see design/DESIGN.md.
 *
 * High-reliability modernism: the visual language of healthcare and logistics
 * rather than the pastel tropes of childcare, because the job of this interface
 * is to move a parent from panic to "handled" in fifteen seconds.
 */
const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Trust Blue. Every primary action, so the brand is reinforced on each
        // click rather than sitting in a logo.
        trust: {
          DEFAULT: "#0F4C81",
          deep: "#00355F",
          hover: "#07497D",
          tint: "#EFF4FF",
          edge: "#DCE9FF",
        },
        // Reserved for things that need a parent to act right now. Used
        // sparingly on purpose - if everything is urgent, nothing is.
        safety: "#F97316",
        // Arrivals and filled searches. The only colour that means "resolved".
        calm: "#10B981",
        critical: "#DC2626",

        canvas: "#F8FAFC",
        ink: {
          DEFAULT: "#0F172A",
          soft: "#42474F",
          faint: "#727780",
        },
        edge: {
          DEFAULT: "#E2E8F0",
          strong: "#C2C7D1",
        },
      },
      // System stacks, never next/font with Google Fonts: a build-time font
      // fetch is one more way a deploy can fail, and the design's own reason for
      // Inter is "zero-loading lag", which a system stack delivers better.
      // The mono stack carries every time, date and identifier - monospace
      // separates data from narrative and keeps digits vertically aligned.
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      fontSize: {
        // The dispatch clock. Deliberately oversized: it is the one number that
        // answers "is this being handled?" from across a kitchen.
        timer: ["2.75rem", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "timer-sm": ["2rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
      },
      letterSpacing: {
        caps: "0.06em",
      },
      maxWidth: {
        app: "42rem",
      },
      boxShadow: {
        // Surface 2 only. Hierarchy comes from tonal layers and outlines, not
        // from stacking shadows.
        focus: "0 4px 12px rgba(15, 76, 129, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
