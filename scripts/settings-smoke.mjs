import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-settings-'));
const calls = [];
const provider = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  calls.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      choices: [
        { message: { content: 'Mock guidance: explain the limitation.' }, finish_reason: 'stop' },
      ],
    }),
  );
});
const app = await createApp({ dataDir });
await new Promise((r) => provider.listen(0, '127.0.0.1', r));
await new Promise((r) => app.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.address().port}`);
  await page.getByRole('button', { name: 'LLM settings', exact: true }).click();
  await page.locator('#llm-provider').selectOption('openai-compatible');
  await page.locator('#base-url').fill(`http://127.0.0.1:${provider.address().port}/v1`);
  await page.locator('#model-name').fill('test-model');
  await page.locator('#api-key').fill('fake-browser-key');
  const save = async () => {
    await page.getByRole('button', { name: 'Save model settings', exact: true }).click();
    await page
      .getByText('Model settings saved. Your next guide run will use this provider.', {
        exact: true,
      })
      .waitFor();
  };
  await save();
  assert.equal(await page.locator('#api-key').inputValue(), '');
  await page.getByRole('button', { name: 'Test saved connection', exact: true }).click();
  await page
    .getByText(
      'Connection successful. The configured model returned text. No research project was sent.',
      { exact: true },
    )
    .waitFor();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.messages[1].content, 'Reply with OK.');
  assert.equal(calls[0].auth, 'Bearer fake-browser-key');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Settings fit mobile',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'docs/images/settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Research team', exact: true }).click();
  await page.getByRole('button', { name: /Ask the research team/ }).click();
  await page.getByText('Guidance saved in your project history.', { exact: true }).waitFor();
  assert.equal(calls.length, 4);
  await page.getByRole('button', { name: 'LLM settings', exact: true }).click();
  await page.locator('#llm-provider').selectOption('ollama');
  await page.locator('#model-name').fill('installed-model');
  await save();
  await page.reload();
  await page.getByRole('button', { name: 'LLM settings', exact: true }).click();
  assert.equal(await page.locator('#llm-provider').inputValue(), 'ollama');
  await page.locator('#llm-provider').selectOption('demo');
  await save();
  assert.deepEqual(errors, []);
  console.log(
    'Settings browser smoke passed: API configuration, masked key, connection test, three-call guidance, switching, restart display, mobile layout.',
  );
} finally {
  await browser?.close();
  await new Promise((r) => app.close(r));
  await new Promise((r) => provider.close(r));
  await rm(dataDir, { recursive: true, force: true });
}
