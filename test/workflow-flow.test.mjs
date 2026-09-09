import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../lib/workflow.mjs';
import { workflowFor, recommendTask } from '../public/workflow-flow.js';
test('stage-specific tasks embed evidence, analysis and review while retaining approval boundaries', () => {
  const p = createProject();
  assert.ok(workflowFor('evidence').some(([id]) => id === 'sources'));
  assert.ok(!workflowFor('question').some(([id]) => id === 'execution'));
  assert.ok(workflowFor('analysis').some(([id]) => id === 'execution'));
  assert.equal(workflowFor('writing').at(-1)[0], 'export');
  assert.equal(recommendTask(p, 'question', 'api').id, 'conversation');
  assert.equal(recommendTask(p, 'question', 'demo').id, 'workspace');
  p.milestones[0].status = 'awaiting_review';
  assert.equal(recommendTask(p, 'question', 'api').id, 'review');
  p.milestones[0].status = 'approved';
  assert.equal(recommendTask(p, 'question', 'api').id, 'continue');
  p.milestones[0].status = 'needs_revision';
  assert.equal(recommendTask(p, 'question', 'api').id, 'workspace');
});
test('suggestions distinguish unaccepted drafts, missing run evidence and stale checks', () => {
  const p = createProject(),
    m = p.milestones[4];
  m.artifact = 'Saved analysis record';
  m.explanation = 'My reasoning';
  m.conversation = [{ draft: 'Proposed record', artifactVersion: 0, accepted: false }];
  assert.equal(recommendTask(p, 'analysis', 'api').id, 'conversation');
  m.conversation[0].accepted = true;
  p.datasets = [{ id: 'D1' }];
  assert.equal(recommendTask(p, 'analysis', 'api').id, 'execution');
  p.analysisRuns = [
    {
      status: 'succeeded',
      contextVersions: ['question', 'evidence', 'design', 'data'].map((id) => ({ id, version: 0 })),
    },
  ];
  p.consistencyReports = [{ snapshot: [{ id: 'question', version: 99 }] }];
  assert.equal(recommendTask(p, 'analysis', 'api').id, 'consistency');
  assert.equal(m.status, 'draft');
});
