# FIRE Business Calculator — Live DOM Map

Purpose: record the current LIVE calculator's rendered section structure so the unified shared core can be aligned to the live app instead of inferred from the older recovery shell.

Status: staging audit artifact. Production is unchanged.

## Confirmed live rendered section IDs

- `#view-mix` — SH Mix
- `#view-delivery` — Equipment / X-Jet / delivery calculations
- `#view-chemicals` — Chemicals
- `#view-index` — Chemical Index
- `#view-job` — Job Math
- `#view-tools` — Field Tools
- `#view-guide` — Field Guide

The existing independent/recovery app currently uses shorter IDs such as `#mix`, `#equipment`, `#chemicals`, `#index`, `#job`, `#tools`, and `#guide`. Those are structurally different even where user-visible labels are similar.

## Confirmed live navigation model

Top navigation baseline:

1. SH Mix
2. Equipment
3. Chemicals
4. Chemical Index
5. Job Math
6. Field Guide

Field Tools is not shown as an additional top tab in the live baseline evidence used for this audit; Tools remains available through the bottom navigation.

Bottom navigation baseline:

1. SH Mix
2. Equipment
3. Mixes
4. Index
5. Job Math
6. Tools

## Confirmed live Job Math quick menu

The live header contains a dedicated Job Math quick-navigation element:

- id: `#topJobNav`
- class: `.top-job-nav`
- aria label: `Job Math quick menu`

Confirmed quick-menu labels and staging target IDs:

1. `Mix plan` → `jobMixCard`
2. `Measure` → `jobMeasureCard`
3. `Estimate` → `jobEstimateCard`
4. `Loadout` → `jobLoadoutCard`

This menu is a Job Math-specific navigation control, not a generic floating menu. Staging must show it only while Job Math is active and must scroll to the corresponding major Job Math card.

## Confirmed live header detail

The live rendered header uses a dedicated stock-strength pill:

- class: `.stock-pill`
- text pattern: `Stock SH 10%`
- percentage element: `#stockPill`

This is a visual/structural target for the shared core and should not be approximated with a differently styled status badge once final visual parity work begins.

## Confirmed live Equipment structure

The Equipment screen is rendered under `#view-delivery` and begins with the live card:

- `X-Jet M5DS Twist — 3–7 GPM`

Confirmed live Equipment ordering target:

1. X-Jet M5DS Twist — 3–7 GPM
2. Mix the X-Jet pickup bucket for a target strength
3. X-Jet bucket draw test
4. Estimate strength hitting the surface
5. Find your real injector ratio
6. Three-port proportioner planner
7. Fill-time estimate

## Shared-core implication

The synchronized release should ultimately use one DOM/route model for both deployments. Infrastructure adapters may select hosting/storage behavior but must not fork section structure or navigation behavior.

Until the shared core is rebuilt around the live structure and visually/statefully verified, these remain separate implementations and release status stays NOT SYNCHRONIZED.
