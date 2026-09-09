import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
import { createProject } from '../lib/workflow.mjs';
import { parseBackup } from '../lib/projects.mjs';

async function setup(t, initial) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-projects-'));
  if (initial) await writeFile(path.join(dataDir, 'project.json'), JSON.stringify(initial));
  const app = await createApp({ dataDir });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => {
    await new Promise((r) => app.close(r));
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    dataDir,
    get: async (route) => (await fetch(base + route)).json(),
    post: (route, data) =>
      fetch(base + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  };
}

test('saved projects reopen latest work, retain the other project, and reject stale-tab edits', async (t) => {
  const { get, post } = await setup(t);
  let p = (await get('/api/project')).project;
  const originalId = p.id;
  p = (
    await (
      await post('/api/action', {
        type: 'save',
        revision: p.revision,
        stageId: 'question',
        artifact: 'Keep this saved question',
        explanation: 'Original reasoning',
      })
    ).json()
  ).project;
  const staleRevision = p.revision;
  p = (await (await post('/api/new', { title: 'Second project', revision: p.revision })).json())
    .project;
  const secondId = p.id;
  assert.ok(p.revision > staleRevision);
  assert.equal(
    (
      await post('/api/action', {
        type: 'save',
        stageId: 'question',
        revision: staleRevision,
        artifact: 'Wrong project',
      })
    ).status,
    409,
  );
  p = (await (await post('/api/projects/open', { id: originalId, revision: p.revision })).json())
    .project;
  assert.equal(p.milestones[0].artifact, 'Keep this saved question');
  p = (
    await (
      await post('/api/action', {
        type: 'save',
        revision: p.revision,
        stageId: 'question',
        artifact: 'Latest question',
        explanation: 'Updated reasoning',
      })
    ).json()
  ).project;
  p = (await (await post('/api/projects/open', { id: secondId, revision: p.revision })).json())
    .project;
  p = (await (await post('/api/projects/open', { id: originalId, revision: p.revision })).json())
    .project;
  assert.equal(p.milestones[0].artifact, 'Latest question');
  const list = (await get('/api/projects')).projects;
  assert.equal(list.length, 2);
  assert.equal(list.filter((p) => p.active).length, 1);
  assert.equal(
    (await post('/api/projects/open', { id: '../../project', revision: p.revision })).status,
    404,
  );
});

test('portable backup roundtrip retains PDF bytes and actual analysis while importing a separate copy', async (t) => {
  const p = createProject('Synthetic portable notebook');
  const demo = JSON.parse(
    await readFile(new URL('../public/business-demo-case.json', import.meta.url), 'utf8'),
  );
  p.datasets = [demo.computation.dataset];
  p.analysisPlans = [demo.computation.plan];
  p.analysisRuns = [demo.computation.run];
  const bytes = Buffer.from('%PDF-1.4\nSynthetic attachment fixture\n%%EOF');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  p.papers = [
    {
      id: 'paper-1',
      title: 'Synthetic fixture',
      sha256,
      pages: [{ number: 1, text: 'Synthetic extracted passage' }],
    },
  ];
  const { get, post, dataDir } = await setup(t, p);
  await mkdir(path.join(dataDir, 'papers'));
  await writeFile(path.join(dataDir, 'papers', `${sha256}.pdf`), bytes);
  const settings = await get('/api/settings');
  const backup = await get('/api/export?format=backup');
  assert.equal(backup.attachments.length, 1);
  assert.deepEqual(backup.missingAttachments, []);
  const imported = await post('/api/projects/import', { backup, revision: 0 });
  assert.equal(imported.status, 200);
  const copy = (await imported.json()).project;
  assert.notEqual(copy.id, p.id);
  assert.deepEqual(copy.analysisRuns, p.analysisRuns);
  assert.equal(copy.importedFromId, p.id);
  assert.deepEqual(await get('/api/settings'), settings);
  assert.deepEqual(await readFile(path.join(dataDir, 'papers', `${sha256}.pdf`)), bytes);
  assert.equal((await get('/api/projects')).projects.length, 2);
  const legacy = await post('/api/projects/import', { backup: p, revision: copy.revision });
  assert.equal(legacy.status, 200);
  assert.equal((await get('/api/projects')).projects.length, 3);
});

test('malformed backups and changed attachments fail without changing the active project', async (t) => {
  const { get, post } = await setup(t);
  const initial = (await get('/api/project')).project;
  const bad = structuredClone(initial);
  bad.sources = [
    { id: 'S1', title: 'bad', passage: 'text', location: 'page', url: 'javascript:alert(1)' },
  ];
  for (const backup of [
    { run: {} },
    { ...initial, milestones: [] },
    bad,
    { ...initial, analysisRuns: [{}] },
    {
      backupVersion: 1,
      project: initial,
      attachments: [{ sha256: 'a'.repeat(64), base64: 'JVBERi0=' }],
    },
  ]) {
    assert.equal(
      (await post('/api/projects/import', { revision: initial.revision, backup })).status,
      400,
    );
    assert.deepEqual((await get('/api/project')).project, initial);
  }
  assert.throws(
    () =>
      parseBackup(
        JSON.parse(JSON.stringify(initial).replace('"sources":[]', '"sources":[],"__proto__":{}')),
      ),
    /Invalid project backup/,
  );
});
