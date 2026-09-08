import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  applyAction,
  readiness,
  stages,
  unlocked,
  appendGuide,
  exportMarkdown,
} from '../lib/workflow.mjs';
import { runGuide } from '../lib/guide.mjs';

const artifact =
  'A study of the relationship between feedback frequency and scores among first-year students. This is an observational study using a public dataset; the design does not establish causation.';
const explanation =
  'These data include the variables and population in my question, but selection and prior attainment could confound the relationship, so I will describe associations.';
function act(p, a) {
  return applyAction(p, { ...a, revision: p.revision });
}
function save(p, id = 'question') {
  return act(p, { type: 'save', stageId: id, artifact, explanation });
}
function approve(p, id = 'question') {
  p = act(p, { type: 'submit', stageId: id });
  return act(p, {
    type: 'review',
    stageId: id,
    reviewer: 'Demo supervisor',
    note: 'Reviewed the limitations and the student explanation in this local demonstration.',
    decision: 'approve',
  });
}

test('initial project opens question only and does not imply completion', () => {
  const p = createProject();
  assert.equal(p.milestones.length, 7);
  assert.equal(unlocked(p, 'question'), true);
  assert.equal(unlocked(p, 'design'), false);
  assert.equal(readiness(p, 'question').length, 2);
});
test('a student cannot skip reviews or approve an unsubmitted artifact', () => {
  let p = save(createProject());
  assert.throws(() => act(p, { type: 'submit', stageId: 'design' }), /preceding/);
  assert.throws(
    () =>
      act(p, {
        type: 'review',
        stageId: 'question',
        decision: 'approve',
        reviewer: 'X',
        note: explanation,
      }),
    /Submit/,
  );
  p = approve(p);
  assert.equal(unlocked(p, 'evidence'), true);
  assert.equal(p.milestones[0].reviews[0].authenticated, false);
});
test('explanation is required even when an artifact is complete', () => {
  const p = act(createProject(), { type: 'save', stageId: 'question', artifact, explanation: '' });
  assert.throws(() => act(p, { type: 'submit', stageId: 'question' }), /own words/);
});
test('saving changes preserves history and invalidates downstream approvals', () => {
  let p = approve(save(createProject()));
  p = act(p, {
    type: 'source',
    title: 'Example',
    url: 'https://example.org/paper',
    location: 'Results',
    passage: 'This is a user-provided example passage, not verified research evidence.',
  });
  p = approve(save(p, 'evidence'), 'evidence');
  assert.equal(unlocked(p, 'design'), true);
  p = act(p, {
    type: 'save',
    stageId: 'question',
    artifact: `${artifact} Updated outcome definition.`,
    explanation,
  });
  assert.equal(p.milestones[0].status, 'needs_revision');
  assert.equal(p.milestones[1].status, 'needs_revision');
  assert.equal(unlocked(p, 'design'), false);
  assert.equal(p.milestones[0].history.at(-1).artifact, artifact);
  assert.equal(p.milestones[1].reviews.length, 1);
});
test('saving identical text leaves approvals intact', () => {
  let p = approve(save(createProject()));
  p = save(p);
  assert.equal(p.milestones[0].status, 'approved');
  assert.equal(p.milestones[0].version, 1);
});
test('stale edits are rejected without mutating the original project', () => {
  const p = createProject(),
    before = JSON.stringify(p);
  assert.throws(() => applyAction(p, { type: 'save', revision: -1 }), /another tab/);
  assert.equal(JSON.stringify(p), before);
});
test('source URLs cannot execute scripts or include credentials', () => {
  const p = createProject();
  for (const url of ['javascript:alert(1)', 'https://name:secret@example.org', 'file:///secret'])
    assert.throws(
      () => act(p, { type: 'source', title: 'T', url, location: 'P1', passage: artifact }),
      /http/,
    );
});
test('evidence requires an inspected source record', () => {
  const p = save(approve(save(createProject())), 'evidence');
  assert.throws(() => act(p, { type: 'submit', stageId: 'evidence' }), /source/);
});
test('revision request keeps next milestone closed', () => {
  let p = save(createProject());
  p = act(p, { type: 'submit', stageId: 'question' });
  p = act(p, {
    type: 'review',
    stageId: 'question',
    decision: 'revise',
    reviewer: 'Supervisor',
    note: 'Please clarify your available data and the population.',
  });
  assert.equal(p.milestones[0].status, 'needs_revision');
  assert.equal(unlocked(p, 'evidence'), false);
});
test('all seven milestones can be completed with human decisions', () => {
  let p = createProject();
  p = act(p, {
    type: 'source',
    title: 'Example',
    url: 'https://example.org',
    location: 'P1',
    passage: artifact,
  });
  for (const s of stages) p = approve(save(p, s.id), s.id);
  assert.equal(p.milestones.filter((s) => s.status === 'approved').length, 7);
  const exported = exportMarkdown(p);
  assert.match(exported, /Student explanation/);
  assert.match(exported, /not authenticated/);
  assert.match(exported, /Activity log/);
});
test('demo guide records a real deterministic sequence without approving work', async () => {
  const p = save(createProject()),
    run = await runGuide(p, 'question', 'Help me');
  assert.equal(run.mode, 'demo');
  assert.equal(run.trace.length, 4);
  const next = appendGuide(p, 'question', run);
  assert.equal(next.milestones[0].status, p.milestones[0].status);
  assert.equal(next.milestones[0].guideRuns[0].artifactVersion, 1);
  assert.match(run.trace.at(-1).output, /not answered by a language model/);
});
