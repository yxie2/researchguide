import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPublicData, discoveryAction, discoveryCurrent } from '../lib/discovery.mjs';
import { createProject, exportMarkdown } from '../lib/workflow.mjs';
import { validateProject } from '../lib/projects.mjs';

const item = {
  type: 'dataset',
  name: '<b>Training data</b>',
  url: 'https://doi.org/10.7910/DVN/TEST',
  description: 'Synthetic fixture, not a real catalogue record.',
};
const fetcher = async (url) => {
  assert.equal(url.hostname, 'dataverse.harvard.edu');
  assert.equal(url.searchParams.get('type'), 'dataset');
  return new Response(
    JSON.stringify({
      status: 'OK',
      data: { items: [item, { ...item, url: 'javascript:alert(1)' }, { ...item, type: 'file' }] },
    }),
  );
};
test('public search uses pinned catalogue, preserves provenance and filters unsafe links', async () => {
  const results = await searchPublicData('employee training', fetcher);
  assert.equal(results.length, 1);
  assert.equal(results[0].title.trim(), 'Training data');
  assert.match(results[0].access, /not been verified/);
  await assert.rejects(searchPublicData(''));
  await assert.rejects(
    searchPublicData('training', async () => new Response('<html>blocked</html>')),
    /could not be searched/,
  );
  await assert.rejects(
    searchPublicData('training', async () => new Response('x'.repeat(2100000))),
    /could not be searched/,
  );
});
test('discovery decisions persist and export without importing or approving data; assessments become stale', async () => {
  let p = createProject();
  p.milestones[1].artifact = 'Refined question: how is training associated with sales?';
  const originalMilestones = structuredClone(p.milestones);
  p = (
    await discoveryAction(p, { action: 'search', query: 'training sales' }, {}, (q) =>
      searchPublicData(q, fetcher),
    )
  ).project;
  const search = p.dataSearches[0],
    candidate = search.results[0];
  const ids = { searchId: search.id, candidateId: candidate.id };
  p = (
    await discoveryAction(p, { action: 'assess', ...ids }, {}, undefined, async (_system, user) => {
      assert.match(user, /Refined question/);
      return 'Potential fit: training. Missing information: population and variables. Checks before use: inspect licence.';
    })
  ).project;
  p = (
    await discoveryAction(
      p,
      {
        action: 'shortlist',
        ...ids,
        shortlisted: true,
        note: 'Inspect the population and variables before deciding to use this dataset.',
      },
      {},
    )
  ).project;
  validateProject(p);
  assert.deepEqual(p.milestones, originalMilestones);
  assert.equal(p.datasets?.length || 0, 0);
  assert.match(exportMarkdown(p), /Shortlisted: yes/);
  assert.ok(discoveryCurrent(p, p.dataSearches[0].results[0].assessment));
  p.milestones[1].version++;
  assert.equal(discoveryCurrent(p, p.dataSearches[0].results[0].assessment), false);
  p.dataSearches[0].results[0].url = 'https://evil.example/dataset';
  assert.throws(() => validateProject(p), /catalogue URL/);
});
test('AI keyword suggestion does not search or mutate the project', async () => {
  const p = createProject();
  const result = await discoveryAction(
    p,
    { action: 'terms' },
    {},
    () => {
      throw Error('Search must not run');
    },
    async () => 'training sales',
  );
  assert.equal(result.query, 'training sales');
  assert.equal(p.revision, 0);
  assert.equal(p.dataSearches, undefined);
});
