# Sahil Kumar — Portfolio

A responsive static portfolio with CSS 3D portrait layers, interactive card tilt, project filters and details, light/dark themes, and accessible navigation. Content is based on Sahil's supplied résumé.

## Run locally

From this checkout:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

No package installation or build is required. The existing `about.html`, `projects.html`, `experience.html`, and `contact.html` URLs remain supported and open their corresponding sections.

## Edit

- Page content: `index.html` and the corresponding HTML entry pages.
- Styling: `assets/portfolio.css` (base) and `assets/refinement.css` (visual theme).
- Interactions and project details: `assets/portfolio.js`.
- Download: `assets/Sahil-Kumar-Resume.docx`.
- Portrait: `assets/sahil-portrait.png`.

The pages share markup. After editing `index.html`, synchronize the four other HTML files to retain the layout. The script selects the opening section by filename.

The contact form composes a `mailto:` draft, requiring a configured email application. It does not submit or store messages. Direct email and telephone links are also available. GitHub and LinkedIn use the profile URLs already present in the original site.

Fonts are bundled locally in `assets/fonts` with their open-source license notices. Fallback fonts keep the site usable if a font cannot load. Layout, animation, project imagery, and scripts are local. Motion respects `prefers-reduced-motion`. Source links are included where an existing repository URL was provided; the vision project offers an email enquiry.
