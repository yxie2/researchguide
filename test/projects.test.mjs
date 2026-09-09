import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
import { createProject } from '../lib/workflow.mjs';
import { parseBackup, savedProjects, trashProject } from '../lib/projects.mjs';

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

test('project management renames, deletes all listed revisions and protects demos', async (t) => {
  const { get, post, dataDir } = await setup(t);
  let p = (await get('/api/project')).project;
  const firstId = p.id;
  const manage = (action, target, extra = {}) =>
    post(`/api/projects/${action}`, {
      id: target.id,
      revision: p.revision,
      targetRevision: target.revision,
      ...extra,
    });
  let response = await manage('rename', p, { title: 'Renamed study' });
  assert.equal(response.status, 200);
  p = (await response.json()).project;
  assert.equal(p.title, 'Renamed study');
  const first = structuredClone(p);
  p = (await (await post('/api/new', { title: 'Keep this study', revision: p.revision })).json())
    .project;
  response = await manage('rename', first, { title: 'Archived study renamed' });
  assert.equal(response.status, 200);
  let list = (await response.json()).projects;
  let archived = list.find((s) => s.id === firstId);
  assert.equal(archived.title, 'Archived study renamed');
  assert.equal((await manage('delete', first, { confirmTitle: first.title })).status, 409);
  assert.equal((await manage('delete', archived, { confirmTitle: 'wrong title' })).status, 400);
  assert.equal((await manage('delete', archived, { confirmTitle: archived.title })).status, 200);
  assert.ok(!(await get('/api/projects')).projects.some((s) => s.id === firstId));
  assert.equal(
    (await post('/api/projects/open', { id: firstId, revision: p.revision })).status,
    404,
  );
  const recovery = JSON.parse(
    await readFile(path.join(dataDir, 'trash', firstId, 'project.json'), 'utf8'),
  );
  assert.equal(recovery.title, archived.title);
  const oldId = p.id,
    oldRevision = p.revision;
  response = await manage('delete', p, { confirmTitle: p.title });
  assert.equal(response.status, 200);
  p = (await response.json()).project;
  assert.notEqual(p.id, oldId);
  assert.ok(p.revision > oldRevision);
  assert.equal((await get('/api/projects')).projects.length, 1);
  assert.equal(
    (
      await post('/api/action', {
        type: 'save',
        revision: oldRevision,
        stageId: 'question',
        artifact: 'stale',
      })
    ).status,
    409,
  );
  for (const id of ['maya-first-study', 'alex-business-study']) {
    assert.equal((await post('/api/projects/delete', { id, revision: p.revision })).status, 403);
    assert.equal(
      (await post('/api/projects/rename', { id, revision: p.revision, title: 'Wrong' })).status,
      403,
    );
  }
  // Surviving historical archives do not resurrect deleted projects after rereading disk.
  const disk = JSON.parse(await readFile(path.join(dataDir, 'project.json'), 'utf8'));
  assert.deepEqual([...(await savedProjects(dataDir, disk)).keys()], [p.id]);
});

test('protected demo flag is enforced and startup recovers an interrupted active deletion', async (t) => {
  const demo = { ...createProject('Protected example'), isDemo: true };
  const { get, post } = await setup(t, demo);
  for (const action of ['rename', 'delete'])
    assert.equal(
      (
        await post(`/api/projects/${action}`, {
          id: demo.id,
          revision: demo.revision,
          targetRevision: demo.revision,
          title: 'Changed',
          confirmTitle: demo.title,
        })
      ).status,
      403,
    );
  assert.equal((await get('/api/projects')).projects[0].protected, true);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-deleted-startup-'));
  const deleted = createProject('Deleted before process stopped');
  await writeFile(path.join(dataDir, 'project.json'), JSON.stringify(deleted));
  await trashProject(dataDir, deleted);
  const recovered = await createApp({ dataDir });
  await new Promise((r) => recovered.listen(0, '127.0.0.1', r));
  try {
    const current = (
      await (await fetch(`http://127.0.0.1:${recovered.address().port}/api/project`)).json()
    ).project;
    assert.notEqual(current.id, deleted.id);
    assert.ok(current.revision > deleted.revision);
  } finally {
    await new Promise((r) => recovered.close(r));
    const resolved = path.resolve(dataDir);
    if (
      !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('researchguide-deleted-startup-')
    )
      throw Error('Unexpected cleanup path');
    await rm(resolved, { recursive: true, force: true });
  }
});

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
