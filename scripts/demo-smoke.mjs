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
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [],
    demoApiCalls = [];
  const original = await (await fetch(`${base}/api/project`)).json();
  await page.goto(base);
  await page.getByRole('button', { name: 'Your workspace', exact: true }).click();
  await page.getByLabel('Research brief').fill('Unsaved work must survive exploring the demo.');
  const popup = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Explore demo case' }).click();
  const demo = await popup;
  demo.on('pageerror', (error) => errors.push(error.message));
  demo.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) demoApiCalls.push(request.url());
  });
  await demo.getByRole('button', { name: 'Start the seven-phase walkthrough' }).click();
  for (let i = 0; i < 7; i++) {
    assert.equal(await demo.locator('.demo-transcript article').count(), 1);
    await demo.getByRole('button', { name: 'Reveal next exchange' }).click();
    assert.equal(await demo.locator('.demo-transcript article').count(), 2);
    await demo.getByRole('button', { name: 'Show full phase' }).click();
    await demo.getByRole('heading', { name: 'The accepted teaching artifact' }).waitFor();
    if (i === 0) {
      await demo
        .getByRole('button', { name: 'Does extra studying cause better learning?', exact: true })
        .click();
      await demo.getByRole('status').filter({ hasText: 'Reconsider.' }).waitFor();
      await demo
        .getByRole('button', {
          name: 'How are recorded study hours associated with quiz scores?',
          exact: true,
        })
        .click();
      await demo.getByRole('status').filter({ hasText: 'Yes.' }).waitFor();
    }
    if (i === 1) assert.equal(await demo.locator('.demo-source').count(), 2);
    if (i === 4) {
      await demo.getByRole('heading', { name: 'Recorded R outputs' }).waitFor();
      assert.match(await demo.locator('.demo-outputs').textContent(), /1.942857/);
    }
    if (i < 6) await demo.getByRole('button', { name: 'Next phase' }).click();
  }
  await demo.reload();
  await demo.getByRole('heading', { name: 'Assemble the complete research package' }).waitFor();
  await demo.getByRole('heading', { name: 'Take the example apart.' }).waitFor();
  for (const [label, expected] of [
    ['Download walkthrough (.md)', /Rejected wording/],
    ['Download synthetic CSV', /study_hours,quiz_score/],
    ['Download reproduction bundle', /"status": "succeeded"/],
  ]) {
    const event = demo.waitForEvent('download');
    await demo.getByRole('button', { name: label, exact: true }).click();
    const download = await event;
    assert.match(await readFile(await download.path(), 'utf8'), expected);
  }
  await demo.screenshot({ path: 'docs/images/demo.png', fullPage: true });
  await demo.setViewportSize({ width: 390, height: 844 });
  assert.equal(await demo.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await demo.getByRole('button', { name: 'Restart walkthrough' }).click();
  await demo.getByText('0 of 7 phase conversations explored', { exact: false }).waitFor();
  assert.equal(
    await page.getByLabel('Research brief').inputValue(),
    'Unsaved work must survive exploring the demo.',
  );
  assert.deepEqual(await (await fetch(`${base}/api/project`)).json(), original);
  assert.deepEqual(demoApiCalls, []);
  assert.deepEqual(errors, []);
  console.log(
    'Demo browser smoke passed: seven phases, reveal controls, learning checks, actual output display, three downloads, reload, restart, mobile, and preserved unsaved/active notebook without API calls.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => app.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
