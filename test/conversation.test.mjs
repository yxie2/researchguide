import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { createProject, applyAction, milestone } from '../lib/workflow.mjs';
import { appendConversation } from '../lib/conversation.mjs';

test('conversation remembers answers, persists, and accepts a draft through normal review invalidation', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-chat-'));
  const calls = [];
  let malformed = false;
  const provider = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: malformed
                ? 'invalid'
                : JSON.stringify({
                    reply: 'Let us identify what you can measure.',
                    question: 'Do your records measure AI use?',
                    gaps: ['AI use measurement is unknown'],
                    draft:
                      calls.length > 1
                        ? 'Research question: Describe course grades in the available records. AI use is unmeasured; no conclusions about AI use can be drawn. Dataset permissions remain undecided.'
                        : null,
                  }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((r) => provider.listen(0, '127.0.0.1', r));
  const config = {
    provider: 'openai-compatible',
    model: 'mock',
    baseUrl: `http://127.0.0.1:${provider.address().port}`,
    apiKey: 'fake',
    tokenParameter: 'max_tokens',
  };
  let app = await createApp({ dataDir: dir, llmSettings: config });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => app.close(r));
    await new Promise((r) => provider.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const post = (route, data) =>
    fetch(`http://127.0.0.1:${app.address().port}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  assert.equal(
    (
      await post('/api/conversation', {
        stageId: 'question',
        question: 'Begin',
        revision: 0,
        settingsRevision: 99,
      })
    ).status,
    409,
  );
  assert.equal(calls.length, 0);
  let r = await post('/api/conversation', {
    stageId: 'question',
    question: 'I have grades',
    revision: 0,
    settingsRevision: 0,
  });
  assert.equal(r.status, 200);
  r = await post('/api/conversation', {
    stageId: 'question',
    question: 'AI use was not measured',
    revision: 1,
    settingsRevision: 0,
  });
  assert.equal(r.status, 200);
  let data = await r.json();
  assert.equal(JSON.parse(calls[1].messages[1].content).conversation[0].user, 'I have grades');
  assert.equal(data.project.milestones[0].artifact, '');
  r = await post('/api/action', {
    type: 'accept_draft',
    stageId: 'question',
    turnId: data.run.id,
    revision: 2,
  });
  assert.equal(r.status, 200);
  data = await r.json();
  assert.match(data.project.milestones[0].artifact, /AI use is unmeasured/);
  assert.equal(data.project.milestones[0].explanation, '');
  assert.notEqual(data.project.milestones[0].status, 'approved');
  r = await post('/api/conversation', {
    stageId: 'evidence',
    question: 'Continue from my research brief',
    revision: 3,
    settingsRevision: 0,
  });
  assert.equal(r.status, 200);
  const handoff = JSON.parse(calls.at(-1).messages[1].content);
  assert.match(handoff.currentResearchBrief, /AI use is unmeasured/);
  assert.equal(handoff.previousMilestones.length, 1);
  assert.equal(handoff.previousMilestones[0].recentConversation[1].user, 'AI use was not measured');
  assert.equal(handoff.previousMilestones[0].recentConversation[1].draftAccepted, true);
  assert.notEqual(handoff.previousMilestones[0].status, 'approved');
  assert.equal(handoff.conversation.length, 0);
  r = await post('/api/action', {
    type: 'save',
    stageId: 'evidence',
    revision: 4,
    artifact:
      'Literature synthesis and refined question: describe grade variation within one course; no claim about AI use.',
    explanation: 'Reading narrowed the initial direction to measurements actually available.',
  });
  assert.equal(r.status, 200);
  r = await post('/api/conversation', {
    stageId: 'design',
    question: 'Plan from the refined question',
    revision: 5,
    settingsRevision: 0,
  });
  assert.equal(r.status, 200);
  assert.match(
    JSON.parse(calls.at(-1).messages[1].content).literatureAndRefinedQuestion,
    /describe grade variation/,
  );
  assert.match(calls.at(-1).messages[0].content, /in preference to the initial direction/);
  malformed = true;
  r = await post('/api/conversation', {
    stageId: 'question',
    question: 'Continue',
    revision: 6,
    settingsRevision: 0,
  });
  assert.equal(r.status, 502);
  await new Promise((r) => app.close(r));
  app = await createApp({ dataDir: dir });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  data = await (await fetch(`http://127.0.0.1:${app.address().port}/api/project`)).json();
  assert.equal(data.project.revision, 6);
  assert.equal(data.project.milestones[0].conversation.length, 2);
  assert.equal(data.project.milestones[0].conversation[1].accepted, true);
});
test('accepting proposals rejects stale versions and invalidates approvals without replacing student reasoning', () => {
  let p = createProject();
  p.milestones[0].explanation = 'My own reasoning';
  p.milestones[0].status = 'approved';
  p.milestones[1].status = 'approved';
  p = appendConversation(p, 'question', {
    id: 't',
    draft: 'Proposed research brief',
    artifactVersion: 0,
  });
  const accepted = applyAction(p, {
    type: 'accept_draft',
    stageId: 'question',
    turnId: 't',
    revision: p.revision,
  });
  assert.equal(accepted.milestones[0].explanation, 'My own reasoning');
  assert.equal(accepted.milestones[1].status, 'needs_revision');
  assert.throws(
    () =>
      applyAction(accepted, {
        type: 'accept_draft',
        stageId: 'question',
        turnId: 't',
        revision: accepted.revision,
      }),
    /outdated/,
  );
  milestone(p, 'question').version = 1;
  assert.throws(
    () =>
      applyAction(p, {
        type: 'accept_draft',
        stageId: 'question',
        turnId: 't',
        revision: p.revision,
      }),
    /outdated/,
  );
});
