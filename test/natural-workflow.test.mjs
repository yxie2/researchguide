import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, applyAction, unlocked } from '../lib/workflow.mjs';
import { validateProject, projectSummary } from '../lib/projects.mjs';
import {
  workflowFor,
  milestoneFinished,
  requiresSupervisorReview,
} from '../public/workflow-flow.js';
const document =
  'This is a substantive synthetic stage document describing the research decisions, their scope and uncertainty. It is test content only and provides no actual research findings.';
const explanation =
  'These choices fit the synthetic research question, but the assumptions and limitations need careful checking by a supervisor.';
const act = (p, a) => applyAction(p, { ...a, revision: p.revision });
test('seven stages use five researcher completions and two supervisor checkpoints', () => {
  let p = createProject();
  p = act(p, {
    type: 'source',
    title: 'Synthetic source',
    url: 'https://example.org',
    location: 'p1',
    passage: document,
  });
  for (const m of [...p.milestones]) {
    const checkpoint = requiresSupervisorReview(m.id);
    assert.equal(
      workflowFor(m.id).some(([id]) => id === 'review'),
      checkpoint,
    );
    assert.equal(
      workflowFor(m.id).some(([id]) => id === 'guide'),
      false,
    );
    p = act(p, {
      type: 'save',
      stageId: m.id,
      artifact: document,
      explanation: checkpoint ? explanation : '',
    });
    if (checkpoint) {
      assert.throws(() => act(p, { type: 'complete', stageId: m.id }), /supervisor review/);
      p = act(p, { type: 'submit', stageId: m.id });
      p = act(p, {
        type: 'review',
        stageId: m.id,
        decision: 'approve',
        reviewer: 'Synthetic supervisor',
        note: explanation,
      });
    } else p = act(p, { type: 'complete', stageId: m.id });
  }
  assert.equal(p.milestones.filter((m) => m.status === 'completed').length, 5);
  assert.equal(p.milestones.filter((m) => m.status === 'approved').length, 2);
  assert.ok(p.milestones.every(milestoneFinished));
  validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(projectSummary(p).finished, 7);
  p = act(p, {
    type: 'save',
    stageId: 'evidence',
    artifact: document + ' Changed question.',
    explanation: '',
  });
  assert.equal(p.milestones[0].status, 'completed');
  assert.ok(p.milestones.slice(1).every((m) => m.status === 'needs_revision'));
  assert.equal(unlocked(p, 'data'), false);
});
test('completion retains source, preceding-stage, revision and checkpoint safeguards', () => {
  let p = createProject();
  assert.throws(() => act(p, { type: 'complete', stageId: 'question' }), /120/);
  p = act(p, { type: 'save', stageId: 'question', artifact: document, explanation: '' });
  p = act(p, { type: 'complete', stageId: 'question' });
  p = act(p, { type: 'save', stageId: 'evidence', artifact: document, explanation: '' });
  assert.throws(() => act(p, { type: 'complete', stageId: 'evidence' }), /source/);
  assert.throws(() => act(p, { type: 'complete', stageId: 'data' }), /preceding/);
  const bad = structuredClone(p);
  bad.milestones[2].status = 'completed';
  assert.throws(() => validateProject(bad), /checkpoint/);
  p = act(p, { type: 'save', stageId: 'question', artifact: document, explanation });
  p = act(p, { type: 'submit', stageId: 'question' });
  assert.throws(() => act(p, { type: 'complete', stageId: 'question' }), /pending/);
  p = act(p, {
    type: 'review',
    stageId: 'question',
    reviewer: 'Supervisor',
    decision: 'revise',
    note: explanation,
  });
  assert.throws(() => act(p, { type: 'complete', stageId: 'question' }), /requested revisions/);
});
