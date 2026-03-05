# Plan: Raycast Store Submission — Bridges

## Context

Bridges (formerly raycast-agents) is ready code-wise (build/lint/test pass). This plan tracks remaining items needed to submit via `npm run publish` to the raycast/extensions monorepo.

---

## A: Metadata & Assets

### A1. Icon
- 512x512 PNG, custom design, works in light + dark
- files: `assets/extension-icon.png`

[x] A1
notes: already 512x512 custom purple icon, verified

### A2. Screenshots
- 2000x1250 PNG, 3-6 recommended, min 1 required
- use Raycast Window Capture with a clean wallpaper background
- store in `metadata/` folder
- capture: Add Capability flow, Manage Capabilities list, AI tool in action
- files: `metadata/*.png`

[ ] A2
notes: manual. use raycast wallpapers for background

### A3. CHANGELOG date placeholder
- Raycast expects `{PR_MERGE_DATE}` not a hardcoded date
- update format to: `## [Initial Version] - {PR_MERGE_DATE}`
- files: `CHANGELOG.md`

[ ] A3
notes: trivial edit, do right before submission

---

## B: Package Metadata

### B1. License

[x] B1
notes: MIT

### B2. Author

[x] B2
notes: `pa1ar` — verify matches Raycast account

### B3. Categories

[x] B3
notes: `["Productivity", "Developer Tools"]`

### B4. Extension title

[x] B4
notes: renamed to "Bridges"

### B5. Command descriptions

[x] B5
notes: "Add Capability", "Manage Capabilities" — verb+noun, Title Case

---

## C: Code Review Items

### C1. Replace showToast(Style.Failure) with showFailureToast
- 3 occurrences: `CredentialForm.tsx:24`, `CredentialForm.tsx:33`, `add-capability.tsx:138`
- import `showFailureToast` from `@raycast/utils`
- files: `src/components/CredentialForm.tsx`, `src/add-capability.tsx`

[ ] C1
notes: reviewers specifically check for this

### C2. No console.log

[x] C2
notes: verified — zero occurrences in src/

### C3. No hardcoded secrets / .env usage

[x] C3
notes: API key via Raycast preferences (password field), .env in gitignore

### C4. Claude CLI dependency
- extension requires `claude` binary installed separately
- this is unusual for store extensions — may get reviewer questions
- ensure graceful error message when CLI missing (already done)
- document requirement clearly in README
- consider: could we use the Anthropic SDK directly instead of CLI?

[ ] C4
notes: policy risk. graceful error already in place. may need to justify in PR description or pivot to SDK-only

---

## D: Pre-Submit Checks

### D1. npm run build

[x] D1
notes: passes

### D2. npm run lint

[x] D2
notes: passes

### D3. npm run test

[x] D3
notes: 30/30 pass

### D4. package-lock.json included

[x] D4
notes: generated, in repo

---

## E: Submit

### E1. Push to pa1ar/raycast-bridges on GitHub

[ ] E1
notes: independent of store submission

### E2. Run npm run publish

[ ] E2
notes: depends on all above being resolved

---

## Unresolved Questions

1. **Claude CLI dependency**: will reviewers accept an extension that requires a separate binary? alternative: rewrite scaffold.ts to use `@anthropic-ai/sdk` directly (messages API) instead of claude CLI — removes the dependency entirely but loses tool use (WebSearch, WebFetch, Bash) that the agent currently relies on.
2. **AI tools**: the `tools` field in package.json is relatively new in Raycast. verify store supports it and it doesn't cause issues during review.
