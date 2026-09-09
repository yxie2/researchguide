import { openTask } from './workflow-ui.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { consistencyFixture, consistencyReply } from './consistency-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-consistency-ui-'));
await writeFile(path.join(dir, 'project.json'), JSON.stringify(consistencyFixture()));
const provider = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const context = JSON.parse(JSON.parse(body).messages[1].content);
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(
              context.throughStage === 'design'
                ? { summary: 'Planning fit checked without findings.', findings: [] }
                : consistencyReply(),
            ),
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
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = `http://127.0.0.1:${app.address().port}`;
  await page.goto(url);
  await page.locator('.stage-button').nth(2).click();
  await openTask(page, 'consistency');
  await page.getByRole('button', { name: 'Check question–methods fit', exact: true }).click();
  await page.getByText('Planning fit checked without findings.', { exact: true }).waitFor();
  const designReport = (
    await (await page.request.get(url + '/api/project')).json()
  ).project.consistencyReports.at(-1);
  assert.deepEqual(
    designReport.snapshot.map((s) => s.id),
    ['question', 'evidence', 'design'],
  );
  assert.deepEqual(designReport.missing, []);
  await page.locator('.stage-button').nth(6).click();
  await openTask(page, 'consistency');
  await page.getByRole('button', { name: 'Run consistency review', exact: true }).click();
  await page
    .getByText('Consistency review saved. Inspect each finding against the quoted text.', {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole('heading', { name: 'Causal conclusion exceeds the study design', exact: true })
    .waitFor();
  await page.getByText('Respond to F1', { exact: true }).click();
  await page.locator('#consistency-name-F1').fill('Example researcher');
  await page
    .locator('#consistency-note-F1')
    .fill(
      'I agree that the observational design cannot establish causality. I will revise the conclusion and report the uncertainty.',
    );
  await page.locator('#consistency-decision-F1').selectOption('agree');
  await page.getByRole('button', { name: 'Save finding response', exact: true }).click();
  await page
    .getByText(
      'Researcher response saved. This does not resolve the issue automatically or grant approval.',
      { exact: true },
    )
    .waitFor();
  await page.screenshot({ path: 'docs/images/consistency.png', fullPage: true });
  await page.reload();
  await page.locator('.stage-button').nth(6).click();
  await openTask(page, 'consistency');
  await page.getByText(/Example researcher · agree/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'Consistency review fits mobile',
  );
  await page
    .getByRole('button', { name: 'Interpretation · v1 · artifact', exact: true })
    .first()
    .click();
  await page
    .locator('#artifact')
    .fill(
      'The observational analysis does not establish a causal effect. The interval includes zero, so the direction of the association is uncertain.',
    );
  await page.getByRole('button', { name: 'Save your work', exact: true }).click();
  await page
    .getByText('Saved. Revisit completion or reviews affected by changes.', { exact: true })
    .waitFor();
  await page.locator('.stage-button').nth(6).click();
  await openTask(page, 'consistency');
  await page.getByText(/Outdated or unsaved changes/).waitFor();
  assert.equal(await page.getByText('Respond to F1', { exact: true }).count(), 0);
  const md = await (await page.request.get(url + '/api/export?format=md')).text();
  assert.match(md, /Cross-milestone consistency reviews/);
  assert.match(md, /Example researcher/);
  assert.match(md, /outdated/);
  assert.deepEqual(errors, []);
  console.log(
    'Consistency browser smoke passed: review, exact quotations, researcher response, reload, milestone navigation, stale detection, export and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  await rm(dir, { recursive: true, force: true });
}
