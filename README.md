# Sahil Kumar — Portfolio

A responsive static portfolio with a real interactive Three.js hero, a charcoal/violet/cyan visual system, restrained card tilt, categorized skills, project filters and details, and accessible navigation. Existing personal content, assets, page URLs, social links, and contact behavior are preserved.

## Run locally

From this checkout:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

No package installation or build is required. Use another port if 8000 is occupied. The existing `about.html`, `projects.html`, `experience.html`, and `contact.html` URLs remain supported and open their corresponding sections. `#skills` opens the separate skills section.

## The 3D hero

`assets/hero-scene.js` lazily imports locally bundled Three.js 0.180.0 when the hero approaches the viewport. A lit, faceted core, three metallic rings, and orbiting nodes form an abstract technology sculpture. It responds to mouse movement and has a keyboard-accessible pause button.

Rendering stops when the hero is offscreen, the tab is hidden, motion is paused, or reduced motion is enabled. Reduced motion displays a static rendered frame. Mobile uses lower geometry complexity and a pixel ratio capped at 1.3; touch gestures retain native page scrolling. A CSS orbital illustration remains visible during loading, when WebGL2 is unavailable, or after a graphics context loss. Portfolio text and links are independent of the scene.

Three.js is bundled under its MIT license in `assets/vendor/three.LICENSE.txt`. No CDN, API key, backend, or model download is required at runtime. Serve the site over HTTP because the scene uses ES modules.

## Edit

- Page content: `index.html` and the corresponding HTML entry pages.
- Styling: `assets/portfolio.css` (layout and visual system) and `assets/refinement.css` (hero and fallback).
- Interactions and project details: `assets/portfolio.js`.
- 3D sculpture and rendering lifecycle: `assets/hero-scene.js`.
- Download: `assets/Sahil-Kumar-Resume.docx`.
- Portrait: `assets/sahil-portrait.png`.

The pages share markup. After editing `index.html`, synchronize the four other HTML files to retain the layout. The script selects the opening section by filename.

The contact form composes a `mailto:` draft, requiring a configured email application. It does not submit or store messages. Direct email and telephone links are also available. GitHub and LinkedIn use the profile URLs already present in the original site.

Fonts are bundled locally in `assets/fonts` with their open-source license notices. Fallback fonts keep the site usable if a font cannot load. Layout, animation, project imagery, and scripts are local. Motion respects `prefers-reduced-motion`. Source links are included where an existing repository URL was provided; the vision project offers an email enquiry.

## Validation

With a server running, execute the browser checks with Python Playwright and Chromium installed:

```sh
PORTFOLIO_BASE_URL=http://127.0.0.1:8000 python3 tests/browser_check.py
```

The script uses `/usr/bin/chromium` by default. It verifies real GPU draw calls, pointer and pause interactions, fallback rendering, reduced motion, mobile touch scrolling, six viewport widths, all original page URLs, project filtering and dialogs, source destinations, theme persistence, exact résumé downloads, clipboard behavior, mailto encoding, console errors, and missing assets. Email sending and the visitor's configured email application are outside the static site's control.
