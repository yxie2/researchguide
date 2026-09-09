// Rebuild the checked-in teaching artifact using actual local R execution.
import { writeFile } from 'node:fs/promises';
import { createProject } from '../lib/workflow.mjs';
import { importDataset, addAnalysisPlan, approvePlan, executeAnalysis } from '../lib/analysis.mjs';
import { demoCase, demoCSV } from '../lib/demo-case.mjs';
import { businessCase, businessCSV } from '../lib/business-demo-case.mjs';
import { parse } from 'csv-parse/sync';
import { deepenDemo } from '../lib/demo-depth.mjs';
import { demoWorkspace } from '../lib/demo-preparation.mjs';

async function build(source, csv, filename) {
  const teachingCase = deepenDemo(source);
  const project = createProject('Fictional teaching case', teachingCase.stages[0].artifact);
  for (const stage of teachingCase.stages) {
    Object.assign(
      project.milestones.find((m) => m.id === stage.id),
      {
        artifact: stage.artifact,
        explanation: stage.understanding,
        version: 1,
      },
    );
  }
  importDataset(project, {
    name: teachingCase.datasetName || 'synthetic-study-hours.csv',
    csv,
    permission:
      'Author-created fictional observations for a public teaching demonstration; no real participants.',
  });
  const plan = addAnalysisPlan(project, {
    datasetId: 'D1',
    method: 'linear',
    outcome: 1,
    predictor: 0,
    rationale:
      teachingCase.rationale ||
      'Estimate the unadjusted association between study hours and quiz scores in synthetic records. Omit incomplete cases; no causal interpretation or confounder adjustment.',
  });
  approvePlan(project, {
    planId: plan.id,
    planHash: plan.planHash,
    name: 'Demo build · synthetic data only',
    note: 'The tutorial author reviewed the fixed template and synthetic variable mapping. This build approval is not a real researcher or supervisor approval.',
    reviewed: true,
  });
  const run = await executeAnalysis(project, plan.id, plan.approvals.at(-1).id);
  if (run.status !== 'succeeded') throw new Error(run.log);
  project.analysisRuns ||= [];
  project.analysisRuns.push(run);
  const coefficients = parse(run.files['coefficients.csv'], { columns: true });
  const slope = coefficients[1];
  const analysis = teachingCase.stages.find((s) => s.id === 'analysis');
  if (teachingCase.id === 'maya-first-study') {
    analysis.artifact = analysis.artifact
      .replace(
        /Slope:.*\nIntercept:.*\n/,
        `Slope: ${Number(slope.estimate).toFixed(6)} quiz points/hour; model-based 95% CI ${Number(slope.lower_95).toFixed(6)} to ${Number(slope.upper_95).toFixed(6)}.\nIntercept: ${Number(coefficients[0].estimate).toFixed(6)} quiz points.\n`,
      )
      .replace(
        /Residuals are approximately .*?; estimates/,
        'The exact fitted values and residuals are in the attached output; estimates',
      );
  }
  const counts = parse(run.files['counts.csv'], { columns: true })[0];
  const values = {
    slope: Number(slope.estimate).toFixed(3),
    lower: Number(slope.lower_95).toFixed(3),
    upper: Number(slope.upper_95).toFixed(3),
    intercept: Number(coefficients[0].estimate).toFixed(3),
    ...counts,
  };
  const workspace = demoWorkspace(csv, teachingCase.id === 'alex-business-study');
  for (const file of workspace.files) {
    importDataset(project, {
      ...file,
      permission:
        'Author-created fictional observations for a public teaching demonstration; no real participants or repository download.',
    });
  }
  const sensitivityPlan = addAnalysisPlan(project, {
    datasetId: 'D4',
    method: 'linear',
    outcome: 1,
    predictor: 0,
    rationale:
      'Post-hoc teaching sensitivity check: omit the highest complete exposure while preserving primary R1. This is not a prespecified test, error correction or independent replication.',
  });
  approvePlan(project, {
    planId: sensitivityPlan.id,
    planHash: sensitivityPlan.planHash,
    name: 'Demo build · exploratory synthetic analysis',
    note: 'The tutorial author reviewed the separate D4 mapping, omission rule and exact script. This is a build approval, not a real supervisor decision.',
    reviewed: true,
  });
  const sensitivityRun = await executeAnalysis(
    project,
    sensitivityPlan.id,
    sensitivityPlan.approvals.at(-1).id,
  );
  if (sensitivityRun.status !== 'succeeded') throw new Error(sensitivityRun.log);
  const sensitivitySlope = parse(sensitivityRun.files['coefficients.csv'], { columns: true })[1];
  const sensitivityCounts = parse(sensitivityRun.files['counts.csv'], { columns: true })[0];
  Object.assign(values, {
    sensitivity_slope: Number(sensitivitySlope.estimate).toFixed(3),
    sensitivity_lower: Number(sensitivitySlope.lower_95).toFixed(3),
    sensitivity_upper: Number(sensitivitySlope.upper_95).toFixed(3),
    sensitivity_used: sensitivityCounts.used,
  });
  if (
    teachingCase.id === 'alex-business-study' &&
    !(Number(slope.lower_95) < 0 && Number(slope.upper_95) > 0)
  )
    throw new Error('Business teaching narrative requires an interval crossing zero.');
  function resolve(value) {
    if (typeof value === 'string')
      return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (!(key in values)) throw new Error(`Unknown demo placeholder: ${key}`);
        return values[key];
      });
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
    return value;
  }
  const result = {
    ...resolve(teachingCase),
    csv,
    builtAt: new Date().toISOString(),
    computation: {
      dataset: project.datasets[0],
      plan,
      run,
      datasets: project.datasets,
      preparation: workspace.preparation,
      sensitivity: { dataset: project.datasets[3], plan: sensitivityPlan, run: sensitivityRun },
    },
  };
  await writeFile(
    new URL(`../public/${filename}`, import.meta.url),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    `Built ${teachingCase.id} with actual R results; no active project or model settings accessed.`,
  );
}
await build(demoCase, demoCSV, 'demo-case.json');
await build(businessCase, businessCSV, 'business-demo-case.json');
