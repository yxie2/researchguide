import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { createProject } from '../lib/workflow.mjs';
import { parseBackup } from '../lib/projects.mjs';
import { openTask } from './workflow-ui.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-literature-'));
await writeFile(
  path.join(dir, 'project.json'),
  JSON.stringify(
    createProject('Synthetic reading project', 'How is employee training related to sales?'),
  ),
);
let calls = 0;
const provider = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw),
    context = JSON.parse(body.messages[1].content);
  calls++;
  const content = body.messages[0].content.startsWith('Generate')
    ? 'employee training sales'
    : JSON.stringify({
        suggestions: context.papers.map((p) => ({
          id: p.id,
          priority: 'medium',
          reason: 'Tentative relevance based on the abstract.',
          readFor: 'Inspect sampling and alternative explanations.',
        })),
      });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
await new Promise((r) => provider.listen(0, '127.0.0.1', r));
const app = await createApp({
  dataDir: dir,
  llmSettings: {
    provider: 'openai-compatible',
    model: 'mock',
    baseUrl: `http://127.0.0.1:${provider.address().port}`,
    tokenParameter: 'max_tokens',
  },
  literatureSearch: async (query) => ({
    catalogues: ['Crossref', 'arXiv'],
    warnings: ['Europe PMC was unavailable; this search has partial coverage.'],
    results:
      query === 'empty'
        ? []
        : [
            {
              id: 'paper-fixture',
              provider: 'Crossref',
              catalogues: ['Crossref', 'arXiv'],
              title: 'Synthetic training and sales paper',
              doi: '10.1234/test',
              url: 'https://doi.org/10.1234/test',
              arxivUrl: 'https://arxiv.org/abs/2401.12345v1',
              authors: 'Test Author',
              year: '2024',
              journal: 'Synthetic test journal',
              abstract: 'This is a software test fixture, not real literature.',
              type: 'journal-article',
              access: 'Access not verified.',
              readingList: false,
              note: '',
            },
          ],
  }),
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${app.address().port}`;
  await page.goto(base);
  await page.locator('.stage-button').nth(1).click();
  await page.getByRole('button', { name: 'Find and suggest papers with AI', exact: true }).click();
  await page.getByText('Tentative relevance based on the abstract.', { exact: true }).waitFor();
  assert.equal(await page.locator('#literature-query').inputValue(), 'employee training sales');
  assert.equal(calls, 2);
  assert.equal(
    await page
      .getByRole('link', { name: 'Read the arXiv version', exact: true })
      .getAttribute('href'),
    'https://arxiv.org/abs/2401.12345v1',
  );
  await page
    .locator('#reading-note-paper-fixture')
    .fill('Read the sampling description and confounding discussion.');
  await page.getByRole('button', { name: 'Save to reading list', exact: true }).click();
  await page.getByRole('button', { name: 'Remove from reading list', exact: true }).waitFor();
  let p = (await (await fetch(base + '/api/project')).json()).project;
  assert.equal(p.sources.length, 0);
  assert.equal(p.literatureSearches[0].results[0].readingList, true);
  assert.match(p.literatureSearches[0].results[0].arxivUrl, /2401.12345v1/);
  const stale = await fetch(base + '/api/literature-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query: 'test', revision: 0 }),
  });
  assert.equal(stale.status, 409);
  await page.reload();
  await page.locator('.stage-button').nth(1).click();
  await page.getByRole('button', { name: 'Remove from reading list', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Record a passage I have read', exact: true }).click();
  assert.equal(await page.locator('#title').inputValue(), 'Synthetic training and sales paper');
  assert.equal(await page.locator('#url').inputValue(), 'https://doi.org/10.1234/test');
  await page.locator('#location').fill('Synthetic abstract');
  await page.locator('#passage').fill('This is a software test fixture, not real literature.');
  await page.getByRole('button', { name: 'Add source', exact: true }).click();
  await page
    .getByText('Source added. Evidence and dependent reviews need renewal.', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Upload and extract PDF', exact: true }).waitFor();
  const backup = await (await fetch(base + '/api/export?format=backup')).json();
  p = parseBackup(backup).project;
  assert.equal(p.sources.length, 1);
  assert.equal(p.literatureSearches[0].results[0].readingList, true);
  await openTask(page, 'literature');
  await page.locator('#literature-query').fill('empty');
  await page.getByRole('button', { name: 'Search with my keywords', exact: true }).click();
  await page.getByText(/No matching records found/).waitFor();
  assert.equal(calls, 2);
  assert.deepEqual(errors, []);
  console.log(
    'Literature browser check passed: agent search and suggestions, partial coverage, reading list, reload, source handoff, upload option, backup restore, stale revision, empty search and mobile.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  const resolved = path.resolve(dir);
  if (
    !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(resolved).startsWith('researchguide-literature-')
  )
    throw Error('Unexpected cleanup path');
  await rm(resolved, { recursive: true, force: true });
}
