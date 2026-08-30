---
name: Continuity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#42474f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727780'
  outline-variant: '#c2c7d1'
  surface-tint: '#2d6197'
  primary: '#00355f'
  on-primary: '#ffffff'
  primary-container: '#0f4c81'
  on-primary-container: '#8ebdf9'
  inverse-primary: '#a0c9ff'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#003c27'
  on-tertiary: '#ffffff'
  tertiary-container: '#005539'
  on-tertiary-container: '#3dd197'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a0c9ff'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#07497d'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  trust-blue: '#0F4C81'
  safety-orange: '#F97316'
  calm-green: '#10B981'
  slate-900: '#0F172A'
  slate-50: '#F8FAFC'
  critical-red: '#DC2626'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  timer-display:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1024px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system for the product focuses on **High-Reliability Modernism**. The brand personality is "The Professional Neighbor"—competent, prepared, and unwavering, yet warm enough to be trusted with a child's safety. The emotional response must move the user from panic (at 7:40 am) to a state of "handled."

The visual style is **Corporate / Modern** with a lean toward **Minimalism**. It prioritizes utility and clarity over decorative elements. By utilizing high-contrast typography, a structured grid, and purposeful color application, the UI avoids the "playful" tropes of childcare and instead adopts the visual language of essential services like healthcare or high-end logistics. This creates a psychological sense of "childcare that never doesn't show up."

Key principles:
- **Zero-Latency Visuals:** Information must be scannable in seconds under high-stress conditions.
- **Unambiguous Actions:** Buttons and status indicators use high-contrast signals.
- **Dignity in Utility:** Professional aesthetics for caregivers, respecting their role as essential skilled workers.

## Colors

The palette is anchored by **Trust Blue**, a deep, authoritative navy that suggests stability and institutional strength. **Safety Orange** is used sparingly for high-priority alerts and critical actions that require immediate parent intervention (e.g., reporting an absence). **Calm Green** signifies successful check-ins and filled positions.

The background uses a "Soft Professional" scheme: **Slate-50** for page backgrounds to reduce harshness, and pure white for cards to create distinct content layers. Text uses **Slate-900** for maximum legibility against light backgrounds. Primary actions use Trust Blue to reinforce the brand with every click.

## Typography

This design system uses a **System Sans-Serif Stack (Inter)** for primary communication to ensure zero-loading lag and native familiarity. It is optimized for high-speed reading.

- **Headlines:** Bold and tight-tracking for an editorial, authoritative feel.
- **Labels:** We use **JetBrains Mono** for secondary data points like flat numbers, block IDs, and timestamps. The monospaced nature helps differentiate "data" from "narrative" and adds a technical, reliable "logbook" aesthetic.
- **The Clock:** The 90-minute countdown is rendered in large-scale JetBrains Mono to emphasize the precision of the dispatch engine.
- **Hierarchy:** Use heavy weights (700) for primary headers and lighter weights (400) for supporting body text to guide the eye immediately to the most important status information.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop and a **Fluid Single Column** on mobile. Given the context of a "gated community," the design should feel contained and secure.

- **Desktop:** 12-column grid, max-width of 1024px, centered. This keeps information dense and accessible without excessive eye travel.
- **Mobile:** Single column with 16px margins. Information is stacked vertically.
- **Spacing Rhythm:** Based on a 4px baseline. Components are separated by "Stack" units (16px or 32px) to ensure clear tap targets for stressed users.
- **Dashboard Priority:** The "Active Status" card (the clock or check-in status) always sits at the top of the stack, pinned if necessary, to ensure it is the first thing seen at 7:40 am.

## Elevation & Depth

We avoid complex shadows to maintain a clean, high-reliability aesthetic. Hierarchy is achieved through **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface 0 (Background):** Slate-50.
- **Surface 1 (Cards):** Pure White with a 1px border of Slate-200. No shadow.
- **Surface 2 (Active/Modal):** Pure White with a soft, 8% opacity Trust Blue shadow (0px 4px 12px) to suggest focus without looking "gamey."
- **Interactive States:** Buttons use a subtle darkening of the background color on hover, rather than an elevation change. This keeps the interface feeling "flat" and sturdy.

## Shapes

The design uses a **Soft (0.25rem)** roundedness level. This provides enough softening to feel "approachable" for families while maintaining the crisp, professional edges of a reliability-focused service.

- **Buttons:** 0.25rem (4px) corner radius.
- **Cards:** 0.5rem (8px) corner radius.
- **Input Fields:** 0.25rem (4px) corner radius to match buttons, creating a unified form language.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.

## Components

- **Primary Action Buttons:** Trust Blue background with White text. Bold, sentence case (e.g., "Schedule shift").
- **Critical Action Buttons:** Safety Orange or Critical Red for "Report absence." These must have a confirmation modal to prevent accidental triggers.
- **Status Chips:** Use a combination of a colored dot and JetBrains Mono text. (e.g., Green dot + "CHECKED IN").
- **Offer Cards:** On the caregiver view, these must be high-contrast with clear "Accept" (Green) and "Decline" (Ghost style) actions.
- **The Dispatch Clock:** A prominent card featuring the monospaced timer. Below the timer, a progress bar or "step indicator" shows the current search status (Searching > Awaiting Consent > Filled).
- **List Items:** Simple 1px bottom border. Include a chevron for navigable items. Use JetBrains Mono for times and dates to ensure vertical alignment of digits.
- **Input Fields:** Thick 2px borders when focused in Trust Blue to ensure the user knows exactly where they are typing during a stressful morning.