# Resume Site

An open-source personal resume and technical-notes platform built with Node.js, Express, HTML, CSS, and JavaScript.

The public repository contains the application code and UI implementation. Resume data is rendered as a responsive bilingual page, while technical notes are loaded from Markdown files stored outside the public Git history.

## Features

- Responsive Korean and English resume
- Light and dark appearance settings
- Markdown-based Tech Notes with categories, tags, and chronological navigation
- Protected administration console for writing notes and managing files
- Python, SQL, PDF, and image upload validation
- Independent private share links for the resume and Tech Notes
- Persistent content storage separated from application releases
- Sanitized Markdown rendering and escaped source-code previews

## Running Locally

Node.js 20 or newer is required.

```bash
npm install
npm start
```

Open the following pages:

- Resume: `http://localhost:3000/resume/`
- Tech Notes: `http://localhost:3000/study/`

The administration console requires an upstream authentication header in production. It can be enabled for loopback-only local development with:

```bash
ALLOW_LOCAL_ADMIN=true npm start
```

Never enable local administrator access on a public interface.

## Private Share Links

The resume and Tech Notes can be protected independently with long random environment values:

```dotenv
RESUME_SHARE_TOKEN=replace-with-a-long-random-value
STUDY_SHARE_TOKEN=replace-with-another-long-random-value
```

Successful share-link access creates a secure, HttpOnly browser cookie and redirects to a clean URL. Resume access also grants one-way access to Tech Notes so the resume's Tech Notes link works naturally; a Tech Notes-only link does not grant resume access. Actual tokens must remain in the server environment and must never be committed.

## Content Storage

Published Tech Notes are intentionally excluded from this repository. The application reads Markdown content from the directory configured by `STUDY_DIR`; uploaded public attachments and administrator-only files use separately configured persistent directories.

For local testing, create Markdown files under `_study/` using `_templates/study-note.md`. Files in `_study/` are ignored by Git so personal notes cannot be committed accidentally.

```yaml
---
title: "Example note"
date: 2026-08-21
category: Python
tags:
  - Syntax
---
```

The administrator accepts these file types:

| Type | Limit | Handling |
| --- | ---: | --- |
| Python (`.py`) | 512 KB | UTF-8 validation and escaped source preview |
| SQL (`.sql`, private storage only) | 2 MB | UTF-8 validation and escaped source preview |
| Images | 5 MB | Signature validation and inline display |
| PDF (`.pdf`) | 15 MB | Signature validation and download response |

Uploaded Python and SQL files are never executed by the application. SQL files are accepted only in the administrator's private file storage, not as public Tech Notes attachments.

## Project Structure

```text
resume/
├── _study/              # Local/runtime Markdown content; ignored by Git
├── _templates/          # Note template
├── server/              # Express application and administration UI
├── study/               # Tech Notes client assets
├── index.html           # Resume document
├── config.js            # Resume data and rendering configuration
├── script.js            # Resume interactions
└── style.css            # Resume design and responsive styles
```

## Security Notes

- Secrets and production content are stored outside the repository.
- Administrative routes are designed to run behind an external identity-aware access layer.
- State-changing administrator requests require a same-origin request.
- Markdown is sanitized before rendering.
- Uploaded filenames, sizes, text encoding, and supported binary signatures are validated.
- The application binds to a loopback address by default.

This repository should still be treated as public. Do not commit credentials, private documents, personal notes, or production environment files.

## License

This project is available under the [MIT License](LICENSE).
