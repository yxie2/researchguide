import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

async function setup(t, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-test-'));
  const app = await createApp({ dataDir, ...options });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.close(r));
    await rm(dataDir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${app.address().port}`;
  const post = (route, data, headers = {}) =>
    fetch(`${url}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    });
  return { app, dataDir, url, post };
}
test('server persists saves and exports the project', async (t) => {
  const { url, post, dataDir } = await setup(t);
  const initial = await (await fetch(`${url}/api/project`)).json();
  assert.equal(initial.mode, 'demo');
  const result = await post('/api/action', {
    type: 'save',
    revision: 0,
    stageId: 'question',
    artifact: 'A saved question',
    explanation: 'My explanation',
  });
  assert.equal(result.status, 200);
  const { project } = await result.json();
  assert.equal(project.milestones[0].artifact, 'A saved question');
  const app2 = await createApp({ dataDir });
  await new Promise((r) => app2.listen(0, '127.0.0.1', r));
  const reread = await (await fetch(`http://127.0.0.1:${app2.address().port}/api/project`)).json();
  assert.equal(reread.project.revision, 1);
  await new Promise((r) => app2.close(r));
  const exported = await fetch(`${url}/api/export?format=md`);
  assert.match(await exported.text(), /A saved question/);
  const backup = await (await fetch(`${url}/api/export?format=json`)).json();
  assert.equal(backup.id, project.id);
});
test('rejects cross-origin, invalid content and stale mutations', async (t) => {
  const { post, url } = await setup(t);
  assert.equal(
    (await post('/api/action', {}, { Origin: 'https://untrusted.example' })).status,
    403,
  );
  assert.equal((await post('/api/action', { revision: -1, type: 'save' })).status, 409);
  assert.equal((await fetch(`${url}/api/action`, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(`${url}/data/project.json`)).status, 404);
  assert.equal((await fetch(`${url}/.env`)).status, 404);
});
test('new project archives the old project', async (t) => {
  const { post, dataDir } = await setup(t);
  const r = await post('/api/new', { title: 'New study', question: 'What matters?', revision: 0 });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).project.title, 'New study');
  assert.equal((await readdir(dataDir)).filter((n) => n.endsWith('.json')).length, 2);
});
test('guidance blocks concurrent edits and only persists on success', async (t) => {
  let finish, started;
  const entered = new Promise((r) => {
    started = r;
  });
  const pending = new Promise((r) => {
    finish = r;
  });
  const { post, url } = await setup(t, {
    guide: async () => {
      started();
      await pending;
      throw new Error('Deliberate provider failure');
    },
  });
  const run = post('/api/guide', { revision: 0, stageId: 'question', question: 'Help' });
  await entered;
  assert.equal(
    (
      await post('/api/action', {
        revision: 0,
        type: 'save',
        stageId: 'question',
        artifact: '',
        explanation: '',
      })
    ).status,
    409,
  );
  finish();
  assert.equal((await run).status, 500);
  const data = await (await fetch(`${url}/api/project`)).json();
  assert.equal(data.project.revision, 0);
  assert.equal(data.project.milestones[0].guideRuns.length, 0);
});
test('demo guidance endpoint returns a saved trace', async (t) => {
  const { post } = await setup(t);
  const response = await post('/api/guide', {
    revision: 0,
    stageId: 'question',
    question: 'Help me think',
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.run.trace.length, 4);
  assert.equal(data.project.revision, 1);
});
