# Finding public datasets

In **Step 4 → Find relevant public datasets**, enter keywords or ask your configured model to suggest terms from your saved research interest, literature review/refined question and study design. Review and edit the terms, then select **Search public datasets**.

Search retrieves up to ten relevance-ranked dataset records from Harvard Dataverse. It works without an LLM or catalogue API key. Coverage is limited to this catalogue, and a public record does not guarantee unrestricted file access or permission to reuse the files. The integration uses the [official Dataverse Search API](https://guides.dataverse.org/en/latest/api/search.html).

Open a candidate's repository record to inspect the documentation. **Assess fit with AI** compares retrieved metadata against the saved study context. It identifies possible fit, missing information and checks before use; it does not inspect the files or certify quality. Assessments are flagged when the saved research question or design changes.

Explain your decision and **Save to shortlist**. Searches, citations, assessments and decisions are retained in the project, project backup and Markdown export. The conversation guide receives shortlisted candidates from the latest five searches, explicitly distinguished from actual imported data.

Verify population, variables, sampling, geography, dates, codebook, licence and access conditions. Explain your final choice and preparation work in the Data preparation document. Open **Manage your project data workspace** in Step 4 to see all stored files and shortlisted public records. For a public record, choose **Attach CSV from this record** after downloading a permitted file from the repository. The import retains the original filename, catalogue URL, citation and your permission statement. The source link is your attribution; the app does not independently verify that an uploaded file matches a repository file.

Use **Add another dataset** to upload your own file or choose another public source. The project supports up to 20 stored CSV files, 2 MB each and 20 MB total. Add and save notes explaining each file’s role or version, download stored copies, and select individual datasets for inspection and analysis. Files remain separate; this feature does not join datasets automatically. Project backups preserve all stored files and source links. Public records without attached files are marked **No file stored yet**. You can skip discovery and upload your own data directly. Shortlisting never imports data, approves a study or generates findings.

Only submitted keywords are sent to Harvard Dataverse. Optional AI requests send the saved study context and, for fit assessment, the selected catalogue record to your configured model. File downloads are manual. Up to 50 searches are stored per project; each returns up to ten results. Search failures preserve existing work.

Validation: `npm test`; browser check: `node scripts/discovery-smoke.mjs` (Playwright required, or set `PLAYWRIGHT_MODULE` to its module path). Browser tests use synthetic records and a mock model, not user project data.
