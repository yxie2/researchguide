# ResearchGuide

**Your first rigorous study, one thoughtful step at a time.**

ResearchGuide is an early, local-first prototype for beginning PhD students and their supervisors. Move from a research question to a complete notebook of decisions, evidence, analysis records, and interpretations. Each milestone pairs something you make with an explanation of why you made it.

![ResearchGuide desktop workspace](docs/images/workspace.png)

## Run in one command

Requires **Node.js 22 or newer**. There are no runtime dependencies, no package installation, and no build step.

```bash
npm start
```

Open **http://127.0.0.1:3000**. The default demo works without an account, API key, or internet connection. It returns clearly labeled, deterministic milestone guidance; it is not an AI conversation.

This application intentionally listens on loopback only. It is a single-user local prototype, not a public web service. Publishing the source repository does not deploy the application.

## Try the complete workflow

1. Choose **New project** and describe what you want to investigate.
2. In **Your workspace**, use the outline or write your own research brief. Explain your choices in your own words.
3. Open **Research team** and run the demo guide. Inspect the coordinator, specialist, reviewer, and next-step messages.
4. Save your work and request a supervisor review. The minimum lengths check completeness only, not rigor or understanding.
5. In **Supervisor review**, enter a name and a substantive note to approve or request changes. This is an explicitly labeled local role demonstration, not an authenticated supervisor account.
6. Continue to the evidence milestone and add a source URL, location, and passage you inspected. Sources are user-provided and unverified.
7. Work through design, data inspection, analysis, interpretation, and packaging. Export the saved notebook as Markdown or the complete record as JSON.

You can draft ahead, but submitting a milestone requires approvals on all preceding milestones. Changing an earlier artifact invalidates its approval and affected downstream statuses while preserving historical reviews. Adding evidence also triggers renewed review of the evidence milestone and its dependents.

## Use a real local model

Install [Ollama](https://ollama.com/) and download a model appropriate for your computer. Copy `.env.example` to `.env`, set `OLLAMA_MODEL` to the exact installed model name, and restart ResearchGuide:

```dotenv
OLLAMA_MODEL=your-installed-model-name
OLLAMA_URL=http://127.0.0.1:11434
PORT=3000
```

The optional adapter uses Ollama's documented [`/api/chat` endpoint](https://docs.ollama.com/api/chat). Each run makes three sequential model calls:

1. A milestone specialist receives the saved project context and student's question.
2. A critical reviewer examines the specialist's response and artifact.
3. A coordinator returns a bounded next task and points out decisions needing human review.

Each call has a 90-second timeout and an output-token limit. A failed provider call is reported as a failure; it never silently becomes demo output. Model guidance is saved only after the entire sequence completes. Writes are blocked during a run to keep results tied to the version examined.

Project text and up to 20 source records are included in model context. Keep the configured endpoint local if you intend local processing; changing `OLLAMA_URL` changes where that content is sent. The application does not provision, download, or train models.

## Implemented versus planned

| Available in v0.1                                       | Planned, not implemented                              |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Seven milestone templates and worked examples           | Validated adaptive teaching and competence assessment |
| Student explanations and supervisor checkpoints         | Authenticated roles and remote collaboration          |
| Deterministic workflow coordinator                      | Autonomous tool selection and bounded replanning      |
| Optional specialist/reviewer/coordinator model sequence | Literature search and source verification             |
| User-entered source passages                            | PDF ingestion and evidence extraction                 |
| Versioned artifacts and dependency invalidation         | Dataset profiling and isolated R execution            |
| Atomic local saves, history, Markdown/JSON export       | RStudio integration and institutional storage         |

This is a working foundation for an agentic research guide. It is not an autonomous scientist, a scientific-quality certification system, or a replacement for supervision. The initial guidance focuses on quantitative secondary-data studies. Work in the data and analysis milestones is currently performed in the researcher's own tools and documented here.

## Architecture

```text
Browser workspace
  ├── artifact + student explanation
  ├── source records
  └── local review decisions
            │ same-origin JSON requests
Node HTTP server (loopback only)
  ├── workflow state machine → atomic JSON persistence
  ├── guide runner → deterministic demo OR Ollama role sequence
  └── versioned notebook export
```

- `lib/workflow.mjs`: milestone definitions, transitions, approval gates, invalidation, and export.
- `lib/guide.mjs`: transparent guidance traces and optional local-model orchestration.
- `server.mjs`: request validation, concurrency controls, persistence, and static serving.
- `public/`: responsive, accessible browser interface with no framework dependency.
- `test/`: workflow, server, persistence, concurrency, and mocked-provider tests.

No arbitrary code execution or automatic external publication is implemented. Browser content is rendered with text nodes rather than interpreted HTML. The server uses a strict static-file allowlist, request-size limits, origin/host checks, and a content security policy.

## Data and backup

The active project is stored in `data/project.json`. Creating a new project archives the previous one in the same directory; the interface currently opens only the active project. `data/` and `.env` are excluded from Git. This local storage is not encrypted and its activity log is not tamper-proof.

Use **JSON export** to back up your project. To restore, stop the server, back up the current file, replace `data/project.json` with an unmodified export from this version, and restart. Do not load arbitrary or edited project files. A browser-based import flow and migrations are future work. The server fails on unreadable or unsupported saved data instead of overwriting it.

Set `RESEARCHGUIDE_DATA_DIR` to an absolute directory path to store projects elsewhere. Backups, archives, and model-server records are outside the UI's lifecycle; manage them on your computer. Do not use this release for restricted participant data or authenticated institutional review.

## Development and verification

```bash
npm run dev
npm run check
npm test
```

Tests use Node's built-in runner. CI runs syntax and unit/integration checks on Windows and Ubuntu with Node 22 and 24.

The optional browser smoke test requires Playwright and Chromium:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/browser-smoke.mjs
```

It uses temporary data, walks project creation through review, checks export and revision invalidation, verifies mobile overflow, and regenerates the screenshots. Browser checks are not currently included in CI. `PLAYWRIGHT_MODULE` can point to an existing Playwright module URL instead of installing it here.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [the roadmap](docs/ROADMAP.md), and [security and data boundaries](SECURITY.md). The most useful early contributions are novice-researcher interviews, supervisor review of the milestone prompts, tests of failure cases, and integrations supported by real research workflows.

OpenMAIC inspired the director-and-specialist interaction pattern. This is an independent implementation; no OpenMAIC code, assets, or branding are included, and no affiliation is claimed.

## License

[MIT](LICENSE). ResearchGuide is a working project name, not a claim of trademark clearance.
