# Portfolio Studio

Sign in at `/admin/` on your Vercel-hosted portfolio. Vercel serverless functions protect the editor and its scripts; no separate database or server deployment is required.

## Configure ID/password access

The requested default ID is `dandiasahil@gmail.com`; the requested password is represented by a salted server-side verifier. In Vercel set `ADMIN_SESSION_SECRET` to a separately generated random secret of 32+ characters, then redeploy. Optional `ADMIN_ID` and `ADMIN_PASSWORD` overrides replace the defaults. Choose a stronger private password override of at least 8 characters when possible. An existing password override must be removed to use the default. Never commit plain-text credentials. For local development, put them in ignored `.env.local` and run `npm run dev`.

Sessions expire after four hours and use HttpOnly, SameSite=Strict cookies with Secure enabled in production. Lock admin saves valid draft edits, clears the browser cookie, and disconnects GitHub. Changing a credential or the session secret and redeploying invalidates existing signed sessions. Keep the Vercel admin routes before filesystem handling. A static-only server cannot enforce this login. Authentication rejects cross-origin login/logout requests and does not cache protected responses.

The admin ID/password grants editor access. GitHub publishing still requires the connection described below.

## Editing and previewing

All profile, biography, skills, project, education, experience, certification,
and settings fields can be edited. Repeatable entries can be added, removed,
and reordered. Changes stay in the current tab until you save a local draft,
export a JSON backup, or publish them.

- **Save local draft** stores public content in this browser's local storage.
- **Restore local draft** restores that saved content into the editor.
- **Export / Import JSON** creates or restores a portable content backup.
- **Preview** opens a fresh same-origin tab using public content in session
  storage. The published site is unchanged.

Portraits, project screenshots, and résumés accept an existing relative path or
an HTTPS URL. When connected, the optional upload buttons create a uniquely
named file under `assets/uploads/`. Supported images are JPG, PNG, WebP, and
AVIF; résumés can be PDF or DOCX. Files must be nonempty and no larger than
5 MB. **An upload immediately creates an asset commit.** Publish the content
separately to make the portfolio reference the uploaded file.

## Connecting GitHub

Create a fine-grained personal access token with access to
`sahildandia/sahilportfolio` and **Contents: Read and write**. GitHub supplies
the required metadata permission. Organization policies may require approval;
protected branch rules may restrict direct commits. Owner, repository, and
branch default to `sahildandia`, `sahilportfolio`, and `master` and can be changed
before connecting.

The token is sent only in the `Authorization` header to `api.github.com`.
It is kept in memory, cleared from its input immediately, and never written to
local storage, session storage, URLs, content, backups, or logs. Signing out
clears the in-memory connection. Closing or refreshing the tab requires a new
connection. Only public portfolio content is stored in drafts and previews.

Connect checks repository access and loads the current file revision. Existing
draft edits are retained. A read-only repository permission disables publishing;
GitHub checks the token's actual write permission when the save is attempted.
The editor reports success only after a successful content API response.

## Publishing and concurrent edits

Publish validates the complete content, fetches its latest GitHub revision,
and compares it with the revision loaded when connecting. If another editor
has changed the file, publishing stops without overwriting it. Export or save
your draft and use **Load latest from GitHub**, then reapply the desired edits.
Loading latest also backs up valid existing edits locally before replacing
them. GitHub's own SHA check protects against a change between the preflight
request and the save.

A successful save creates an `Update portfolio content` commit on the selected
branch. The website updates after the repository's configured deployment runs;
this editor does not create or change the hosting workflow. API authentication,
permissions, rate-limit, missing-file, and conflict errors retain the draft and
explain the next step.

## Deployment notes

Serve the complete repository with its `admin/` directory and `assets/` files.
The host must permit browser requests to `https://api.github.com`. Keep the
admin page's Content Security Policy, local scripts, and `no-referrer` policy
intact. The login screen is public; the editor requires a valid session and publishing additionally requires a token GitHub authorizes for the repository.

Automated browser checks mock GitHub responses. Test runs never publish test
content, upload files to a real repository, or require a real access token.
