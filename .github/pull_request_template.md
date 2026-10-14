## What does this change?
<!-- One or two sentences. Link the issue: Closes #12 -->

## Type
- [ ] New feature
- [ ] Bug fix
- [ ] Database migration
- [ ] Docs / report

## How did you test it?
- [ ] `npm run lint` and `npx tsc --noEmit` pass
- [ ] `npm run build` passes
- [ ] Tried it in the browser as: customer / support agent / team leader / admin (tick who)
- [ ] `node tests/api-tests.mjs` passes (if API or database changed)

## Database
- [ ] No database change
- [ ] New migration file in `database/` (numbered, run once, never edited after merge)
- [ ] New tables have Row Level Security turned on and are tested as a customer and as staff

## Security and privacy
- [ ] No secret keys, passwords or `.env.local` in the diff
- [ ] Input is checked with the shared rules in `lib/validation` and again in the database
- [ ] Error messages shown to users do not reveal technical details

## Screenshots
<!-- Before / after, if the screen changed -->

## Reviewer
<!-- At least one teammate must approve before merging -->
