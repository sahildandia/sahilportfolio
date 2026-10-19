# Sahil Kumar — Portfolio

An editorial portfolio inspired by the supplied reference screenshots: warm ivory, burnt orange, a framed portrait, alternating project rows, searchable skills and certifications, a contact composer, and a small content-based guide. The original personal information, photos, résumé, projects, source links, experience, education, and page routes are preserved. A collapsible interactive Three.js study remains available in Skills.

## Run

Serve the complete checkout over HTTP:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

No package installation, database, API key, or runtime build is required. Use another port if necessary. The original `about.html`, `projects.html`, `experience.html`, and `contact.html` routes still open the corresponding sections.

## Edit your portfolio

Open **`/admin/`** on the same host as the portfolio. You can edit every profile, biography, skill, project, education, experience, certification, and contact field, add/remove/reorder entries, and change photos or the résumé.

- **Local drafts** save public content in your current browser only.
- **Preview** opens an unpublished view in a new tab, marked with a preview banner.
- **Export/Import JSON** creates and restores portable backups.
- **Publish to GitHub** commits the content to your repository. Your normal website deployment then makes it public.

To publish, create a GitHub fine-grained personal access token limited to `sahildandia/sahilportfolio` with **Contents: Read and write**, and enter it only in the portal’s connection form. Defaults are owner `sahildandia`, repository `sahilportfolio`, branch `master`. The token stays in tab memory; it is never stored in content, drafts, backups, storage, or URLs. Refreshing, closing the tab, or signing out clears the connection. The admin URL can be visited publicly, but GitHub authorizes every write.

Publishing checks the latest file SHA and refuses to overwrite concurrent changes. Authentication, permission, rate-limit, and conflict errors retain your draft. The portal does not configure hosting: the repository must already be connected to your static deployment. Uploading a photo or résumé creates a separate asset commit; publish the content afterward to use the file. Uploaded assets become available on your website after deployment.

See [admin/README.md](admin/README.md) for the complete editing, token, upload, and publishing workflow. Browser access to `https://api.github.com` is required for connection/publishing. No token should be entered in chat or committed to this repository.

## Content and source files

- `assets/content.json`: single source of truth for public content.
- `assets/content-model.js`: shared schema and safe URL validation.
- `assets/content-renderer.js`: public HTML rendering with escaped text.
- `assets/portfolio.js`: content loading and public interactions.
- `assets/portfolio.css`: editorial visual system and responsive layouts.
- `assets/refinement.css` / `assets/hero-scene.js`: optional 3D study and fallback.
- `admin/`: editor and GitHub publishing client.

Normal page loads fetch the latest deployed JSON. Pre-rendered HTML provides a bundled fallback if the content request fails and keeps the content available without JavaScript. After hand-editing the content or renderer, regenerate those five HTML snapshots with Node.js:

```sh
node scripts/build.mjs
```

Admin publishing changes the JSON directly; it does not require this generation step for normal browser visitors. Regenerate snapshots when you want to refresh the no-JavaScript fallback as well.

The contact form continues to compose a `mailto:` draft in the visitor’s email application. It does not silently submit or store messages. The guide answers only from the displayed portfolio content and does not call an AI service. Missing certificate or demo URLs are left absent rather than invented.

## Validation

With Python Playwright and Chromium available and the server running:

```sh
node tests/content-model.test.mjs
PORTFOLIO_BASE_URL=http://127.0.0.1:8000 python3 tests/browser_check.py
```

Checks cover six viewport widths, routes, search/filtering, project dialogs, exact résumé downloads, contact drafts, clipboard behavior, optional WebGL and fallback, reduced motion, and the admin editing/publishing workflow. GitHub requests in browser tests are simulated; tests never upload files or publish test content to a real repository. The site bundles its fonts and Three.js locally with their license notices.
