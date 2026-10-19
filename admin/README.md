# Portfolio Studio

Open `/admin/` on the same static host as the portfolio. The editor reads the
existing `assets/content.json` and uses the shared content validator. It needs
no server, database, build step, or external JavaScript service.

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
intact. The admin URL is public, but visitors cannot publish without a token
that GitHub authorizes for the repository.

Automated browser checks mock GitHub responses. Test runs never publish test
content, upload files to a real repository, or require a real access token.
