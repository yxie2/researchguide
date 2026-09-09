import { openTask } from './workflow-ui.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { samplePDF } from './pdf-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-evidence-ui-'));
const provider = http.createServer(async (req, res) => {
  for await (const chunk of req) {
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              verdict: 'partial',
              rationale: 'The passage describes an association, not a causal effect.',
              suggestedClaim: 'AI use was associated with grades in this observational study.',
              sources: [
                {
                  sourceId: 'S1',
                  relation: 'limits',
                  reason: 'The design cannot establish causation.',
                },
              ],
            }),
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
    maxOutputTokens: 4096,
    tokenParameter: 'max_tokens',
  },
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await openTask(page, 'sources');
  await page.locator('#paper-title').fill('Synthetic observational study');
  await page
    .locator('#paper-file')
    .setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: samplePDF() });
  await page.getByRole('button', { name: 'Upload and extract PDF', exact: true }).click();
  await page
    .getByText('PDF extracted locally. Inspect a page and save a short passage.', { exact: true })
    .waitFor();
  await page.locator('#pdf-passage').fill(await page.locator('#extracted-page').inputValue());
  await page.getByRole('button', { name: 'Save page-linked passage', exact: true }).click();
  await page
    .getByText('Passage linked to its PDF page. You can now attach it to a claim.', { exact: true })
    .waitFor();
  await openTask(page, 'claims');
  await page.locator('#claim-text').fill('AI use causes better grades.');
  await page.locator('fieldset input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Save claim', exact: true }).click();
  await page.getByText('Claim saved. Assess its linked evidence next.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Assess linked evidence', exact: true }).click();
  await page
    .getByText('AI assessment saved. Inspect the passages and record your own decision.', {
      exact: true,
    })
    .waitFor();
  await page.getByText('Record your inspection and decision', { exact: true }).click();
  await page.locator('#researcher-C1').fill('Example researcher');
  await page
    .locator('#reason-C1')
    .fill(
      'I inspected the passage. The observational design supports an association but cannot establish that AI caused higher grades.',
    );
  await page.locator('#decision-C1').selectOption('agree');
  await page.locator('#inspected-C1').check();
  await page.getByRole('button', { name: 'Save researcher decision', exact: true }).click();
  await page
    .getByText('Researcher decision recorded. This is not supervisor approval.', { exact: true })
    .waitFor();
  await page.screenshot({ path: 'docs/images/evidence.png', fullPage: true });
  await page.reload();
  await openTask(page, 'claims');
  await page.getByText(/Researcher agree/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'Evidence fits mobile',
  );
  await page.getByRole('button', { name: 'Edit using this wording', exact: true }).click();
  await page.getByRole('button', { name: 'Save claim', exact: true }).click();
  await page.getByText('Claim saved. Assess its linked evidence next.', { exact: true }).waitFor();
  await page.getByText(/Outdated AI suggestion/).waitFor();
  assert.equal(
    await page.getByText('Record your inspection and decision', { exact: true }).count(),
    0,
  );
  const exported = await (
    await page.request.get(`http://127.0.0.1:${app.address().port}/api/export?format=md`)
  ).text();
  assert.match(exported, /Local researcher decision/);
  assert.match(exported, /SHA-256/);
  assert.deepEqual(errors, []);
  console.log(
    'Evidence browser smoke passed: PDF upload, exact passage, claim assessment, researcher decision, reload, stale assessment, export and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  await rm(dir, { recursive: true, force: true });
}
