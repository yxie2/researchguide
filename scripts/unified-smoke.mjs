import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
import { openTask } from './workflow-ui.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-unified-'));
const app = await createApp({ dataDir });
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await page.locator('.workflow-sequence').waitFor();
  assert.equal(await page.locator('.tabs').count(), 0);
  assert.equal(await page.locator('.workflow-task').count(), 2);
  await page.getByRole('button', { name: 'Go to suggested action', exact: true }).click();
  await page
    .getByLabel('Research direction')
    .fill(
      'A fictional association question: among first-year students in a synthetic class dataset, how are reported weekly study hours associated with quiz scores? This observational comparison cannot establish causation.',
    );
  await page
    .getByLabel('Explain it in your own words')
    .fill(
      'I can estimate an association, but this observational design cannot establish causation.',
    );
  await openTask(page, 'guide');
  await page
    .getByLabel('Where are you getting stuck?')
    .fill('Keep this unsent mentor question while I check my document.');
  await openTask(page, 'workspace');
  assert.match(await page.getByLabel('Research direction').inputValue(), /fictional association/);
  await openTask(page, 'guide');
  assert.match(
    await page.getByLabel('Where are you getting stuck?').inputValue(),
    /Keep this unsent/,
  );
  await openTask(page, 'workspace');
  await page.getByLabel('Explain it in your own words').fill('');
  await page.getByRole('button', { name: 'Save and continue →', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Review the literature and refine your question', exact: true })
    .waitFor();
  assert.equal(await page.locator('.workflow-task').count(), 2);
  const saved = (await (await fetch(`http://127.0.0.1:${app.address().port}/api/project`)).json())
    .project;
  assert.equal(saved.milestones[0].status, 'completed');
  assert.equal(saved.milestones[0].reviews.length, 0);
  await page.getByText('What carries forward into this step', { exact: true }).click();
  assert.match(await page.locator('.workflow-context').textContent(), /fictional association/);
  await page.screenshot({ path: 'docs/images/unified-workflow.png', fullPage: true });
  await openTask(page, 'execution');
  assert.equal(await page.locator('.workflow-shared').count(), 1);
  assert.equal(
    await page
      .getByRole('heading', { name: 'Review the literature and refine your question', exact: true })
      .count(),
    1,
  );
  await page.getByRole('button', { name: 'Return to this step’s tasks', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(
    'Unified workflow smoke passed: shorter stage sequences, optional mentor access, draft/form retention, save-and-continue without mandatory reflection or review, carried context, shared materials and mobile.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await rm(dataDir, { recursive: true, force: true });
}
