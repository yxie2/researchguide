import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runGuide } from '../lib/guide.mjs';
import { createProject } from '../lib/workflow.mjs';

test('Ollama adapter makes three sequential role calls and passes critique to coordinator', async (t) => {
  const calls = [];
  const app = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    calls.push(data);
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message: { content: `Mock response ${calls.length}: explain the limitation.` },
      }),
    );
  });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => app.close(r)));
  const p = createProject('Study', 'What is the association?');
  const run = await runGuide(p, 'question', 'Help me narrow this', {
    model: 'test-model',
    url: `http://127.0.0.1:${app.address().port}`,
  });
  assert.equal(run.mode, 'ollama');
  assert.equal(run.model, 'test-model');
  assert.equal(calls.length, 3);
  assert.match(calls[0].messages[0].content, /Methods mentor/);
  assert.match(calls[1].messages[0].content, /critical reviewer/);
  assert.match(calls[2].messages[0].content, /coordinator/);
  assert.match(calls[2].messages[1].content, /Mock response 2/);
  assert.equal(calls[0].stream, false);
  assert.equal(run.trace.length, 4);
});
test('provider failure does not silently fall back to simulated guidance', async (t) => {
  const app = http.createServer((req, res) => {
    res.writeHead(503);
    res.end();
  });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => app.close(r)));
  await assert.rejects(
    runGuide(createProject(), 'question', '', {
      model: 'missing',
      url: `http://127.0.0.1:${app.address().port}`,
    }),
    /HTTP 503/,
  );
});
