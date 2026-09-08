import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { normalizeSettings, publicSettings, settingsFromEnv, callModel } from '../lib/llm.mjs';
import { runGuide } from '../lib/guide.mjs';
import { createProject } from '../lib/workflow.mjs';
const config = {
  provider: 'openai-compatible',
  model: 'test-model',
  baseUrl: 'https://example.com/v1',
  apiKey: 'fake-test-key',
};
test('settings validate endpoints and never transfer saved credentials', () => {
  const saved = normalizeSettings(config);
  assert.equal(normalizeSettings({ ...config, apiKey: '' }, saved).apiKey, config.apiKey);
  assert.equal(
    normalizeSettings({ ...config, apiKey: '', baseUrl: 'https://other.example/v1' }, saved).apiKey,
    '',
  );
  assert.equal(normalizeSettings({ ...config, apiKey: '', clearApiKey: true }, saved).apiKey, '');
  assert.equal(normalizeSettings({ provider: 'demo' }, saved).apiKey, '');
  assert.equal(publicSettings(saved, 1).apiKey, undefined);
  for (const baseUrl of [
    'http://remote.example',
    'https://user:pass@example.com',
    'https://example.com?key=secret',
    'https://example.com/v1/chat/completions',
  ])
    assert.throws(() => normalizeSettings({ ...config, baseUrl }));
  assert.throws(() => normalizeSettings({ ...config, model: '' }));
  assert.throws(() => normalizeSettings({ ...config, maxOutputTokens: 0 }));
  assert.equal(settingsFromEnv({ OLLAMA_MODEL: 'legacy' }).provider, 'ollama');
  assert.equal(
    settingsFromEnv({ LLM_PROVIDER: 'openai-compatible', LLM_MODEL: 'test', LLM_API_KEY: 'fake' })
      .apiKey,
    'fake',
  );
});
async function endpoint(t, handler) {
  const app = http.createServer(handler);
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => app.close(r)));
  return `http://127.0.0.1:${app.address().port}`;
}
test('compatible API authenticates three role calls without embedding the key in context or trace', async (t) => {
  const calls = [];
  const baseUrl = await endpoint(t, async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [{ message: { content: `Response ${calls.length}` }, finish_reason: 'stop' }],
      }),
    );
  });
  const run = await runGuide(createProject(), 'question', 'Help', {
    ...normalizeSettings(config),
    baseUrl: baseUrl + '/v1',
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, '/v1/chat/completions');
  assert.equal(calls[0].auth, 'Bearer fake-test-key');
  assert.equal(calls[0].body.max_completion_tokens, 4096);
  assert.match(calls[2].body.messages[1].content, /Response 2/);
  assert.equal(JSON.stringify(calls.map((c) => c.body)).includes(config.apiKey), false);
  assert.equal(JSON.stringify(run).includes(config.apiKey), false);
  await callModel('test', 'OK', {
    ...config,
    baseUrl,
    tokenParameter: 'max_tokens',
    maxOutputTokens: 512,
  });
  assert.equal(calls[3].body.max_tokens, 512);
  assert.equal(calls[3].body.max_completion_tokens, undefined);
});
test('provider errors are sanitized and incomplete output is rejected', async (t) => {
  let status = 401,
    output = 'fake-test-key';
  const baseUrl = await endpoint(t, (req, res) => {
    res.writeHead(status);
    res.end(output);
  });
  await assert.rejects(
    callModel('a', 'b', { ...config, baseUrl }),
    (e) => /401/.test(e.message) && !e.message.includes(config.apiKey),
  );
  status = 200;
  output = JSON.stringify({
    choices: [{ message: { content: 'partial' }, finish_reason: 'length' }],
  });
  await assert.rejects(callModel('a', 'b', { ...config, baseUrl }), /output limit/);
  output = '{}';
  await assert.rejects(callModel('a', 'b', { ...config, baseUrl }), /no text/);
  output = 'invalid';
  await assert.rejects(callModel('a', 'b', { ...config, baseUrl }), /invalid JSON/);
  status = 302;
  await assert.rejects(callModel('a', 'b', { ...config, baseUrl }), /Redirects are not followed/);
});
