# Task 2b: Pagination review fixes

Do not commit. Keep vanilla JS.

## File lock

- `/home/c3po/projects/click-scrape/src/shared/pagination.js`
- `/home/c3po/projects/click-scrape/src/content/content.js`
- `/home/c3po/projects/click-scrape/tests/pagination.test.mjs` if you add tests

## Must fix

1. **Session rows during walk:** `getSessionRows` must return `state.rows` when `state.walking || state.walked` so export/save during “Pagination in progress…” uses the merge, not a page-1 re-extract.

2. **Abort walk:** pass AbortController (or generation token) into `walkPages`/`fetchPage`. `stopPicker` aborts. Ignore stale `onProgress` if generation changed. Do not start a second walk while one is running.

3. **Picking during walk:** ignore `onClick` field-add while `state.walking`.

4. **Same-origin:** before fetch, if `currentUrl` is an absolute http(s) URL, reject next URLs whose origin differs. After fetch, if `res.url` origin differs, return null. If `currentUrl` is empty/file, skip origin check (tests may use relative hrefs).

5. **Next detection:** use `a[rel~="next"]` not exact `rel=next`. Do not use unqualified `.current` for page number (use `.pagination .current`, `nav .current`, `[aria-current="page"]`). Prefer next-labels and numbered links inside `nav.pagination` / `.pagination` / `[aria-label*="page" i]` before document-wide scan.

Run `npm test` — must stay green. Report: `/home/c3po/projects/click-scrape/.superpowers/sdd/task-2-pagination-fix-report.md`
