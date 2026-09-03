# MIK Design Scheme for Yonder Graph

A cohesive design system and color palette adapted directly from **Michaels Arts & Crafts** ([michaels.com](https://www.michaels.com/)) for **Yonder Graph**.

Machine-readable JSON schema is available in [mik_design_scheme.json](file:///Users/arkopalbhattacharya/source/yonder-graph/docs/assets/mik_design_scheme.json).

---

## 1. Brand Tokens Overview

| Token | Name | Hex | Role & Description |
| :--- | :--- | :--- | :--- |
| `primary-default` | Michaels Red | `#CF1F2E` | Signature crimson red for primary CTAs and active states |
| `red-600` | Crimson Dark | `#C53030` | Hover and active pressed state |
| `gray-1000` | Deep Charcoal | `#1B1B1B` | High-contrast dark neutral for text and primary elements |
| `secondary-1` | Maker Coral | `#ED7064` | Warm coral accent for highlights and column nodes |
| `secondary-2` | Craft Gold | `#EBAB33` | Amber gold for warnings and runbooks |
| `secondary-3` | Maker Teal | `#009783` | Deep teal for success states and domain nodes |
| `secondary-4` | Studio Blue | `#0475BC` | Technical blue for links, tables, and telemetry |

---

## 2. Light Mode (`mik-light`: "MIK Studio Light")

Designed for clean daytime workspace ergonomics, featuring warm off-white canvas, stark charcoal typography, crisp card panels, and signature crimson interactive elements.

```
┌──────────────────────────────────────────────────────────┐
│ Canvas: #F8F8F9  |  Panel: #FFFFFF  |  Border: #E5E7EB   │
│ Text Primary: #1B1B1B   |   Text Secondary: #5F5F5F     │
│ Brand Primary: #CF1F2E  |   Hover: #B71825               │
└──────────────────────────────────────────────────────────┘
```

| UI Element | Color Name | Hex Code | Purpose in Yonder Graph |
| :--- | :--- | :--- | :--- |
| **Canvas / Background** | Studio White | `#F8F8F9` | Page root background, graph viewport |
| **Panels & Cards** | Crisp White | `#FFFFFF` | Sidebar, drawer, modals, copilot box |
| **Surface Subtle** | Pearl Soft | `#F2F2F4` | Badge backgrounds, input containers |
| **Borders & Dividers** | Border Gray | `#E5E7EB` | Card outlines, tab separators |
| **Borders Subtle** | Thin Line | `#EAEAEA` | Header dividers, row borders |
| **Primary Text** | Deep Charcoal | `#1B1B1B` | Headings, prompt text, graph node titles |
| **Secondary Text** | Slate Muted | `#5F5F5F` | Subtitles, timestamps, JSON keys |
| **Primary Action** | Michaels Red | `#CF1F2E` | Primary buttons, active tabs |
| **Action Hover** | Deep Crimson | `#B71825` | Button hover states |
| **Terminal / Code BG** | Carbon Zinc | `#18181B` | Monospace query boxes & log feeds |

---

## 3. Dark Mode (`mik-dark`: "MIK Craft Carbon Dark")

A tailored dark mode built around Michaels' charcoal neutral (`#1B1B1B`), avoiding cold blues for a richer studio craft environment with high-contrast crimson accents.

```
┌──────────────────────────────────────────────────────────┐
│ Canvas: #0F0F12  |  Panel: #18181C  |  Border: #2D2D35   │
│ Text Primary: #F5F5F7   |   Text Secondary: #9E9EA8     │
│ Brand Primary: #E53E3E  |   Hover: #FF5A65               │
└──────────────────────────────────────────────────────────┘
```

| UI Element | Color Name | Hex Code | Purpose in Yonder Graph |
| :--- | :--- | :--- | :--- |
| **Canvas / Background** | Carbon Deep | `#0F0F12` | Full app background, graph canvas |
| **Panels & Cards** | Dark Charcoal | `#18181C` | Left navigation, slide-over panels |
| **Surface Subtle** | Charcoal Surface | `#222227` | Filter bars, popovers, nested cards |
| **Borders & Dividers** | Charcoal Border | `#2D2D35` | Card outlines, modal headers |
| **Borders Subtle** | Faint Border | `#222227` | Sub-item separators, table borders |
| **Primary Text** | Clean Off-White | `#F5F5F7` | Body text, titles, LLM reasoning |
| **Secondary Text** | Muted Silver | `#9E9EA8` | Metadata, token metrics, descriptions |
| **Primary Action** | Vibrant Crimson | `#E53E3E` | Primary CTAs, active indicators |
| **Action Hover** | Bright Crimson | `#FF5A65` | CTA hover state |
| **Action Active/Glow** | Velvet Crimson | `#3A1418` | Active pill background, selected node glow |
| **Terminal / Code BG** | Pitch Black | `#09090B` | Cypher query viewer, raw log console |

---

## 4. Graph Taxonomy & Semantic Status Mapping

Direct mapping to Michaels brand accent colors for Yonder Graph's [GraphVisualizer.jsx](file:///Users/arkopalbhattacharya/source/yonder-graph/frontend/src/components/GraphVisualizer.jsx):

| Node / Status Entity | Source Token | Light Mode Hex | Dark Mode Hex |
| :--- | :--- | :--- | :--- |
| **Domain** | `secondary-3` (Teal) | `#009783` | `#14B8A6` |
| **Table** | `secondary-4` (Studio Blue) | `#0475BC` | `#38BDF8` |
| **Column** | `peach-500` (Coral) | `#ED7064` | `#FB7185` |
| **SOPRunbook** | `secondary-2` (Amber/Gold) | `#D97706` | `#FBBF24` |
| **BYConfig** | `primary-default` (Michaels Red) | `#CF1F2E` | `#F87171` |
| **BusinessFlow** | `gray-500` (Slate) | `#757575` | `#94A3B8` |
| **BusinessTerm** | `gray-600` (Dark Slate) | `#5F5F5F` | `#64748B` |
| **Success** | `semantics-success` | `#00856D` | `#34D399` |
| **Warning** | `semantics-warning` | `#A85D00` | `#F59E0B` |
| **Error / Alert** | `semantics-error` | `#EB003B` | `#F87171` |
