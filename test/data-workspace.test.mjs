import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, applyAction, exportMarkdown } from '../lib/workflow.mjs';
import { validateProject } from '../lib/projects.mjs';
const permission = 'Synthetic test data; freely permitted for software testing.';
function fixture() {
  const p = createProject();
  p.dataSearches = [
    {
      id: 'search1',
      query: 'test',
      at: new Date().toISOString(),
      provider: 'Harvard Dataverse',
      context: [],
      results: [
        {
          id: 'candidate1',
          title: 'Synthetic record',
          url: 'https://doi.org/10.7910/DVN/TEST',
          citation: 'Synthetic fixture',
          description: '',
          publisher: '',
          publishedAt: '',
          access: 'Unverified',
          shortlisted: true,
        },
      ],
    },
  ];
  return p;
}
test('workspace holds independent local and public CSVs with durable source attribution', () => {
  let p = fixture();
  p = applyAction(p, {
    type: 'analysis_dataset',
    revision: p.revision,
    name: 'Own survey',
    csv: 'x,y\n1,2\n2,4\n',
    filename: 'survey.csv',
    permission,
  });
  p = applyAction(p, {
    type: 'analysis_dataset',
    revision: p.revision,
    name: 'Public comparison',
    csv: 'x,y\n3,5\n4,7\n',
    filename: 'comparison.csv',
    permission,
    notes: 'Comparison sample; do not merge without checking units.',
    sourceSearchId: 'search1',
    sourceCandidateId: 'candidate1',
  });
  assert.equal(p.datasets.length, 2);
  assert.equal(p.datasets[0].origin.kind, 'upload');
  assert.equal(p.datasets[1].origin.kind, 'dataverse');
  assert.equal(p.datasets[1].origin.filename, 'comparison.csv');
  const restored = JSON.parse(JSON.stringify(p));
  validateProject(restored);
  assert.deepEqual(restored.datasets, p.datasets);
  assert.match(exportMarkdown(p), /Synthetic fixture/);
  assert.match(exportMarkdown(p), /Comparison sample/);
  const hashes = p.datasets.map((d) => d.sha256);
  p = applyAction(p, {
    type: 'dataset_notes',
    revision: p.revision,
    datasetId: 'D2',
    notes: 'Cleaned version; retain the original separately.',
  });
  assert.deepEqual(
    p.datasets.map((d) => d.sha256),
    hashes,
  );
  assert.equal(p.datasets[0].notes, '');
  assert.match(p.datasets[1].notes, /Cleaned version/);
  assert.equal(createProject().datasets, undefined);
  assert.throws(
    () =>
      applyAction(p, {
        type: 'analysis_dataset',
        revision: p.revision,
        name: 'Wrong source',
        csv: 'x,y\n1,8\n2,9\n',
        permission,
        sourceSearchId: 'another-project',
        sourceCandidateId: 'candidate1',
      }),
    /must belong to this project/,
  );
  restored.datasets[1].origin.url = 'https://evil.example/file';
  assert.throws(() => validateProject(restored), /origin reference/);
});
test('workspace supports more than five files while retaining duplicate and count guards', () => {
  let p = createProject();
  const add = (n) => ({
    type: 'analysis_dataset',
    revision: p.revision,
    name: `File ${n}`,
    csv: `x\n${n}\n${n + 1}\n`,
    permission,
  });
  for (let n = 0; n < 20; n++) p = applyAction(p, add(n));
  assert.equal(p.datasets.length, 20);
  assert.throws(() => applyAction(p, add(21)), /20 stored CSV/);
});
