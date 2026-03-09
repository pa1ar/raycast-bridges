# Raycast Store Release Hygiene

## Context

Bridges extension works but lacks release discipline. OAuth was just added without a changelog entry or version bump. README still says API key is required. No screenshots. Want to establish a repeatable update workflow before pushing to Raycast Store.

## Task 1: Update CHANGELOG.md
notes: add entry for OAuth work, align format with Raycast Store convention

Current format is close but titles should use `[brackets]` per Store convention.

Rewrite to:
```markdown
# Changelog

## [Claude OAuth Login] - 2026-03-09

- Sign in with Claude account instead of requiring a separate Anthropic API key
- OAuth flow with PKCE: browser auth -> paste code -> tokens stored locally
- Auto-refresh expired tokens silently
- API key preference now optional (OAuth takes priority)
- Sign out action in Manage Capabilities
- Cleaner connection test message (no more confusing HTTP 404 display)

## [Initial Release] - 2026-03-05

- Add Capability: AI-powered API scaffolding wizard
- Manage Capabilities: edit, toggle, remove sources and skills
- Three AI tools: list-capabilities, get-capability-guide, call-capability
```

[ ] task 1
notes: -

## Task 2: Update README.md prerequisites
notes: reflect that API key is now optional

Change Prerequisites section:
- Remove hard requirement for Anthropic API key
- Add OAuth as primary auth method
- Keep API key as fallback option
- Update Setup step 2 to mention both options

[ ] task 2
notes: -

## Task 3: Add release workflow notes to CLAUDE.md
notes: project-level instructions for future updates

Add a `## Releases & Updates` section to `/Users/pavel/dev/raycast/raycast-bridges/CLAUDE.md` with:
- Changelog format: `## [Title] - YYYY-MM-DD` with bullet points
- Every user-facing change gets a changelog entry before committing
- Version bumps happen via `npm run publish` (Raycast handles versioning)
- Screenshots: `media/` folder, 2000x1250px PNG, 3-6 images (needed before first Store push)
- `npm run build && npm run lint` must pass before any release

[ ] task 3
notes: -

## Files to modify
- `CHANGELOG.md`
- `README.md`
- `CLAUDE.md`

## Verification
1. `npm run build` passes
2. `npm run lint` passes
3. Changelog follows `## [Title] - YYYY-MM-DD` format
4. README accurately describes both auth options
