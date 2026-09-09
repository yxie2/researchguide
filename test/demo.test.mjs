import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stages } from '../lib/workflow.mjs';
import { analysisScript } from '../lib/r-template.mjs';
import { workflowFor, requiresSupervisorReview } from '../public/workflow-flow.js';
import { prepareDemoRaw } from '../lib/demo-preparation.mjs';
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

for (const example of [demo, business]) {
  test(`${example.id}: downloadable preparation script runs independently`, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'researchguide-demo-prep-'));
    try {
      await writeFile(path.join(dir, 'prepare.mjs'), example.computation.preparation.script);
      await writeFile(path.join(dir, 'raw.csv'), example.computation.datasets[1].csv);
      await promisify(execFile)(process.execPath, ['prepare.mjs', 'raw.csv', 'rebuilt.csv'], {
        cwd: dir,
      });
      assert.equal(await readFile(path.join(dir, 'rebuilt.csv'), 'utf8'), example.csv);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test(`${example.id}: extended walkthrough matches current tasks and has complete decision exercises`, () => {
    assert.equal(example.edition, 2);
    assert.doesNotMatch(JSON.stringify(example), /\{\{\w+\}\}/);
    for (const [i, stage] of example.stages.entries()) {
      assert.equal(stage.title, stages[i].title);
      assert.equal(stage.checkpoint, requiresSupervisorReview(stage.id));
      assert.deepEqual(
        stage.tasks.map((t) => [t.id, t.title, t.description]),
        workflowFor(stage.id),
      );
      for (const task of stage.tasks) assert.ok(task.example.length > 40);
      assert.equal(stage.depth.options.length, 3);
      assert.ok(stage.depth.options[stage.depth.correct]);
      assert.ok(stage.depth.revision.length >= 2);
    }
    assert.equal(example.stages[1].sources.length, 4);
    assert.equal(example.search.results.length, 6);
    assert.equal(example.publicCandidates.length, 3);
    assert.match(example.search.disclosure, /No live search/);
    assert.doesNotMatch(
      example.stages[4].artifact,
      /Exploratory analyses: None|no comprehensive influence, clustering or sensitivity assessment/,
    );
  });

  test(`${example.id}: raw preparation reproduces the primary file; sensitivity has independent valid provenance`, () => {
    const { datasets, preparation, sensitivity, run: primary } = example.computation;
    assert.equal(datasets.length, 4);
    assert.equal(new Set(datasets.map((d) => d.sha256)).size, 4);
    for (const d of datasets)
      assert.equal(d.sha256, createHash('sha256').update(d.csv).digest('hex'));
    const headers = example.csv.split('\n')[0];
    const outcomeUnit = example.id === 'alex-business-study' ? 'kUSD' : 'points';
    const prepared = prepareDemoRaw(datasets[1].csv, headers, outcomeUnit);
    assert.equal(prepared.csv, example.csv);
    assert.deepEqual(prepared.log, preparation.log);
    assert.equal(prepared.log.length, 2);
    assert.match(prepared.log.join('\n'), /duplicate/);
    assert.match(prepared.log.join('\n'), /converted/);
    const rawLines = datasets[1].csv.trimEnd().split('\n');
    rawLines[rawLines.length - 1] = rawLines.at(-1).replace(/^2,[^,]+,/, '2,999,');
    assert.throws(
      () => prepareDemoRaw(rawLines.join('\n'), headers, outcomeUnit),
      /Conflicting duplicate/,
    );
    assert.equal(sensitivity.dataset.id, 'D4');
    assert.equal(sensitivity.plan.datasetHash, datasets[3].sha256);
    assert.equal(sensitivity.run.status, 'succeeded');
    assert.notEqual(primary.id, sensitivity.run.id);
    assert.equal(sensitivity.run.script, analysisScript('linear'));
    assert.equal(sensitivity.plan.approvals.length, 1);
    const rows = parse(datasets[3].csv)
      .slice(1)
      .filter((r) => r.every((v) => v !== '' && v !== 'NA'))
      .map((r) => r.map(Number));
    const avgX = rows.reduce((sum, r) => sum + r[0], 0) / rows.length;
    const avgY = rows.reduce((sum, r) => sum + r[1], 0) / rows.length;
    const expected =
      rows.reduce((sum, r) => sum + (r[0] - avgX) * (r[1] - avgY), 0) /
      rows.reduce((sum, r) => sum + (r[0] - avgX) ** 2, 0);
    const slope = parse(sensitivity.run.files['coefficients.csv'], { columns: true })[1];
    assert.ok(Math.abs(Number(slope.estimate) - expected) < 1e-10);
    const counts = parse(sensitivity.run.files['counts.csv'], { columns: true })[0];
    assert.equal(Number(counts.used), rows.length);
    assert.equal(Number(counts.excluded), 2);
    assert.equal(rows.length, example.id === 'alex-business-study' ? 11 : 5);
    for (const stage of example.stages.slice(4)) {
      assert.match(stage.artifact, /Exploratory R2/);
      for (const value of [slope.estimate, slope.lower_95, slope.upper_95])
        assert.ok(stage.artifact.includes(Number(value).toFixed(3)));
    }
  });
}
