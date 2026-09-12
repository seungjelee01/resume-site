# Resume Site

An open-source personal resume and technical-notes platform built with Node.js, Express, HTML, CSS, and JavaScript.

The public repository contains the application code and UI implementation. Resume data is rendered as a responsive bilingual page, while technical notes are loaded from Markdown files stored outside the public Git history.

## Features

- Responsive Korean and English resume
- Light and dark appearance settings
- Markdown-based Tech Notes with categories, tags, and chronological navigation
- Protected administration console for writing notes and managing files
- Shared Google sessions for Tech Notes, with internal session validation
- Per-note visitor comments and one-level replies with administration management
- Anonymous real-time inquiries with private administrator chat rooms
- Privacy-friendly first-party Tech Notes visitor analytics
- Python, SQL, PDF, and image upload validation
- Independent private share links for the resume and Tech Notes
- Persistent content storage separated from application releases
- Sanitized Markdown rendering and escaped source-code previews

## Running Locally

Node.js 22.12 or newer is required.

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

## 통합 인증

루트 `/`는 ai-chat의 Google 로그인 포털입니다. `/study`는 Google 세션을 내부 API로 확인하고 `/ai-chat`은 기존 승인 정책을 적용합니다. `/admin`은 Cloudflare Access 인증을 유지하며 추가 Google 로그인 없이 사용자 조회와 AI Chat 이용 승인·중지를 처리합니다. 관리자 HTTP와 WebSocket 요청은 `Cf-Access-Jwt-Assertion`의 서명, 발급자와 Application Audience를 검증하며 `CF_ACCESS_TEAM_DOMAIN`과 `CF_ACCESS_AUD`가 없거나 올바르지 않으면 접근을 거부합니다.

`RESUME_SHARE_TOKEN`은 `/resume`에 적용하고 `STUDY_SHARE_TOKEN`은 관리자가 Tech Notes를 공유 링크 방식으로 설정할 때 사용합니다. Google 로그인 사용자는 두 설정 모두에서 Tech Notes에 접근할 수 있습니다. 기존 AI Chat 입장 티켓은 접근 권한을 부여하지 않습니다. 두 서비스에 동일한 `INTERNAL_API_SECRET_FILE`을 설정하고 resume에는 `AI_CHAT_INTERNAL_URL=http://127.0.0.1:3100`을 설정하세요. 자세한 절차는 `ai-chat/deploy/UNIFIED_AUTH.md`를 참고하세요.

## Content Storage

Published Tech Notes are intentionally excluded from this repository. The application reads Markdown content from the directory configured by `STUDY_DIR`; uploaded public attachments, administrator-only files, comments, quizzes, private journal entries, and reading logs use separately configured persistent directories. Quiz questions default to a `quizzes` directory next to `STUDY_DIR` and can be overridden with `QUIZ_DIR`; active questions are available to signed-in Tech Notes visitors while editing remains administrator-only. Journal entries and reading logs default to `journal` and `reading`, can be overridden with `JOURNAL_DIR` and `READING_DIR`, and are available only through the authenticated administration console.

For local testing, create Markdown files under `_study/` using `_templates/study-note.md`. Files in `_study/` are ignored by Git so personal notes cannot be committed accidentally.

```yaml
---
title: "Example note"
date: 2026-08-21
order: 1
category: Python
tags:
  - Syntax
---
```

`order` keeps navigation and same-day sorting independent from the visible title. The administration editor assigns the next order automatically when the field is left empty.

The administrator accepts these file types:

| Type | Limit | Handling |
| --- | ---: | --- |
| Python (`.py`) | 512 KB | UTF-8 validation and escaped source preview |
| SQL (`.sql`, private storage only) | 2 MB | UTF-8 validation and escaped source preview |
| Text (`.txt`, private storage only) | 2 MB | UTF-8 validation and escaped text preview |
| Images | 5 MB | Signature validation and inline display |
| PDF (`.pdf`) | 15 MB | Signature validation and download response |

Uploaded Python and SQL files are never executed by the application. SQL and text files are accepted only in the administrator's private file storage, not as public Tech Notes attachments.

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
- Comment input is escaped, length-limited, same-origin checked, and rate-limited.
- Visitor analytics stores daily keyed hashes instead of raw IP addresses or user-agent strings and removes those hashes after 31 days.
- The application binds to a loopback address by default.

This repository should still be treated as public. Do not commit credentials, private documents, personal notes, or production environment files.

## License

This project is available under the [MIT License](LICENSE).
