import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stages } from '../lib/workflow.mjs';
import { analysisScript } from '../lib/r-template.mjs';
const business = JSON.parse(
  await readFile(new URL('../public/business-demo-case.json', import.meta.url), 'utf8'),
);
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

test('business case covers all milestones with distinct management decisions and resolved results', () => {
  assert.deepEqual(
    business.stages.map((s) => s.id),
    stages.map((s) => s.id),
  );
  const serialized = JSON.stringify(business);
  assert.doesNotMatch(serialized, /\{\{\w+\}\}/);
  assert.doesNotMatch(serialized, /Maya|quiz_score|study_hours/);
  for (const s of business.stages) {
    assert.ok(s.turns.length >= 5);
    for (const field of ['input', 'artifact', 'understanding', 'review', 'carry', 'where'])
      assert.ok(s[field].length > 25);
  }
  assert.match(business.stages[2].artifact, /manager selection/);
  assert.match(business.stages[5].artifact, /ROI/);
  assert.match(business.stages[6].artifact, /Executive summary/);
  assert.match(business.stages[6].artifact, /TEACHING REPORT/);
  for (const s of business.stages[1].sources) assert.match(s.title, /fictional/);
});

test('business results match independent slope calculation and retain a zero-crossing interval in the narrative', () => {
  const { run, dataset } = business.computation;
  assert.equal(dataset.csv, business.csv);
  assert.equal(dataset.sha256, createHash('sha256').update(business.csv).digest('hex'));
  assert.equal(run.script, analysisScript('linear'));
  assert.equal(run.status, 'succeeded');
  const rows = parse(business.csv, { columns: true }).filter(
    (r) => r.training_hours !== '' && r.next_month_sales_kusd !== 'NA',
  );
  const meanX = rows.reduce((sum, r) => sum + Number(r.training_hours), 0) / rows.length;
  const meanY = rows.reduce((sum, r) => sum + Number(r.next_month_sales_kusd), 0) / rows.length;
  const expected =
    rows.reduce(
      (sum, r) =>
        sum + (Number(r.training_hours) - meanX) * (Number(r.next_month_sales_kusd) - meanY),
      0,
    ) / rows.reduce((sum, r) => sum + (Number(r.training_hours) - meanX) ** 2, 0);
  const slope = parse(run.files['coefficients.csv'], { columns: true })[1];
  assert.ok(Math.abs(Number(slope.estimate) - expected) < 1e-10);
  assert.ok(Number(slope.lower_95) < 0 && Number(slope.upper_95) > 0);
  const counts = parse(run.files['counts.csv'], { columns: true })[0];
  assert.deepEqual([counts.total, counts.used, counts.excluded], ['14', '12', '2']);
  for (const s of business.stages.slice(4)) {
    for (const number of [slope.estimate, slope.lower_95, slope.upper_95])
      assert.ok(s.artifact.includes(Number(number).toFixed(3)));
  }
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
