<h1 align="center">Michael Edidem — Personal Academic Homepage</h1>

<div align="center">

[![Website](https://img.shields.io/badge/Website-mikedidem.github.io%2Fmedidem-blue)](https://mikedidem.github.io/medidem/)
[![GitHub](https://img.shields.io/badge/GitHub-mikedidem-black)](https://github.com/mikedidem)

</div>

<p align="center">Personal academic homepage of <strong>Michael Edidem</strong>, PhD Researcher in Spatial AI &amp; Geospatial Machine Learning at Southern Illinois University Carbondale.</p>

---

## About

This is the source code for [mikedidem.github.io/medidem](https://mikedidem.github.io/medidem/), built on the [AcadHomepage](https://github.com/RayeRen/acad-homepage.github.io) template.

**Michael Edidem** works at the intersection of **Geospatial AI**, **hydrologic and environmental modeling**, and **physics-guided machine learning** — developing scalable, data-driven systems for analyzing groundwater–surface water interactions, elevation-derived hydrography, and environmental decision-support workflows.

### Research Interests

- Spatial AI · Spatiotemporal Deep Learning · Physics-Guided Machine Learning
- Groundwater & Surface Water Modeling (MODFLOW) · Elevation-Derived Hydrography
- Remote Sensing · LiDAR / DEM-Based Modeling · GeoAI for Environmental Sustainability

### Education

- **PhD Researcher, Spatial AI & Geospatial Machine Learning** — Southern Illinois University Carbondale

*(Full education history not yet added — see "Not yet filled in" below.)*

---

## Tech Stack

Built with [Jekyll](https://jekyllrb.com/) and the [AcadHomepage](https://github.com/RayeRen/acad-homepage.github.io) template. Deployed via GitHub Pages.

## Run Locally

Requires Ruby + Bundler:

```bash
git clone https://github.com/mikedidem/medidem.git
cd medidem
bundle install
bundle exec jekyll serve
# Open http://localhost:4000
```

## Structure

- `_config.yml` — site title, author bio/contact info, social links
- `_data/navigation.yml` — top nav links (anchors into the single About page)
- `_pages/about.md` — all page content: bio, research interests, projects, publications, technical expertise
- `images/avatar.svg` — placeholder initials avatar; swap for a real photo (update `author.avatar` in `_config.yml` to match)
- `images/500x300.png` — placeholder project card image; swap for real project screenshots/figures
- `_layouts/`, `_includes/`, `_sass/`, `assets/` — template internals, not usually edited directly
- `github-profile-README.md` — draft content for the `mikedidem/mikedidem` GitHub profile README, kept in sync with this site

## Contributors

| Contributor | Role |
|------------|------|
| [Michael Edidem](https://github.com/mikedidem) | Author & maintainer |
| [Claude Sonnet 5](https://claude.ai) (Anthropic) | AI pair programmer — site build, template integration |

> Parts of this site were built with [Claude Code](https://claude.ai/code). AI-assisted commits are co-authored and traceable in the [commit history](https://github.com/mikedidem/medidem/commits/master).

---

## Contact

- Email: edidemichael@gmail.com
- GitHub: [mikedidem](https://github.com/mikedidem)

---

## Not yet filled in

- Real profile photo (currently an initials placeholder)
- Real project screenshots/figures (currently a gray placeholder image)
- Full education history, honors/awards, invited talks — the template supports these sections but they were left out rather than filled with invented dates
- Google Scholar, LinkedIn, ORCID — add to `_config.yml` (`author.googlescholar`, `author.linkedin`, `author.orcid`) once you have them
