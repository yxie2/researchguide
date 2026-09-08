# Security and data boundaries

This release is for a single person running ResearchGuide on their own computer. It binds to 127.0.0.1, rejects non-local Host headers, restricts request origins, and serves only explicitly allowed public files. Do not put it behind a public reverse proxy or treat it as an authenticated service.

Supervisor review is a local demonstration. A typed name is not an identity check. Anyone with access to the computer or data files can view or alter them. Files are not encrypted; the log is not tamper-proof. The software cannot certify research quality or permissions.

Demo mode makes no model calls. Ollama and OpenAI-compatible API modes sends saved project content to the endpoint configured by the operator. The repository excludes environment files and project data. Avoid secrets and restricted research data in artifacts, source passages, or prompts.

Before institutional deployment, the project needs authentication, authorization, secure collaboration, retention/deletion workflows, storage migrations, deployment review, and an agreed data-processing policy. Code execution will require a separately designed sandbox; it must not be added through unrestricted shell tools.

If GitHub private vulnerability reporting is enabled for the published repository, use that channel. Otherwise contact the maintainer through a private channel they publish. Do not post credentials, private project records, or sensitive exploit details in public issues.

API keys are saved separately in the local, unencrypted `data/model-settings.json` (or supplied through environment variables). Settings responses expose only whether a key exists. Keys are excluded from project exports, and provider error bodies are not forwarded to the browser. Existing keys are never reused after changing the endpoint or provider. Remote endpoints require HTTPS; redirects are rejected. A connection test sends only a generic prompt; guidance sends saved research context. Protect local files and consider the selected provider's data handling before sending research content.
