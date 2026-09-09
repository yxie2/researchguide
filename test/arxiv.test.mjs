import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArxiv, searchArxiv } from '../lib/arxiv.mjs';
import { searchLiterature, literatureAction } from '../lib/literature.mjs';
import { createProject, exportMarkdown } from '../lib/workflow.mjs';
import { parseBackup } from '../lib/projects.mjs';
const entry = (id, doi = '') =>
  `<entry><id>http://arxiv.org/abs/${id}</id><title>Learning &amp; inference</title><published>2024-01-01</published><summary><![CDATA[An abstract with symbols < and >.]]></summary><author><name>A. Author</name></author>${doi ? `<arxiv:doi>${doi}</arxiv:doi>` : ''}</entry>`;
const feed = (content) =>
  `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">${content}</feed>`;
test('arXiv parses XML entities, CDATA and modern/legacy IDs; rejects unsafe or invalid feeds', () => {
  const results = parseArxiv(feed(entry('2401.12345v2') + entry('cs/9901002v1')));
  assert.equal(results[0].title, 'Learning & inference');
  assert.equal(results[0].abstract, 'An abstract with symbols < and >.');
  assert.equal(results[0].url, 'https://arxiv.org/abs/2401.12345v2');
  assert.match(results[1].url, /cs\/9901002v1/);
  assert.match(results[0].type, /not verified/);
  assert.deepEqual(parseArxiv(feed('')), []);
  for (const invalid of [
    '<html>blocked</html>',
    '<feed>',
    '<!DOCTYPE feed [<!ENTITY x "boom">]>' + feed(''),
    feed(entry('bad-id')),
    feed(entry('2401.12345')).replace('http://arxiv.org/abs/', 'https://evil.example/abs/'),
  ])
    assert.throws(() => parseArxiv(invalid));
});
test('arXiv uses bounded relevance search and preserves version link when DOI matches a journal record', async () => {
  const arxivFetch = async (url) => {
    assert.equal(url.hostname, 'export.arxiv.org');
    assert.equal(url.searchParams.get('search_query'), 'all:machine AND all:learning');
    assert.equal(url.searchParams.get('max_results'), '6');
    return new Response(feed(entry('2401.12345v1', '10.1234/example')));
  };
  await searchArxiv('machine learning', arxivFetch);
  const fetcher = async (url) =>
    url.hostname === 'export.arxiv.org'
      ? arxivFetch(url)
      : new Response(
          JSON.stringify(
            url.hostname === 'api.crossref.org'
              ? {
                  message: {
                    items: [
                      {
                        DOI: '10.1234/example',
                        title: ['Journal version'],
                        type: 'journal-article',
                      },
                    ],
                  },
                }
              : { resultList: { result: [] } },
          ),
        );
  const result = await searchLiterature('machine learning', fetcher);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.catalogues, ['Crossref', 'Europe PMC', 'arXiv']);
  assert.deepEqual(result.results[0].catalogues, ['Crossref', 'arXiv']);
  assert.equal(result.results[0].type, 'journal-article');
  assert.match(result.results[0].arxivUrl, /2401.12345v1/);
  const p = (
    await literatureAction(
      createProject(),
      { action: 'search', query: 'machine learning' },
      {},
      () => result,
    )
  ).project;
  assert.match(
    parseBackup(JSON.parse(JSON.stringify(p))).project.literatureSearches[0].results[0].arxivUrl,
    /arxiv.org/,
  );
  assert.match(exportMarkdown(p), /arXiv version/);
});
