import { openTask } from './workflow-ui.mjs';
// Optional UI smoke test. Install Playwright separately or set PLAYWRIGHT_MODULE to its module URL.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-browser-'));
const app = await createApp({ dataDir });
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await page.getByRole('heading', { name: 'Frame your question', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Feedback & learning: a first study');
  await page
    .getByLabel('What would you like to investigate?')
    .fill(
      'How is feedback frequency associated with end-of-term scores among first-year students?',
    );
  await page.getByRole('button', { name: 'Create research notebook' }).click();
  await openTask(page, 'workspace');
  await page
    .getByLabel('Research brief')
    .fill(
      'Research question: How is feedback frequency associated with end-of-term scores among first-year students?\n\nPopulation: First-year university students.\n\nDesign: Secondary analysis of a permitted dataset.\n\nBoundary: This observational comparison cannot establish that feedback causes better outcomes.',
    );
  await page
    .getByLabel('Explain it in your own words')
    .fill(
      'The question connects a measured exposure to an outcome in an available population. Prior achievement might affect both, so I need to consider confounding and keep causal claims outside the scope of this study.',
    );
  await page.getByRole('button', { name: 'Save your work', exact: true }).click();
  await page.getByText('Saved on this computer', { exact: true }).waitFor();
  await mkdir('docs/images', { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#notice').evaluate((node) => {
    node.textContent = '';
  });
  await page.screenshot({ path: 'docs/images/workspace.png', fullPage: true });
  await openTask(page, 'guide');
  await page
    .getByLabel('Where are you getting stuck?')
    .fill('What does an observational design allow me to conclude?');
  await page.getByRole('button', { name: 'Run the demo guide' }).click();
  await page.getByText('Guidance saved in your project history.', { exact: true }).waitFor();
  assert.equal(await page.locator('.trace-step').count(), 4);
  await openTask(page, 'workspace');
  await page.getByRole('button', { name: 'Request supervisor review' }).click();
  await page.getByLabel('Reviewer name').fill('Example supervisor');
  await page
    .getByLabel('Reason for your decision')
    .fill(
      'For this example, the question and limitations are sufficiently explicit. Confirm dataset access before proceeding.',
    );
  await page.getByRole('button', { name: 'Approve this version' }).click();
  await page
    .getByText('Local approval recorded. The next milestone is available.', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: '02 Evidence' }).click();
  await openTask(page, 'sources');
  await page.getByLabel('Paper or resource title').fill('Illustrative source record');
  await page.getByLabel('Source URL').fill('https://example.org/study');
  await page.getByLabel('Page or section').fill('Example section');
  await page
    .getByLabel('Passage you inspected')
    .fill(
      'This is a synthetic source passage for a software test. It is not evidence for the study.',
    );
  await page.getByRole('button', { name: 'Add source', exact: true }).click();
  await page.getByRole('heading', { name: 'Illustrative source record' }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  await page.getByRole('link', { name: 'Download readable report (.md)' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'researchguide-project.md');
  await page.getByRole('button', { name: '✓ Question' }).click();
  await openTask(page, 'workspace');
  await page
    .getByLabel('Research brief')
    .fill(
      'Updated research question and population. This change requires a fresh review of the current milestone and any approved downstream artifacts. Causal claims remain outside the scope of this study.',
    );
  await page.getByRole('button', { name: 'Save your work', exact: true }).click();
  await page.getByText('Saved on this computer', { exact: true }).waitFor();
  await page.reload();
  await openTask(page, 'workspace');
  await page.getByLabel('Research brief').waitFor();
  assert.match(await page.getByLabel('Research brief').inputValue(), /Updated research question/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#notice').evaluate((node) => {
    node.textContent = '';
  });
  await page.screenshot({ path: 'docs/images/mobile.png', fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'No horizontal page overflow on mobile',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Browser smoke passed: project creation, saving, demo guidance, review, source records, export, invalidation, reload, and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await rm(dataDir, { recursive: true, force: true });
}
