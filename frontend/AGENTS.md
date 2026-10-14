<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NexusCX AI team rules (Week 7)

These apply to every change, whoever (or whatever) writes it.

### Working on GitHub
- Never commit straight to `main`. Make a branch: `feature/...`, `fix/...` or `docs/...`.
- Open a pull request using the template. The `checks` workflow (lint, type check, build, secret scan) must pass, and one teammate must approve.
- One topic per pull request. Link the issue (`Closes #12`).

### Security
- Never commit `.env.local`, the Supabase secret key (`sb_secret_...`) or the database password. Only the publishable key may appear in the browser.
- Every new table has Row Level Security on. Test it as a customer and as staff before merging.
- Changes to data go through `SECURITY DEFINER` database functions that check `private.has_permission(...)`. Pages never trust the menu to hide things: check the permission on the page and in the database.
- Messages raised with error code `22023` are written for users and can be shown. Everything else goes through `friendlyError` so technical details never reach the screen.

### Forms and validation
- Every form's rules live in `frontend/lib/validation` (zod). The server action runs `check(schema, formObject(formData))` before calling the database, and the database checks again.
- Use `<Field>` for inputs so errors are linked with `aria-describedby` and `aria-invalid`.

### Database changes
- New file in `database/` with the next number. Never edit a migration that has been run on Supabase; add a new one.
- Test in a local Postgres first, as the roles that will use it.

### Pages
- Staff pages live in `app/(staff)`, customer pages in `app/(customer)`. Each group has `loading.tsx` and `error.tsx`.
- Use `getMe()` (cached per request) for the signed-in user and `can(me, "permission")` for access.
- Plain, friendly English on screen. Australian formats (AUD, dd/mm, +61 mobiles).
