import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reviewConsistency, appendConsistency, consistencyIsCurrent } from '../lib/consistency.mjs';
import { createProject, applyAction, exportMarkdown } from '../lib/workflow.mjs';
import { createApp } from '../server.mjs';
import { consistencyFixture, consistencyReply } from '../scripts/consistency-fixture.mjs';
async function model(t) {
  const state = { reply: consistencyReply(), calls: [], gate: null };
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    state.calls.push(JSON.parse(body));
    if (state.gate) await state.gate;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(state.reply) } }] }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  return {
    state,
    config: {
      provider: 'openai-compatible',
      model: 'mock',
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      tokenParameter: 'max_tokens',
    },
  };
}
test('consistency report binds findings to exact saved text and becomes stale after relevant edits', async (t) => {
  const { state, config } = await model(t);
  let p = consistencyFixture();
  const report = await reviewConsistency(p, config);
  assert.equal(report.findings.length, 2);
  assert.deepEqual(report.missing, []);
  assert.equal(state.calls.length, 1);
  assert.equal(JSON.parse(state.calls[0].messages[1].content).milestones.length, 7);
  p = appendConsistency(p, report);
  assert.equal(consistencyIsCurrent(p, report), true);
  const action = {
    type: 'consistency_decision',
    revision: p.revision,
    reportId: report.id,
    findingId: 'F1',
    name: 'Researcher',
    decision: 'agree',
    note: 'The observational design cannot justify a causal conclusion. I will revise this claim.',
  };
  p = applyAction(p, action);
  assert.equal(consistencyIsCurrent(p, report), true);
  assert.equal(p.milestones[0].status, 'draft');
  assert.match(exportMarkdown(p), /Researcher/);
  p = applyAction(p, {
    type: 'save',
    revision: p.revision,
    stageId: 'interpretation',
    artifact: 'This observational study did not establish a clear positive association.',
    explanation: '',
  });
  assert.equal(consistencyIsCurrent(p, report), false);
  assert.throws(() => applyAction(p, { ...action, revision: p.revision }), /outdated/);
  assert.match(exportMarkdown(p), /outdated/);
  assert.equal(p.consistencyReports[0].findings[0].decisions.length, 1);
});
test('invented quotes, invalid stages, and one-sided mismatch citations are rejected', async (t) => {
  const { state, config } = await model(t);
  const p = consistencyFixture();
  state.reply.findings[0].references[0].quote = 'An invented sentence about randomization.';
  await assert.rejects(reviewConsistency(p, config), /quotation did not match/);
  state.reply = consistencyReply();
  state.reply.findings[0].references[0].stageId = 'unknown';
  await assert.rejects(reviewConsistency(p, config), /quotation did not match/);
  state.reply = consistencyReply();
  state.reply.findings[0].references = [state.reply.findings[0].references[0]];
  await assert.rejects(reviewConsistency(p, config), /two different/);
  state.reply = { summary: 'No issue identified in the available text.', findings: [] };
  p.milestones.find((m) => m.id === 'analysis').artifact = '';
  p.milestones.find((m) => m.id === 'interpretation').artifact = '';
  const report = await reviewConsistency(p, config);
  assert.deepEqual(report.missing, ['analysis', 'interpretation']);
  assert.equal(report.findings.length, 0);
  await assert.rejects(reviewConsistency(createProject(), config), /at least two/);
  await assert.rejects(reviewConsistency(p, { provider: 'demo' }), /Connect/);
});
test('consistency endpoint enforces revisions, blocks concurrent edits, and persists review history', async (t) => {
  const { state, config } = await model(t);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-consistency-'));
  await writeFile(path.join(dir, 'project.json'), JSON.stringify(consistencyFixture()));
  let app = await createApp({ dataDir: dir, llmSettings: config });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const post = (route, body) =>
    fetch(`http://127.0.0.1:${app.address().port}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await post('/api/consistency', { revision: 0, settingsRevision: 1 })).status, 409);
  assert.equal(state.calls.length, 0);
  let release;
  state.gate = new Promise((r) => {
    release = r;
  });
  const pending = post('/api/consistency', { revision: 0, settingsRevision: 0 });
  // Wait for an observable provider request, without relying on a fixed scheduling delay.
  for (let i = 0; i < 100 && !state.calls.length; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(state.calls.length, 1);
  try {
    assert.equal(
      (
        await post('/api/action', {
          type: 'save',
          revision: 0,
          stageId: 'question',
          artifact: 'changed',
          explanation: '',
        })
      ).status,
      409,
    );
    assert.equal((await post('/api/settings', { revision: 0, provider: 'demo' })).status, 409);
  } finally {
    release();
  }
  assert.equal((await pending).status, 200);
  state.gate = null;
  state.reply = { invalid: true };
  assert.equal((await post('/api/consistency', { revision: 1, settingsRevision: 0 })).status, 502);
  await new Promise((r) => app.close(r));
  app = await createApp({ dataDir: dir });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const p = (await (await fetch(`http://127.0.0.1:${app.address().port}/api/project`)).json())
    .project;
  assert.equal(p.revision, 1);
  assert.equal(p.consistencyReports.length, 1);
  assert.equal(
    p.consistencyReports[0].snapshot.find((s) => s.id === 'question').artifact,
    consistencyFixture().milestones[0].artifact,
  );
});
