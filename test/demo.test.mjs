import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stages } from '../lib/workflow.mjs';
import { analysisScript } from '../lib/r-template.mjs';
const demo = JSON.parse(
  await readFile(new URL('../public/demo-case.json', import.meta.url), 'utf8'),
);

test('teaching case covers every milestone and distinguishes authored simulation from computation', () => {
  assert.deepEqual(
    demo.stages.map((s) => s.id),
    stages.map((s) => s.id),
  );
  assert.match(demo.disclosure, /invented/);
  for (const stage of demo.stages) {
    assert.ok(stage.turns.length >= 5);
    for (const field of ['input', 'artifact', 'understanding', 'review', 'carry', 'where'])
      assert.ok(stage[field].length > 25);
    if (stage.challenge) assert.ok(stage.challenge.choices[stage.challenge.correct]);
  }
  for (const source of demo.stages[1].sources) assert.match(source.title, /fictional/);
  assert.match(demo.stages[5].artifact, /Rejected wording/);
  assert.match(demo.stages[6].artifact, /TEACHING REPORT/);
});

test('bundled R outputs match the synthetic data, fixed template and narrative', () => {
  const { dataset, plan, run } = demo.computation;
  assert.equal(run.status, 'succeeded');
  assert.equal(dataset.csv, demo.csv);
  assert.equal(dataset.sha256, createHash('sha256').update(demo.csv).digest('hex'));
  assert.equal(run.script, analysisScript('linear'));
  assert.equal(run.script, plan.script);
  const counts = parse(run.files['counts.csv'], { columns: true })[0];
  assert.deepEqual([counts.total, counts.used, counts.excluded], ['8', '6', '2']);
  const coefficients = parse(run.files['coefficients.csv'], { columns: true });
  assert.ok(Math.abs(Number(coefficients[1].estimate) - 1.94285714285714) < 1e-10);
  assert.ok(Math.abs(Number(coefficients[0].estimate) + 0.133333333333333) < 1e-10);
  assert.match(demo.stages[4].artifact, /Intercept: -0.133333/);
  assert.match(run.files['session.txt'], /R version/);
});
