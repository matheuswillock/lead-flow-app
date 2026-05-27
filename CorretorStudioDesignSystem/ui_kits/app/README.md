# Corretor Studio — UI Kit

A pixel-honest, click-through recreation of the highest-signal surfaces in the Corretor Studio CRM, built from the live codebase (`lead-flow-app/`).

## Surfaces covered

| Screen | Why it's here |
|---|---|
| **Landing** | The brand's most decorated surface — hero, gradient headline, feature bento, demo form. Sets the warm voice. |
| **Kanban board** | The product's centerpiece. Drag-and-drop lead pipeline with orange column headers and dense lead cards. |
| **Dashboard** | The opening view post-login. Metric cards (success/warning/info/purple tints), area chart, upcoming meetings list. |

## Files

```
index.html                — interactive click-through (Landing → Board → Dashboard)
AppShell.jsx              — sidebar + topbar that wraps all logged-in screens
LandingScreen.jsx         — hero + announcement pill + bento features + demo form
KanbanScreen.jsx          — board with five columns + draggable lead cards
DashboardScreen.jsx       — metric grid + area chart + upcoming meetings
shared.jsx                — Logo, Button, Badge, Card, Avatar, Input, helpers
```

## What's not pixel-perfect

- The area chart is a hand-coded SVG, not Recharts. Shape and tints match.
- Drag-and-drop is faked — clicking a lead card moves it to the next column to demonstrate the motion language without bundling `@hello-pangea/dnd`.
- The sidebar's "Team Activity" presence list is stubbed with three avatars.
- All Lucide icons are inline SVGs (1.5px stroke, rounded caps) so the kit has zero runtime dependencies beyond React + Babel.

## Running

Open `index.html`. It uses React 18.3 + Babel via CDN, no build step.
