# Contributing to ResearchGuide

The initial scope is a guided quantitative secondary-data study for a beginning PhD student. Keep improvements concrete and testable.

1. Use Node 22+ and start with `npm start`.
2. Run `npm run check` and `npm test` before submitting a change.
3. Add behavior tests for state transitions, permission boundaries, or persistence changes.
4. For UI changes, check a narrow mobile viewport and keyboard navigation. The optional Playwright smoke script provides a reproducible walkthrough.
5. Explain what changed, how you checked it, and remaining limits in your pull request.

Never commit `.env`, project files, participant records, credentials, or confidential source material. Use synthetic fixtures and explicitly label them. Distinguish user-provided sources from verified evidence. Do not label a model response as approval, a validation result, or executed analysis when no such check has occurred.

Keep supervisor decisions version-specific. Any change to an approved artifact must invalidate affected downstream approvals. Preserve user edits and review history. Avoid silent fallback from real model calls to simulated results.

Please discuss major dependencies or new data/model integrations in an issue before implementation. Provider and institutional policy differences should be surfaced explicitly.
