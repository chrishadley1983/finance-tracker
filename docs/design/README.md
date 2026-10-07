# Hadley Finance Tracker: design guide

Agreed in the October 2026 redesign. The Review queue (`components/review`),
the Transactions page (`components/transactions`) and the navigation shell
(`components/layout`) are the reference implementations: when in doubt, match them.

## Principles

- **Open with a sentence, not tiles.** A page starts with one plain-English line
  saying where things stand ("You've spent £2,148 of a £3,400 plan, a little
  ahead of pace."), using `PageIntro`. Big-number tile rows are out; if one
  figure matters most (e.g. net worth), show it once, large.
- **Colour means something.** Spending is shown in ink, never red. Money in uses
  `text-in` with a leading `+`. `warn` (amber) = ahead of pace / needs attention.
  `bad` (red) = a real problem: over budget, failed, error. Accent green is the
  brand and primary actions; at most one primary button per view.
- **Money is set in mono.** Wrap amounts in `.fig` (IBM Plex Mono, tabular
  figures). Summaries use whole pounds (`formatGBP(x)`); ledgers and
  transaction rows use pence (`formatGBP(x, { pence: true })`). Dates and
  labels use the UI face.
- **Hairlines, not cards.** Page sections are `Panel` (default `open`: a top rule,
  no box). Use `Panel variant="boxed"` only for something that is a separate
  object: a table, a form, a list you act on. No shadows except floating
  popovers and dialogs. Radius: `rounded-md` (6px) on controls, 3px on boxes.
- **Plain copy.** Name things the way a person would ("Enter month-end
  balances", not "Create snapshot"). Buttons say what happens. Errors say what
  went wrong and what to do. No emoji, no exclamation marks, no "Welcome back".
- **Confidence numbers only when they matter.** Show "unsure" when confidence
  is low; don't print 96% on every row.
- **Numbers are rounded for reading**: "about a third of the way", "38%" not
  "37.54%", unless the precise figure is the point.

## Tokens (Tailwind classes)

Surfaces: `bg-ground` (page), `bg-surface` (boxes, inputs), `bg-sunk` (subtle
fills, group headers), `bg-sel` (selected row), `bg-bar text-bar-ink` (dark
action bar). Text: `text-ink`, `text-ink-2` (secondary), `text-ink-3` (muted).
Lines: `border-line`, `border-line-2`. Accent: `bg-accent text-accent-ink`,
`text-accent`, `bg-accent-soft`. State: `text-in`, `text-warn bg-warn-soft`,
`text-bad bg-bad-soft`. Never use slate/gray/blue/emerald/red/green literals or
`bg-white`: they break dark mode. `dark:` utilities are not needed when using
tokens.

Charts: import `chart`, `axisProps`, `gridProps`, `tooltipProps`, `seriesColour`
from `lib/chart-theme.ts` (CSS-variable colours, so charts follow the theme).
Draw to scale, label only values the chart reaches, give the latest/partial
period a distinct treatment (outline or lighter), and add a one-sentence
caption saying what the chart shows.

## Shared components (`components/ui`)

| Need | Use |
|---|---|
| Buttons | `Button` (`primary` / `secondary` / `ghost` / `danger`, `size="sm"`, `loading`) |
| Page opening line + actions | `PageIntro` |
| Sections | `Panel` (`open` default, `boxed`) |
| Tabs (kept in the URL) | `useUrlTab` + `Tabs` |
| Form fields | `Field`, `Input`, `Select`, `Textarea`, `controlClass` |
| Money and number fields | `MoneyInput` (£ prefix, `416,085.32` at rest, raw value while editing, never rounds; `align="right"` in tables, `size="sm"` in cells), `NumberInput` (ages, percentages; `suffix="%"`). Both mono (`.fig`) |
| Choosing a month | `MonthSwitcher` (‹ October 2026 ›; the label opens a month grid with year arrows; `min` / `max` limits). Keep the month in the URL as `?month=YYYY-MM`. Never a native month input or a `<select>` of months |
| Status labels | `Chip` (`neutral` / `accent` / `warn` / `bad` / `in`) |
| Messages, empty, loading | `Notice`, `EmptyState`, `SkeletonRows` |
| Budget progress | `PaceBar` (budget marker at 80%, pace tick, overspend shows past it) |
| Confirm a destructive step | `ConfirmDialog` (never `window.confirm` / `alert`) |
| Side editing panel | `SidePanel` |
| Feedback after an action | `useToast()` (with Undo where cheap) |
| Category choice | `CategorySelect` |
| Money / dates | `lib/format.ts` |

## UX checklist for every page

- Loading, empty and error states, each written for this page.
- State the user would expect to survive a refresh (tab, month, filters) lives in the URL.
- Every action gives feedback (toast or inline), errors are visible, never only `console.error`.
- Destructive actions confirm in-app; reversible ones offer Undo.
- Works at 390px wide with no horizontal page scroll; tables collapse to stacked rows.
- Keyboard: everything reachable by Tab, visible focus, Esc closes dialogs/panels.
- Light and dark both checked (use `scripts/ui-harness`).
