import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-project-ui-'));
const app = await createApp({ dataDir });
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Your workspace', exact: true }).click();
  await page.getByLabel('Research brief').fill('A synthetic saved question for project switching.');
  await page.getByRole('button', { name: 'Save your work', exact: true }).click();
  await page.getByText('Saved on this computer', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download project backup (.json)', exact: true }).click();
  const download = await downloaded;
  const backup = await readFile(await download.path());
  assert.equal(JSON.parse(backup).backupVersion, 1);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Second synthetic project');
  await page.getByRole('button', { name: 'Create research notebook' }).click();
  await page.getByText('Your research notebook is ready.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('button', { name: 'Open My first research project', exact: true }).click();
  await page.getByRole('button', { name: 'Your workspace', exact: true }).click();
  assert.equal(
    await page.getByLabel('Research brief').inputValue(),
    'A synthetic saved question for project switching.',
  );
  await page.getByLabel('Research brief').fill('Unsaved changes should be protected.');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Open Second synthetic project', exact: true }).click();
  await page.getByRole('button', { name: 'Back to current project', exact: true }).click();
  assert.equal(
    await page.getByLabel('Research brief').inputValue(),
    'Unsaved changes should be protected.',
  );
  await page.getByRole('button', { name: 'Save your work', exact: true }).click();
  await page.getByText('Saved on this computer', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Import project', exact: true }).click();
  await page
    .getByLabel('Project backup file')
    .setInputFiles({
      name: 'wrong.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"run":{}}'),
    });
  await page.getByRole('status').filter({ hasText: 'not project backups' }).waitFor();
  await page
    .getByLabel('Project backup file')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await page.getByRole('button', { name: 'Import and open project', exact: true }).click();
  await page.getByText('Backup imported as a separate project.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Your workspace', exact: true }).click();
  assert.equal(
    await page.getByLabel('Research brief').inputValue(),
    'A synthetic saved question for project switching.',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await page.locator('.saved-project').nth(2).waitFor();
  assert.equal(await page.locator('.saved-project').count(), 3);
  await page.screenshot({ path: 'docs/images/projects.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(
    'Project browser smoke passed: backup download, new/open/import, unsaved-edit protection, invalid-file feedback, three preserved projects, reload and mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await rm(dataDir, { recursive: true, force: true });
}
