import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'csv-parse/sync';
import { createProject, applyAction, exportMarkdown } from '../lib/workflow.mjs';
import {
  importDataset,
  addAnalysisPlan,
  approvePlan,
  approvedRunInput,
  executeAnalysis,
  planCurrent,
} from '../lib/analysis.mjs';
import {
  consistencySnapshot,
  appendConsistency,
  consistencyIsCurrent,
} from '../lib/consistency.mjs';
import { analysisCSV, analysisRationale } from '../scripts/analysis-fixture.mjs';
function setup(method = 'linear') {
  const p = createProject();
  importDataset(p, {
    name: 'Synthetic dataset',
    csv: analysisCSV,
    permission: 'Synthetic numbers generated for software tests.',
  });
  const plan = addAnalysisPlan(p, {
    datasetId: 'D1',
    method,
    outcome: 1,
    predictor: 0,
    rationale: analysisRationale,
  });
  return { p, plan };
}
function approve(p, plan) {
  approvePlan(p, {
    planId: plan.id,
    planHash: plan.planHash,
    name: 'Test researcher',
    note: 'I reviewed this synthetic dataset, variable mapping and exact script for testing.',
    reviewed: true,
  });
  return plan.approvals.at(-1).id;
}
test('CSV profiles preserve input identity and reject malformed or unsafe selections', () => {
  const { p, plan } = setup();
  assert.equal(p.datasets[0].csv, analysisCSV);
  assert.equal(p.datasets[0].rowCount, 8);
  assert.equal(p.datasets[0].columns[0].missing, 1);
  assert.equal(p.datasets[0].columns[1].missing, 1);
  assert.throws(
    () =>
      importDataset(p, {
        name: 'Duplicate',
        csv: analysisCSV,
        permission: 'Synthetic numbers generated for software tests.',
      }),
    /already saved/,
  );
  assert.throws(
    () =>
      importDataset(p, {
        name: 'Bad',
        csv: 'a,a\n1,2\n3,4',
        permission: 'Synthetic numbers generated for software tests.',
      }),
    /unique/,
  );
  assert.throws(
    () =>
      addAnalysisPlan(p, {
        datasetId: 'D1',
        method: 'linear',
        outcome: 0,
        predictor: 0,
        rationale: analysisRationale,
      }),
    /distinct/,
  );
  assert.throws(
    () =>
      addAnalysisPlan(p, {
        datasetId: 'D1',
        method: 'linear',
        outcome: null,
        predictor: 1,
        rationale: analysisRationale,
      }),
    /numeric/,
  );
  assert.throws(() => approvedRunInput(p, plan.id, 'none'), /Approve/);
  const approval = approve(p, plan);
  assert.match(approvedRunInput(p, plan.id, approval).csv, /y,x/);
  const changed = structuredClone(p);
  changed.analysisPlans[0].outcome = 0;
  assert.throws(() => approvedRunInput(changed, plan.id, approval), /integrity/);
  const edited = applyAction(p, {
    type: 'save',
    revision: p.revision,
    stageId: 'design',
    artifact: 'The study design changed after this analysis was planned.',
    explanation: '',
  });
  assert.equal(planCurrent(edited, plan), false);
  assert.throws(() => approvedRunInput(edited, plan.id, approval), /current/);
});
test('real R regression returns known estimates, exclusion counts, session and a figure', async () => {
  const { p, plan } = setup();
  const approval = approve(p, plan);
  const run = await executeAnalysis(p, plan.id, approval);
  assert.equal(run.status, 'succeeded', run.log);
  const counts = parse(run.files['counts.csv'], { columns: true })[0];
  assert.equal(counts.total, '8');
  assert.equal(counts.used, '6');
  assert.equal(counts.excluded, '2');
  const coefficients = parse(run.files['coefficients.csv'], { columns: true });
  assert.ok(Math.abs(Number(coefficients[1].estimate) - 1.94285714285714) < 1e-10);
  assert.ok(Number(coefficients[1].lower_95) < Number(coefficients[1].estimate));
  assert.ok(Number(coefficients[1].upper_95) > Number(coefficients[1].estimate));
  assert.match(run.rVersion, /R version/);
  assert.match(run.files['figure.svg'], /<svg/);
  assert.match(run.files['session.txt'], /stats/);
  const report = { snapshot: consistencySnapshot(p) };
  p.analysisRuns = [run];
  assert.equal(consistencyIsCurrent(p, report), false);
  const snap = consistencySnapshot(p);
  assert.match(snap.at(-1).artifact, /1.942857/);
  assert.match(exportMarkdown(p), /Reproducible analysis/);
});
test('real R descriptive output and failed regressions remain distinguishable', async () => {
  const { p, plan } = setup('descriptive');
  const result = await executeAnalysis(p, plan.id, approve(p, plan));
  assert.equal(result.status, 'succeeded', result.log);
  const values = parse(result.files['descriptives.csv'], { columns: true });
  assert.equal(values[0].n, '7');
  assert.equal(result.files['coefficients.csv'], undefined);
  const broken = createProject();
  importDataset(broken, {
    name: 'Constant predictor',
    csv: 'x,y\n1,2\n1,3\n1,4',
    permission: 'Synthetic values for an expected failure.',
  });
  const bad = addAnalysisPlan(broken, {
    datasetId: 'D1',
    method: 'linear',
    outcome: 1,
    predictor: 0,
    rationale: analysisRationale,
  });
  const failed = await executeAnalysis(broken, bad.id, approve(broken, bad));
  assert.equal(failed.status, 'failed');
  assert.match(failed.log, /variation/);
  assert.deepEqual(failed.files, {});
});
