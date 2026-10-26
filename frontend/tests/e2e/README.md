# Browser tests (Playwright)

Two kinds of tests:

| File | Needs | What it checks |
|---|---|---|
| `public.spec.ts` | Nothing (runs on GitHub too) | Signed-out visitors are sent to sign-in, page titles, labelled fields, 404 page, phone layout |
| `journey.spec.ts` | Test accounts + the real Supabase project | Customer asks for a person → agent takes the case and replies → customer answers → agent resolves → customer rates. Server-side validation. Staff menu on a phone. |

## Run them on your laptop

```bash
cd frontend
npx playwright install chromium     # once
npm run build
npm run test:e2e                    # public tests only, unless accounts are set
```

To also run the journey tests, set test accounts **in the terminal only** (never in a file that goes to GitHub):

```bash
export E2E_CUSTOMER_USER=alex.nguyen
export E2E_AGENT_USER=riley.support
read -s E2E_CUSTOMER_PASSWORD && export E2E_CUSTOMER_PASSWORD
read -s E2E_AGENT_PASSWORD && export E2E_AGENT_PASSWORD
npm run test:e2e
```

`read -s` hides the password while you type. Each journey run creates one new case (its message starts with `E2E`).
The database allows 5 new requests per customer in 10 minutes, so wait a few minutes between many runs.

Open the report after a failed run: `npx playwright show-report`.
