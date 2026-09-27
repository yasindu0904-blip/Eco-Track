# Member 1 web test environment

- Run ID: `20260927-194235` (Asia/Colombo).
- Tester: Sahanya (Member 1).
- Hosted web target: `https://eco-track-ctd.pages.dev`.
- Hosted API target: `https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1`.
- Application test database: Supabase `eco-track-test` (`zkiciluuktuzkidjaiaz`), as specified by the team guide; current live attachment awaits independent confirmation.
- Authentication and storage: original Supabase project `jnbkbbhpbdfuzyezpqvo`, as specified by the team guide.
- Local source revision: `4181db9c2dd455569aa872ce0c73541c8cd632ce`.
- Local worktree at start: untracked root `member-1-web-testing-and-functional-Sahanya.md`; no tracked changes.
- Deployed revision: not verified. Local source may differ from hosted build.
- Browser/device/version: Microsoft Edge 154.0.4258.37 and Google Chrome 153.0.8010.52 installed on this Windows machine; browser execution pending. Planned desktop viewport 1440 x 1000 and narrow viewport 390 x 844.
- Timezone: Asia/Colombo (UTC+05:30); execution rows use UTC.
- Evidence baseline: `../../2026-09-27-hosted-smoke/` is a prior run, referenced but not repeated or counted here.
- Tools actually used: git, ripgrep, PowerShell, npm/Vitest/Vite, Playwright Core 1.55.1 with installed Edge and Chrome, source inspection. Browser automation ran headless for the signed-out checks and a headed Edge session is open for human sign-in.
- In-app browser connection failed before page navigation (`failed to write kernel assets: The system cannot find the path specified`).
- Hosted health endpoint returned HTTP 200 with `status: ok` and `service: ecotrack-backend`; hosted web shell returned HTTP 200 on 27 September 2026. These are reachability checks, not functional case results.
- The course-template DOCX draft was rendered through installed Microsoft Word PDF export and the document runtime's `pypdfium2`; seven pages were visually inspected. The packaged `render_docx.py` could not launch because LibreOffice `soffice` is not installed on this Windows host.

No credentials, tokens, browser session exports, or signed URLs belong in this directory.
