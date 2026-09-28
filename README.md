# lliwio-app

lliwio-app is a colour palette tool for the web, installable as a PWA. You build
palettes of named colours, organised into groups, and open any colour to see
every pairing it makes with the rest of its palette — each one rendered as a
real text sample and filtered by the WCAG contrast ratio it meets, so you can
tell at a glance which combinations are actually readable. Palettes are stored
locally in the browser and can be exported to and imported from a JSON file.

## Getting started

```
npm install
npm run dev
```

The dev server prints a URL under the `/lliwio-app/` base path, matching how the
app is served from GitHub Pages.

## Scripts

- `npm run dev` — development server
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck, production build into `www/`, then generate the
  service worker
- `npm run generate-app-icons` — regenerate the PWA icons in `public/icons/`
  from the source images in `assets-src/`, using the Framework7 CLI. This is the
  only thing that reads `framework7.json`.
