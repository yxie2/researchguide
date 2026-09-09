import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';
import { createProject } from '../lib/workflow.mjs';
import { analysisCSV, analysisRationale } from './analysis-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-analysis-ui-'));
const initial = createProject(
  'Synthetic hours and scores',
  'How are study hours associated with scores?',
);
initial.milestones[0].artifact =
  'Estimate the association between weekly study hours and scores among students in this synthetic example.';
initial.milestones[0].version = 1;
initial.milestones[2].artifact =
  'Use an observational, unadjusted simple linear regression. Report uncertainty and avoid causal conclusions.';
initial.milestones[2].version = 1;
await writeFile(path.join(dir, 'project.json'), JSON.stringify(initial));
const calls = [];
const provider = http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const data = JSON.parse(body);
  calls.push(data);
  const output = data.messages[0].content.includes('Propose a conservative')
    ? { method: 'linear', outcome: 1, predictor: 0, rationale: analysisRationale }
    : {
        summary: 'Review includes actual R output. Conclusions have not been drafted yet.',
        findings: [],
      };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }));
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
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = `http://127.0.0.1:${app.address().port}`;
  await page.goto(url);
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await page.locator('#dataset-name').fill('Synthetic study data');
  await page
    .locator('#analysis-csv')
    .setInputFiles({ name: 'study.csv', mimeType: 'text/csv', buffer: Buffer.from(analysisCSV) });
  await page
    .locator('#dataset-permission')
    .fill('Synthetic numbers generated solely for this software test.');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  await page
    .getByText('Dataset version saved locally. Review its profile before choosing an analysis.', {
      exact: true,
    })
    .waitFor();
  await page.getByText('Choose a plan manually', { exact: true }).click();
  await page.locator('#analysis-method').selectOption('linear');
  await page.locator('#analysis-outcome').selectOption('1');
  await page.locator('#analysis-predictor').selectOption('0');
  await page.locator('#analysis-rationale').fill(analysisRationale);
  await page.getByRole('button', { name: 'Save analysis plan', exact: true }).click();
  await page.getByText('Analysis plan saved for review.', { exact: true }).waitFor();
  let state = (await (await page.request.get(url + '/api/project')).json()).project;
  assert.equal(state.analysisPlans[0].outcome, 1);
  assert.equal(state.analysisPlans[0].predictor, 0);
  assert.equal(
    (
      await page.request.post(url + '/api/analysis/run', {
        data: { revision: state.revision, planId: 'P1', approvalId: 'unapproved' },
      })
    ).status(),
    409,
  );
  await page.getByRole('button', { name: 'Ask AI to propose a plan', exact: true }).click();
  await page
    .getByText(
      'Proposed plan saved. Review its rationale, limitations, and R script before approving.',
      { exact: true },
    )
    .waitFor();
  assert.equal(JSON.stringify(calls[0]).includes('1,2'), false);
  await page.getByText('Review the exact R script', { exact: true }).click();
  await page.getByText('Approve this plan and script', { exact: true }).click();
  await page.locator('#analysis-reviewer').fill('Example researcher');
  await page
    .locator('#analysis-approval-note')
    .fill(
      'I reviewed the variable mapping and the exact regression script. This is an appropriate unadjusted synthetic test.',
    );
  await page.locator('#analysis-reviewed').check();
  await page.getByRole('button', { name: 'Approve for execution', exact: true }).click();
  await page
    .getByText('Execution approval recorded. You can now run this exact plan.', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Run approved R analysis', exact: true }).click();
  await page
    .getByText('Run R1 completed. Inspect the recorded outputs below.', { exact: true })
    .waitFor();
  await page
    .getByRole('heading', { name: 'Regression coefficients and 95% intervals', exact: true })
    .waitFor();
  await page.screenshot({ path: 'docs/images/analysis.png', fullPage: true });
  const bundle = await (await page.request.get(url + '/api/analysis/runs/R1')).json();
  assert.equal(bundle.run.status, 'succeeded');
  assert.match(bundle.run.files['coefficients.csv'], /1.942857/);
  assert.equal(bundle.dataset.csv, analysisCSV);
  await page.getByRole('button', { name: 'Consistency review', exact: true }).click();
  await page.getByRole('button', { name: 'Run consistency review', exact: true }).click();
  await page
    .getByText('Consistency review saved. Inspect each finding against the quoted text.', {
      exact: true,
    })
    .waitFor();
  assert.equal(JSON.parse(calls.at(-1).messages[1].content).milestones.at(-1).id, 'execution');
  await page.reload();
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await page.getByRole('heading', { name: 'R1 · succeeded · P2 / D1', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'Analysis fits mobile',
  );
  state = (await (await page.request.get(url + '/api/project')).json()).project;
  await page.request.post(url + '/api/action', {
    data: {
      type: 'save',
      revision: state.revision,
      stageId: 'design',
      artifact:
        'The study design has changed substantially. Reconsider the analysis before running it again.',
      explanation: '',
    },
  });
  await page.reload();
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
  await page
    .getByText('Outdated — create a new plan after reviewing your changes', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Run approved R analysis', exact: true }).isDisabled(),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    'Analysis browser smoke passed: CSV import, manual and AI plans, approval enforcement, real R regression, reproduction bundle, consistency input, persistence and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  await rm(dir, { recursive: true, force: true });
}
