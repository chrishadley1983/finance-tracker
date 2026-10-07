# UI harness

Renders a real page (real components, real shell, production CSS) in Chromium
with fixture API responses, and saves desktop/phone screenshots in light and
dark. Use it to check layout and visual changes without a login or database.

```
npx next build
NODE_PATH=/opt/node22/lib/node_modules node scripts/ui-harness/render.mjs \
  --page app/budgets/page.tsx --path '/budgets?month=2026-10' \
  --fixtures scripts/ui-harness/fixtures/budgets.json --out /tmp/shots/budgets
```

The report lists console errors, horizontal overflow (must be 0) and any
`/api` calls without a fixture. Fixture keys are API pathnames; JSON values
are returned as-is. Fixture data is example data, not real figures.
