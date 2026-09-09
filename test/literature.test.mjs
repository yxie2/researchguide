import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLiterature, literatureAction } from '../lib/literature.mjs';
import { createProject, exportMarkdown } from '../lib/workflow.mjs';
import { validateProject, parseBackup } from '../lib/projects.mjs';
const fetcher = async (url) =>
  new Response(
    JSON.stringify(
      url.hostname === 'api.crossref.org'
        ? {
            message: {
              items: [
                {
                  DOI: '10.1234/test',
                  title: ['<b>Synthetic learning paper</b>'],
                  author: [{ given: 'Test', family: 'Author' }],
                  published: { 'date-parts': [[2024]] },
                  type: 'journal-article',
                },
              ],
            },
          }
        : {
            resultList: {
              result: [
                {
                  id: '123',
                  source: 'MED',
                  doi: '10.1234/TEST',
                  title: 'Synthetic learning paper',
                  abstractText: '<p>Synthetic abstract.</p>',
                  isOpenAccess: 'Y',
                },
              ],
            },
          },
    ),
  );
test('literature retrieval combines DOI duplicates and reports partial failures', async () => {
  const result = await searchLiterature('student learning', fetcher);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0].catalogues, ['Crossref', 'Europe PMC']);
  assert.equal(result.results[0].title, 'Synthetic learning paper');
  assert.equal(result.results[0].abstract, 'Synthetic abstract.');
  const partial = await searchLiterature('student learning', (url) =>
    url.hostname === 'api.crossref.org' ? fetcher(url) : Promise.reject(Error('Offline')),
  );
  assert.match(partial.warnings[0], /partial coverage/);
  await assert.rejects(searchLiterature('', fetcher), /search terms/);
  await assert.rejects(
    searchLiterature('test', async () => new Response('x'.repeat(2100000))),
    /could not be reached/,
  );
});
test('agent searches from interest, grounds suggestions and preserves reading lists without adding evidence', async () => {
  const p = createProject('Test', 'How does feedback relate to learning?');
  const model = async (system, user) => {
    const context = JSON.parse(user);
    if (system.startsWith('Generate')) {
      assert.match(context.interest, /feedback/);
      return 'feedback learning';
    }
    return JSON.stringify({
      suggestions: context.papers.map((paper) => ({
        id: paper.id,
        priority: 'medium',
        reason: 'Potential fit from abstract only.',
        readFor: 'Check measures and sampling.',
      })),
    });
  };
  let next = (
    await literatureAction(
      p,
      { action: 'discover', query: '' },
      { model: 'mock' },
      (q) => searchLiterature(q, fetcher),
      model,
    )
  ).project;
  assert.equal(p.revision, 0);
  assert.equal(next.literatureSearches[0].query, 'feedback learning');
  assert.equal(next.sources.length, 0);
  assert.deepEqual(next.milestones, p.milestones);
  const record = next.literatureSearches[0];
  next = (
    await literatureAction(
      next,
      {
        action: 'reading_list',
        searchId: record.id,
        paperId: record.results[0].id,
        selected: true,
        note: 'Read for measurement choices.',
      },
      {},
    )
  ).project;
  validateProject(next);
  const restored = parseBackup(JSON.parse(JSON.stringify(next))).project;
  assert.equal(restored.literatureSearches[0].results[0].readingList, true);
  assert.match(exportMarkdown(next), /Read for measurement/);
  restored.literatureSearches[0].results[0].url = 'javascript:alert(1)';
  assert.throws(() => validateProject(restored), /literature URL/);
});
test('invented recommendation IDs are rejected while retrieved records survive failed AI assessment', async () => {
  await assert.rejects(
    literatureAction(createProject(), { action: 'discover', query: '' }, {}),
    /Save a research interest/,
  );
  await assert.rejects(
    literatureAction(createProject(), { action: 'discover', query: 123 }, {}),
    /must be text/,
  );
  const invalidModel = async () =>
    JSON.stringify({
      suggestions: [{ id: 'invented', priority: 'high', reason: 'Fake', readFor: 'Fake' }],
    });
  const next = (
    await literatureAction(
      createProject(),
      { action: 'discover', query: 'learning' },
      { model: 'mock' },
      (q) => searchLiterature(q, fetcher),
      invalidModel,
    )
  ).project;
  const record = next.literatureSearches[0];
  assert.equal(record.results.length, 1);
  assert.equal(record.assessment, undefined);
  assert.match(record.warnings[0], /AI suggestions could not/);
  await assert.rejects(
    literatureAction(next, { action: 'assess', searchId: record.id }, {}, undefined, invalidModel),
    /could not be validated/,
  );
});
