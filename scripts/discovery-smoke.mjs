import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { openTask } from './workflow-ui.mjs';
import { parseBackup } from '../lib/projects.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-discovery-'));
let calls = 0;
const provider = http.createServer(async (req, res) => {
  for await (const chunk of req) {
    /* consume synthetic request */
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content:
              ++calls === 1
                ? 'training sales'
                : 'Potential fit: training. Missing information: population. Checks before use: inspect variables and licence.',
          },
        },
      ],
    }),
  );
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
  datasetSearch: async (query) =>
    query === 'empty'
      ? []
      : [
          {
            id: 'fixture',
            title: 'Synthetic training dataset',
            url: 'https://doi.org/10.7910/DVN/TEST',
            description: 'Browser test fixture, not real data.',
            publisher: 'Synthetic repository fixture',
            publishedAt: '',
            citation: '',
            access: 'Licence not verified.',
            shortlisted: false,
          },
        ],
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${app.address().port}`;
  await page.goto(base);
  await page.locator('.stage-button').nth(3).click();
  await openTask(page, 'discovery');
  await page.getByRole('button', { name: 'Suggest keywords from my study', exact: true }).click();
  await page
    .getByText('Suggested keywords are ready to review before searching.', { exact: true })
    .waitFor();
  assert.equal(await page.locator('#data-query').inputValue(), 'training sales');
  await page.getByRole('button', { name: 'Search public datasets', exact: true }).click();
  await page.getByRole('heading', { name: 'Synthetic training dataset', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Assess fit with AI', exact: true }).click();
  await page.getByText(/Potential fit: training/).waitFor();
  await page
    .locator('#dataset-note-fixture')
    .fill('Inspect the population and licence before use.');
  await page.getByRole('button', { name: 'Save to shortlist', exact: true }).click();
  await page
    .getByText('Shortlisted for inspection; not imported or approved.', { exact: true })
    .waitFor();
  await page.reload();
  await page.locator('.stage-button').nth(3).click();
  await openTask(page, 'discovery');
  await page.getByRole('button', { name: 'Remove from shortlist', exact: true }).waitFor();
  const p = (await (await fetch(base + '/api/project')).json()).project;
  assert.equal(p.dataSearches[0].results[0].shortlisted, true);
  assert.equal(p.datasets?.length || 0, 0);
  const stale = await fetch(base + '/api/data-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query: 'test', revision: 0 }),
  });
  assert.equal(stale.status, 409);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#data-query').fill('empty');
  await page.getByRole('button', { name: 'Search public datasets', exact: true }).click();
  await page.getByText(/No matching datasets found/).waitFor();
  await openTask(page, 'execution');
  await page.getByText('Import a permitted CSV dataset', { exact: true }).waitFor();
  await page.getByText('Synthetic training dataset · No file stored yet', { exact: true }).click();
  await page.getByRole('button', { name: 'Attach CSV from this record', exact: true }).click();
  assert.equal(await page.locator('#dataset-name').inputValue(), 'Synthetic training dataset');
  assert.match(await page.locator('#dataset-origin').inputValue(), /:fixture$/);
  await page
    .locator('#analysis-csv')
    .setInputFiles({
      name: 'public.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('x,y\n1,2\n2,4\n'),
    });
  await page
    .locator('#dataset-permission')
    .fill('Synthetic test fixture with permission for testing.');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  await page.getByText(/1 stored CSVs · 1 linked to Dataverse/).waitFor();
  await page.getByRole('button', { name: 'Add another dataset', exact: true }).click();
  assert.equal(await page.locator('#dataset-origin').inputValue(), '');
  await page.locator('#dataset-name').fill('Own survey');
  await page
    .locator('#analysis-csv')
    .setInputFiles({
      name: 'own.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('x,y\n3,5\n4,7\n'),
    });
  await page
    .locator('#dataset-permission')
    .fill('Synthetic test fixture with permission for testing.');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  await page.getByText(/2 stored CSVs · 1 linked to Dataverse/).waitFor();
  await page
    .getByText('D1 · Synthetic training dataset · 2 rows · Dataverse file (researcher linked)', {
      exact: true,
    })
    .click();
  await page
    .locator('#data-notes-D1')
    .fill('Public comparison file; check population before comparison.');
  await page.getByRole('button', { name: 'Save dataset notes', exact: true }).first().click();
  await page.getByText('Dataset notes saved.', { exact: true }).waitFor();
  await page
    .getByText('D1 · Synthetic training dataset · 2 rows · Dataverse file (researcher linked)', {
      exact: true,
    })
    .click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download stored CSV', exact: true }).first().click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'D1.csv');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), 'x,y\n1,2\n2,4\n');
  await page
    .getByRole('button', { name: 'Select for inspection and analysis', exact: true })
    .first()
    .click();
  assert.equal(await page.locator('#analysis-dataset').inputValue(), 'D1');
  const backup = await (await fetch(base + '/api/export?format=backup')).json();
  const restored = parseBackup(backup).project;
  assert.equal(restored.datasets.length, 2);
  assert.equal(restored.datasets[0].origin.candidateId, 'fixture');
  assert.match(restored.datasets[0].notes, /Public comparison/);
  assert.equal(restored.datasets[1].origin.kind, 'upload');
  await page.reload();
  await openTask(page, 'execution');
  await page.getByText(/2 stored CSVs · 1 linked to Dataverse/).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(calls, 2);
  assert.deepEqual(errors, []);
  console.log(
    'Discovery and data workspace browser check passed: AI search flow, public and local imports, source linkage, notes, download, dataset selection, backup restoration, reload and mobile.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  const resolved = path.resolve(dir);
  if (
    !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(resolved).startsWith('researchguide-discovery-')
  )
    throw Error('Unexpected cleanup path');
  await rm(resolved, { recursive: true, force: true });
}
