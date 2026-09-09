import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { samplePDF } from '../scripts/pdf-fixture.mjs';
import { extractPaper, assessClaim } from '../lib/evidence.mjs';
import { createApp } from '../server.mjs';
import { createProject, applyAction, exportMarkdown } from '../lib/workflow.mjs';
test('PDF extraction preserves page provenance and rejects non-PDF or textless files', async () => {
  const { paper } = await extractPaper({
    title: 'Synthetic study',
    pdf: samplePDF().toString('base64'),
  });
  assert.equal(paper.pages[0].number, 1);
  assert.match(paper.pages[0].text, /cannot establish causation/);
  assert.match(paper.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(
    extractPaper({ title: 'Invalid', pdf: Buffer.from('not a PDF').toString('base64') }),
    /valid PDF/,
  );
  await assert.rejects(
    extractPaper({ title: 'Empty', pdf: samplePDF('').toString('base64') }),
    /No usable text/,
  );
});
test('uploaded papers persist and exact passages, claim versions, and researcher decisions stay linked', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-evidence-'));
  let app = await createApp({ dataDir: dir });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const post = (route, data) =>
    fetch(`http://127.0.0.1:${app.address().port}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  let r = await post('/api/papers', {
    revision: 0,
    title: 'Synthetic study',
    pdf: samplePDF().toString('base64'),
  });
  assert.equal(r.status, 200);
  let { project } = await r.json();
  const paper = project.papers[0];
  r = await fetch(`http://127.0.0.1:${app.address().port}/api/papers/${paper.id}`);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), samplePDF());
  assert.equal(
    (
      await post('/api/action', {
        type: 'paper_passage',
        revision: 1,
        paperId: paper.id,
        page: 1,
        passage: 'This text is invented and not in the PDF',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post('/api/action', {
        type: 'paper_passage',
        revision: 1,
        paperId: paper.id,
        page: 2,
        passage: paper.pages[0].text,
      })
    ).status,
    400,
  );
  r = await post('/api/action', {
    type: 'paper_passage',
    revision: 1,
    paperId: paper.id,
    page: 1,
    passage: paper.pages[0].text,
  });
  assert.equal(r.status, 200);
  project = (await r.json()).project;
  assert.equal(project.sources[0].provenance, 'pdf-exact-match');
  r = await post('/api/action', {
    type: 'claim_save',
    revision: 2,
    claim: 'AI use causes better grades.',
    sourceIds: ['S1'],
  });
  assert.equal(r.status, 200);
  project = (await r.json()).project;
  const c = project.claims[0];
  c.assessments.push({
    id: 'assessment',
    claimVersion: 1,
    verdict: 'partial',
    rationale: 'Association is not causation.',
    sources: [{ sourceId: 'S1', relation: 'limits', reason: 'Observational design.' }],
    model: 'mock',
    confirmations: [],
  });
  assert.throws(
    () =>
      applyAction(project, {
        type: 'claim_confirm',
        revision: 3,
        claimId: c.id,
        assessmentId: 'assessment',
        name: 'Student',
        note: 'I inspected the passage and it does not establish causation.',
        decision: 'agree',
        inspected: false,
      }),
    /Inspect/,
  );
  let next = applyAction(project, {
    type: 'claim_confirm',
    revision: 3,
    claimId: c.id,
    assessmentId: 'assessment',
    name: 'Student',
    note: 'I inspected the passage and it does not establish causation.',
    decision: 'agree',
    inspected: true,
  });
  assert.match(exportMarkdown(next), /Local researcher decision/);
  next = applyAction(next, {
    type: 'claim_save',
    revision: 4,
    claimId: c.id,
    claim: 'AI use is associated with grades.',
    sourceIds: ['S1'],
  });
  assert.throws(
    () =>
      applyAction(next, {
        type: 'claim_confirm',
        revision: 5,
        claimId: c.id,
        assessmentId: 'assessment',
      }),
    /outdated/,
  );
  await new Promise((r) => app.close(r));
  app = await createApp({ dataDir: dir });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  project = (await (await fetch(`http://127.0.0.1:${app.address().port}/api/project`)).json())
    .project;
  assert.equal(project.papers[0].sha256, paper.sha256);
  assert.equal(project.claims[0].sourceIds[0], 'S1');
});
test('model assessment rejects invented citations and checks all attached passages', async (t) => {
  let fabricated = false;
  const calls = [];
  const provider = http.createServer(async (req, res) => {
    let body = '';
    for await (const b of req) body += b;
    calls.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: 'partial',
                rationale: 'The passages do not justify a causal claim.',
                suggestedClaim: 'AI use was associated with grades.',
                sources: [
                  {
                    sourceId: fabricated ? 'S999' : 'S1',
                    relation: 'limits',
                    reason: 'Observational study.',
                  },
                  {
                    sourceId: 'S2',
                    relation: 'contradicts',
                    reason: 'No association in another sample.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((r) => provider.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => provider.close(r)));
  const p = createProject();
  p.sources = [
    { id: 'S1', title: 'Study A', passage: 'An association was found.' },
    { id: 'S2', title: 'Study B', passage: 'No association was found.' },
  ];
  p.claims = [
    {
      id: 'C1',
      version: 1,
      claim: 'AI causes better grades.',
      sourceIds: ['S1', 'S2'],
      assessments: [],
    },
  ];
  const config = {
    provider: 'openai-compatible',
    model: 'mock',
    baseUrl: `http://127.0.0.1:${provider.address().port}`,
  };
  const a = await assessClaim(p, 'C1', config);
  assert.equal(a.verdict, 'partial');
  assert.equal(a.confirmations.length, 0);
  assert.equal(JSON.parse(calls[0].messages[1].content).sources.length, 2);
  fabricated = true;
  await assert.rejects(assessClaim(p, 'C1', config), /invalid assessment or source reference/);
});
