# Sahil Kumar — Portfolio

An editorial portfolio inspired by the supplied reference screenshots: warm ivory, burnt orange, a framed portrait, alternating project rows, searchable skills and certifications, a contact composer, and a small content-based guide. The original personal information, photos, résumé, projects, source links, experience, education, and page routes are preserved. A collapsible interactive Three.js study remains available in Skills.

## Run

Use Node.js 22+ for the portfolio and protected admin portal:

```sh
npm run dev
```

There are no npm dependencies or database to install. Set `PORT` for a different port. For local login, copy `.env.example` to `.env.local`, choose your credentials privately, and restart the development server. Original page routes remain supported.

## Admin ID and password on Vercel

The requested default admin ID is `dandiasahil@gmail.com`. Its password is stored as a salted server-side verifier rather than plain text. To activate sessions, set the private `ADMIN_SESSION_SECRET` in Vercel and redeploy. You can replace the defaults with these variables in **Settings → Environment Variables**:

| Variable | Value you choose |
| --- | --- |
| `ADMIN_ID` | Optional override for the default email, at least 3 characters. |
| `ADMIN_PASSWORD` | Optional private replacement password, at least 8 characters; a longer unique password is recommended. |
| `ADMIN_SESSION_SECRET` | A separately generated random secret, at least 32 characters. |

Use a password manager to generate and retain the password and session secret. Do not send either value in chat or commit it to GitHub. The requested defaults apply only when no corresponding override is set. Remove an existing `ADMIN_PASSWORD` override to use the default verifier. Never publish the plain-text password in source or documentation. Configure Production and Preview separately if both deployments need an admin portal.

Open `/admin/` after redeployment. Missing configuration keeps the editor locked. Server-verified sessions expire after four hours and use HttpOnly, SameSite=Strict cookies with Secure enabled on Vercel. **Lock admin** saves valid draft edits, clears the browser session, and disconnects GitHub. Changing the ID, password, or session secret and redeploying invalidates existing signed sessions.

The included `vercel.json` routes `/admin` and `/admin/*` through authentication before static file serving. Keep these routes intact. GitHub Pages or a plain static server cannot enforce password protection; use Vercel or the included Node development server for the admin portal. The public portfolio remains static. Login attempts are limited per running function instance; Vercel Firewall rate limiting can provide coverage across instances.

## Edit your portfolio

Sign in at **`/admin/`** on your Vercel-hosted portfolio. You can edit every profile, biography, skill, project, education, experience, certification, and contact field, add/remove/reorder entries, and change photos or the résumé.

- **Local drafts** save public content in your current browser only.
- **Preview** opens an unpublished view in a new tab, marked with a preview banner.
- **Export/Import JSON** creates and restores portable backups.
- **Publish to GitHub** commits the content to your repository. Your normal website deployment then makes it public.

The ID/password controls editor access. To publish, still connect a GitHub fine-grained personal access token limited to `sahildandia/sahilportfolio` with **Contents: Read and write**, and enter it only in the portal’s connection form. Defaults are owner `sahildandia`, repository `sahilportfolio`, branch `master`. The token stays in tab memory; it is never stored in content, drafts, backups, storage, or URLs. Refreshing, closing the tab, or signing out clears the connection. The editor additionally verifies its admin session before every GitHub operation; GitHub authorizes every write.

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
npm run test:auth
python3 tests/admin-login-browser.py
PORTFOLIO_BASE_URL=http://127.0.0.1:8000 python3 tests/browser_check.py
```

Checks cover six viewport widths, routes, search/filtering, project dialogs, exact résumé downloads, contact drafts, clipboard behavior, optional WebGL and fallback, reduced motion, and the admin editing/publishing workflow. Authentication tests exercise real HTTP route protection, signed sessions, expiry, sign-in limits, and browser login/locking with temporary test credentials. The CMS workflow suite uses authenticated-session and GitHub fixtures to isolate editing behavior. GitHub requests in those tests are simulated; tests never upload files or publish test content to a real repository. The site bundles its fonts and Three.js locally with their license notices.
