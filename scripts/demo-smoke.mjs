import { openTask } from './workflow-ui.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-demo-'));
const app = await createApp({ dataDir });
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.address().port}`;
const business = process.argv.includes('--business');
const teachingCase = JSON.parse(
  await readFile(
    new URL(
      business ? '../public/business-demo-case.json' : '../public/demo-case.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [],
    demoApiCalls = [];
  const original = await (await fetch(`${base}/api/project`)).json();
  await page.goto(base);
  await openTask(page, 'workspace');
  await page.getByLabel('Research direction').fill('Unsaved work must survive exploring the demo.');
  const popup = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Explore demo case' }).click();
  const demo = await popup;
  demo.on('pageerror', (error) => errors.push(error.message));
  demo.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) demoApiCalls.push(request.url());
  });
  if (business) {
    // First establish distinct education progress, then switch to the business case.
    await demo.getByRole('button', { name: 'Start the seven-step walkthrough' }).click();
    await demo.getByRole('button', { name: 'Reveal next exchange' }).click();
    await demo.getByRole('link', { name: 'Business · Training and sales', exact: true }).click();
    await demo.getByRole('heading', { name: teachingCase.title, exact: true }).waitFor();
    assert.equal(
      await demo
        .getByRole('link', { name: 'Business · Training and sales', exact: true })
        .getAttribute('aria-current'),
      'page',
    );
  }
  await demo.getByRole('button', { name: 'Start the seven-step walkthrough' }).click();
  for (let i = 0; i < 7; i++) {
    assert.equal(await demo.locator('.step-project-title').textContent(), teachingCase.title);
    assert.equal(
      await demo.locator('.demo-task-sequence > details').count(),
      teachingCase.stages[i].tasks.length,
    );
    await demo.locator('.demo-task-sequence > details').first().locator('summary').click();
    await demo.getByText(teachingCase.stages[i].tasks[0].example, { exact: true }).waitFor();
    const exercise = demo.locator('.demo-decision');
    await exercise.getByRole('button').nth(0).click();
    await exercise.getByRole('status').waitFor();
    await exercise.getByRole('button').nth(teachingCase.stages[i].depth.correct).click();
    assert.match(await exercise.getByRole('status').textContent(), /Defensible choice/);
    assert.equal(await demo.locator('.demo-transcript article').count(), 1);
    await demo.getByRole('button', { name: 'Reveal next exchange' }).click();
    assert.equal(await demo.locator('.demo-transcript article').count(), 2);
    await demo.getByRole('button', { name: 'Show full step' }).click();
    await demo
      .getByRole('heading', { name: new RegExp(`^${business ? 'Alex' : 'Maya'}’s accepted `) })
      .waitFor();
    if (i === 0) {
      await demo
        .getByRole('button', { name: teachingCase.stages[0].challenge.choices[0], exact: true })
        .click();
      await demo.getByRole('status').filter({ hasText: 'Reconsider.' }).waitFor();
      await demo
        .getByRole('button', {
          name: teachingCase.stages[0].challenge.choices[1],
          exact: true,
        })
        .click();
      await demo.getByRole('status').filter({ hasText: 'Yes.' }).waitFor();
    }
    if (i === 1) assert.equal(await demo.locator('.demo-source').count(), 4);
    if (i === 4) {
      await demo.getByRole('heading', { name: 'Recorded R outputs' }).waitFor();
      assert.match(
        await demo.locator('.demo-outputs').first().textContent(),
        business ? /0.944055/ : /1.942857/,
      );
      await demo.getByText('Compare the exploratory sensitivity run', { exact: true }).click();
      await demo.getByRole('heading', { name: 'Exploratory R2 outputs', exact: true }).waitFor();
    }
    if (i === 3) {
      assert.equal(await demo.locator('.demo-datasets > details').count(), 6);
      await demo.locator('.demo-datasets > details').first().locator('summary').click();
      const downloadEvent = demo.waitForEvent('download');
      await demo.getByRole('button', { name: 'Download D1 CSV', exact: true }).click();
      assert.equal(await readFile(await (await downloadEvent).path(), 'utf8'), teachingCase.csv);
    }
    if (i < 6) await demo.getByRole('button', { name: 'Next step' }).click();
  }
  await demo.reload();
  await demo.getByRole('heading', { name: teachingCase.stages[6].title, exact: true }).waitFor();
  await demo.getByRole('heading', { name: 'Take the example apart.' }).waitFor();
  for (const [label, expected] of [
    ['Download walkthrough (.md)', /Rejected wording/],
    [
      'Download synthetic CSV',
      business ? /training_hours,next_month_sales_kusd/ : /study_hours,quiz_score/,
    ],
    ['Download reproduction bundle', /"status": "succeeded"/],
    ['Download dataset workspace', /prepareDemoRaw/],
  ]) {
    const event = demo.waitForEvent('download');
    await demo.getByRole('button', { name: label, exact: true }).click();
    const download = await event;
    assert.match(await readFile(await download.path(), 'utf8'), expected);
    if (label === 'Download reproduction bundle') {
      const bundle = JSON.parse(await readFile(await download.path(), 'utf8'));
      assert.equal(bundle.dataset.csv, teachingCase.csv);
      assert.equal(bundle.sensitivity.run.status, 'succeeded');
      assert.equal(bundle.datasets.length, 4);
    }
  }
  await demo.screenshot({
    path: business ? 'docs/images/business-demo.png' : 'docs/images/demo.png',
    fullPage: true,
  });
  await demo.setViewportSize({ width: 390, height: 844 });
  assert.equal(await demo.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await demo.getByRole('button', { name: 'Restart walkthrough' }).click();
  await demo.getByText('0 of 7 step conversations explored', { exact: false }).waitFor();
  if (business) {
    assert.equal((await demo.locator('#demo').textContent()).includes('Maya'), false);
    await demo.getByRole('link', { name: 'Education · Study habits', exact: true }).click();
    await demo
      .getByRole('heading', { name: 'Explore your research interest', exact: true })
      .waitFor();
    assert.equal(await demo.locator('.demo-transcript article').count(), 2);
    await demo.getByRole('link', { name: 'Business · Training and sales', exact: true }).click();
    await demo.getByRole('heading', { name: teachingCase.title, exact: true }).waitFor();
    await demo.getByText('0 of 7 step conversations explored', { exact: false }).waitFor();
  }
  assert.equal(
    await page.getByLabel('Research direction').inputValue(),
    'Unsaved work must survive exploring the demo.',
  );
  assert.deepEqual(await (await fetch(`${base}/api/project`)).json(), original);
  assert.deepEqual(demoApiCalls, []);
  assert.deepEqual(errors, []);
  console.log(
    `${business ? 'Business' : 'Education'} demo browser smoke passed: seven current steps, task panels, decision exercises, two R outputs, dataset downloads, reload, restart, mobile, and preserved unsaved/active notebook without API calls.`,
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => app.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
