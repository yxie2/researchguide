import { openTask } from './workflow-ui.mjs';
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
        {
          message: {
            content: calls.at(-1).body.messages[0].content.includes('actively guiding')
              ? JSON.stringify({
                  reply: 'We can work with the information you have.',
                  question: 'Does this draft reflect your intended population?',
                  gaps: ['Dataset access remains undecided'],
                  draft:
                    'Research question: Describe the distribution of course grades in an available undergraduate cohort. AI use is not measured, so no inference about AI effects is possible. Confirm dataset access before analysis.',
                })
              : 'Mock guidance: explain the limitation.',
          },
          finish_reason: 'stop',
        },
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
  await openTask(page, 'guide');
  await page.getByRole('button', { name: /Ask the research team/ }).click();
  await page.getByText('Guidance saved in your project history.', { exact: true }).waitFor();
  assert.equal(calls.length, 4);
  await openTask(page, 'conversation');
  await page.getByRole('button', { name: 'Start guiding me', exact: true }).click();
  await page.getByText('Your guide has responded.', { exact: true }).waitFor();
  await page
    .locator('#conversation-answer')
    .fill('I have undergraduate grades but no AI-use measure.');
  await page.getByRole('button', { name: 'Continue conversation', exact: true }).click();
  await page.getByText('Your guide has responded.', { exact: true }).waitFor();
  assert.equal(JSON.parse(calls.at(-1).body.messages[1].content).conversation.length, 1);
  await page.getByRole('button', { name: 'Accept draft into notebook', exact: true }).click();
  await page
    .getByText('Draft saved. Continue to Write and explain your decisions, then request review.', {
      exact: true,
    })
    .waitFor();
  await openTask(page, 'workspace');
  assert.match(await page.locator('#artifact').inputValue(), /AI use is not measured/);
  await page.reload();
  await page
    .getByText('Does this draft reflect your intended population?', { exact: true })
    .first()
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'docs/images/conversation.png', fullPage: true });
  await page.getByRole('button', { name: '02 Literature & question' }).click();
  await page.getByText('What carries forward into this step', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Continue from earlier work', exact: true }).click();
  await page.getByText('Your guide has responded.', { exact: true }).waitFor();
  const handoff = JSON.parse(calls.at(-1).body.messages[1].content);
  assert.match(handoff.currentResearchBrief, /AI use is not measured/);
  assert.equal(handoff.previousMilestones[0].recentConversation.length, 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

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
