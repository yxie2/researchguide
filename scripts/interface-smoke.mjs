// Visual and responsive checks use only an isolated fictional project.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { createProject } from '../lib/workflow.mjs';
import { openTask } from './workflow-ui.mjs';
import { importDataset } from '../lib/analysis.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const before = process.argv.includes('--before');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-interface-'));
const fixture = createProject(
  'Understanding study habits and student learning',
  'Explore how students describe their study habits, what outcomes matter and which measures a feasible observational study could use. This project is a fictional interface fixture.',
);
importDataset(fixture, {
  name: 'synthetic-study-hours.csv',
  csv: 'hours,score\n1,2\n2,4\n3,5\n4,8\n5,9\n6,12\n7,NA\n,10\n',
  permission: 'Author-created synthetic records for isolated interface checks; no real people.',
});
await writeFile(path.join(dir, 'project.json'), JSON.stringify(fixture));
const app = await createApp({ dataDir: dir });
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.address().port}`;
const browser = await chromium.launch({ headless: true });
const output = `docs/images/interface-${before ? 'before' : 'after'}`;
await mkdir(output, { recursive: true });
const metrics = [],
  errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  async function inspect(name, screenshot = false) {
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const visible = (n) =>
        n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        heading: getComputedStyle(document.querySelector('h1')).fontSize,
        small:
          document.querySelector('.small') &&
          getComputedStyle(document.querySelector('.small')).fontSize,
        undersizedButtons: [...document.querySelectorAll('button,.button')]
          .filter(visible)
          .filter((n) => n.getBoundingClientRect().height < 43)
          .map((n) => n.textContent.trim()),
        unlabeled: [...document.querySelectorAll('input,textarea,select')]
          .filter(visible)
          .filter(
            (n) =>
              !n.labels?.length &&
              !n.getAttribute('aria-label') &&
              !n.getAttribute('aria-labelledby'),
          )
          .map((n) => n.id),
        logo: (document.querySelector('.brand-logo')?.naturalWidth || 0) > 0,
      };
    });
    metrics.push({ name, ...m });
    if (!before) {
      assert.equal(m.overflow, false, `${name}: page overflow at ${m.width}`);
      assert.deepEqual(m.unlabeled, [], `${name}: unlabeled controls`);
      assert.deepEqual(m.undersizedButtons, [], `${name}: small button targets`);
      assert.equal(m.logo, true);
    }
    if (screenshot) await page.screenshot({ path: `${output}/${name}-${m.width}.png` });
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.locator('.workflow-sequence').waitFor();
    await inspect('guide', width === 1440 || width === 390);
    await openTask(page, 'workspace');
    await inspect('editor', width === 1440 || width === 390);
    for (const [i, label] of [
      'question',
      'literature',
      'design',
      'data',
      'analysis',
      'interpretation',
      'writing',
    ].entries()) {
      await page.locator('.stage-nav .stage-button').nth(i).click();
      await inspect(label);
    }
    for (const id of [
      'guide',
      'sources',
      'literature',
      'claims',
      'execution',
      'discovery',
      'consistency',
      'review',
      'activity',
    ]) {
      await openTask(page, id);
      await inspect(`materials-${id}`);
    }
    for (const [name, label] of [
      ['projects', 'Open project'],
      ['new', 'New project'],
      ['export', 'Export project'],
      ['import', 'Import project'],
      ['settings', 'LLM settings'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      if (name === 'settings') await page.getByLabel('Provider', { exact: true }).waitFor();
      await inspect(name, width === 1440 && ['projects', 'settings'].includes(name));
    }
    for (const kind of ['education', 'business']) {
      await page.goto(`${base}/demo${kind === 'business' ? '?case=business' : ''}`);
      await page
        .getByRole('button', { name: 'Start the seven-step walkthrough', exact: true })
        .waitFor();
      await inspect(`demo-${kind}`, width === 1440);
      await page
        .getByRole('button', { name: 'Start the seven-step walkthrough', exact: true })
        .click();
      await page.getByRole('button', { name: 'Show full step', exact: true }).click();
      await inspect(`demo-${kind}-step`);
      await page.getByRole('button', { name: 'Restart walkthrough', exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto(base);
  await page.locator('.workflow-sequence').waitFor();
  await page.evaluate(() =>
    document.documentElement.style.setProperty('font-size', '200%', 'important'),
  );
  await inspect('text-200-percent');
  if (!before) {
    await page.goto(base);
    await page.locator('.workflow-sequence').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () =>
          document.fonts.check('16px "Source Sans 3"') && document.fonts.check('32px "Newsreader"'),
      ),
      true,
    );
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip').evaluate((n) => n === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main').evaluate((n) => n === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.querySelector('.button')).transitionDuration,
      ),
      '0s',
    );
    await page.setViewportSize({ width: 1280, height: 600 });
    const sidebar = await page
      .locator('.sidebar')
      .evaluate((n) => ({ height: n.clientHeight, overflow: getComputedStyle(n).overflowY }));
    assert.equal(sidebar.height, 600);
    assert.equal(sidebar.overflow, 'auto');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.querySelector('.step-project-title strong').textContent = 'A'.repeat(160);
      document.querySelector('.mode').textContent = 'API model: ' + 'long-model-name-'.repeat(12);
    });
    await inspect('long-title-and-model');
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
  console.log(
    `${metrics.length} interface states checked at five widths plus 200% text; ${before ? 'baseline recorded' : 'no page overflow, undersized buttons or unlabeled fields'}.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => app.close(r));
  await rm(dir, { recursive: true, force: true });
}
