# Portfolio

Static site for Michael Edidem — PhD Researcher in Spatial AI & Geospatial Machine Learning at Southern Illinois University Carbondale.

## Structure

- `index.html` — single-page site
- `styles.css` — all styling (light/dark theme via CSS custom properties)
- `script.js` — theme toggle, mobile nav, scroll-spy nav highlighting
- `assets/` — SVG icons and background pattern (placeholders — swap for real project figures/screenshots when available)
- `github-profile-README.md` — draft content for the `mikedidem/mikedidem` GitHub profile README, kept in sync with this site

## Running locally

No build step. Open `index.html` directly in a browser, or serve the folder:

```
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying

Intended target: a new `mikedidem/portfolio` GitHub repo with GitHub Pages enabled (Settings → Pages → deploy from `main` branch, root folder). Once deployed, update the placeholder site link at the top of `github-profile-README.md` (and push that file to the `mikedidem/mikedidem` profile repo).
