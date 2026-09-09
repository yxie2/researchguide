import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
import { openTask } from './workflow-ui.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-manage-ui-'));
const app = await createApp({ dataDir: dir });
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.address().port}`;
let browser;
try {
  let p = (await (await fetch(base + '/api/project')).json()).project;
  const firstId = p.id;
  p = (
    await (
      await fetch(base + '/api/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: p.revision, title: 'Second study' }),
      })
    ).json()
  ).project;
  const secondId = p.id;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await openTask(page, 'workspace');
  await page
    .locator('#artifact')
    .fill('Unsaved synthetic working notes to preserve through a rename.');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  const row = (id) => page.locator(`[data-project-id="${id}"]`);
  await row(secondId).getByRole('button', { name: 'Edit title', exact: true }).click();
  await row(secondId).getByLabel('Project title').fill('Current study renamed');
  await row(secondId).getByRole('button', { name: 'Save title', exact: true }).click();
  await row(secondId)
    .getByRole('heading', { name: 'Current study renamed', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Back to current project', exact: true }).click();
  assert.match(await page.locator('#artifact').inputValue(), /Unsaved synthetic/);
  assert.match(await page.locator('.step-project-title').innerText(), /Current study renamed/);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await row(firstId).getByRole('button', { name: 'Edit title', exact: true }).click();
  await row(firstId).getByLabel('Project title').fill('Archived study renamed');
  await row(firstId).getByRole('button', { name: 'Save title', exact: true }).click();
  await row(firstId)
    .getByRole('heading', { name: 'Archived study renamed', exact: true })
    .waitFor();
  assert.equal(await page.locator('.demo-project').count(), 2);
  assert.equal(await page.locator('.demo-project button').count(), 0);
  page.once('dialog', (d) => d.dismiss());
  await row(firstId).getByRole('button', { name: 'Delete project', exact: true }).click();
  assert.equal(await row(firstId).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  page.once('dialog', (d) => {
    assert.match(d.message(), /Unsaved edits/);
    return d.accept();
  });
  await row(secondId).getByRole('button', { name: 'Delete project', exact: true }).click();
  await page
    .getByText('Project deleted from the list. A recovery copy is kept in local Trash.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await row(secondId).count(), 0);
  await row(firstId).getByRole('button', { name: 'Currently open', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  assert.equal(await row(secondId).count(), 0);
  page.once('dialog', (d) => d.accept());
  await row(firstId).getByRole('button', { name: 'Delete project', exact: true }).click();
  await page
    .getByText('Project deleted from the list. A recovery copy is kept in local Trash.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await row(firstId).count(), 0);
  assert.equal(await page.locator('.saved-project:not(.demo-project)').count(), 1);
  assert.equal(await page.locator('.demo-project').count(), 2);
  assert.deepEqual(errors, []);
  console.log(
    'Project management browser check passed: active and archived title editing, unsaved-draft preservation, deletion cancellation, active deletion and fallback, reload, protected demos, mobile.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  const resolved = path.resolve(dir);
  if (
    !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(resolved).startsWith('researchguide-manage-ui-')
  )
    throw Error('Unexpected cleanup path');
  await rm(resolved, { recursive: true, force: true });
}
