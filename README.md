# Portfolio

Jekyll site for Michael Edidem — PhD Researcher in Spatial AI & Geospatial Machine Learning at Southern Illinois University Carbondale.

Built on the [AcadHomepage](https://github.com/RayeRen/acad-homepage.github.io) template (MIT licensed).

## Structure

- `_config.yml` — site title, author bio/contact info, social links
- `_data/navigation.yml` — top nav links (anchors into the single About page)
- `_pages/about.md` — all page content: bio, research interests, projects, publications, technical expertise
- `images/avatar.svg` — placeholder initials avatar; swap for a real photo (update `author.avatar` in `_config.yml` to match)
- `images/500x300.png` — placeholder project card image; swap for real project screenshots/figures
- `_layouts/`, `_includes/`, `_sass/`, `assets/` — template internals, not usually edited directly
- `github-profile-README.md` — draft content for the `mikedidem/mikedidem` GitHub profile README, kept in sync with this site

## Running locally

Requires Ruby + Bundler:

```
bundle install
bundle exec jekyll serve
```

then visit `http://localhost:4000`.

## Deploying

Live at: https://mikedidem.github.io/medidem/ — deployed via GitHub Pages (Jekyll build) from the `master` branch, root folder, on the `mikedidem/medidem` repo. Push to `master` to update the live site; GitHub Pages builds Jekyll automatically, no local build required.

## Not yet filled in

- Real profile photo (currently an initials placeholder)
- Real project screenshots/figures (currently a gray placeholder image)
- Education history, honors/awards, invited talks — the template supports these sections but they were left out rather than filled with invented dates; add them to `_pages/about.md` and `_data/navigation.yml` when you have the details
