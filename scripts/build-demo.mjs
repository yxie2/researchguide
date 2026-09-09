// Rebuild the checked-in teaching artifact using actual local R execution.
import { writeFile } from 'node:fs/promises';
import { createProject } from '../lib/workflow.mjs';
import { importDataset, addAnalysisPlan, approvePlan, executeAnalysis } from '../lib/analysis.mjs';
import { demoCase, demoCSV } from '../lib/demo-case.mjs';
import { parse } from 'csv-parse/sync';

const project = createProject('Fictional teaching case', demoCase.stages[0].artifact);
for (const stage of demoCase.stages) {
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
  name: 'synthetic-study-hours.csv',
  csv: demoCSV,
  permission:
    'Author-created fictional observations for a public teaching demonstration; no real participants.',
});
const plan = addAnalysisPlan(project, {
  datasetId: 'D1',
  method: 'linear',
  outcome: 1,
  predictor: 0,
  rationale:
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
const coefficients = parse(run.files['coefficients.csv'], { columns: true });
const slope = coefficients[1];
const analysis = demoCase.stages.find((s) => s.id === 'analysis');
analysis.artifact = analysis.artifact
  .replace(
    /Slope:.*\nIntercept:.*\n/,
    `Slope: ${Number(slope.estimate).toFixed(6)} quiz points/hour; model-based 95% CI ${Number(slope.lower_95).toFixed(6)} to ${Number(slope.upper_95).toFixed(6)}.\nIntercept: ${Number(coefficients[0].estimate).toFixed(6)} quiz points.\n`,
  )
  .replace(
    /Residuals are approximately .*?; estimates/,
    'The exact fitted values and residuals are in the attached output; estimates',
  );
const result = {
  ...demoCase,
  csv: demoCSV,
  builtAt: new Date().toISOString(),
  computation: { dataset: project.datasets[0], plan, run },
};
await writeFile(
  new URL('../public/demo-case.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  'Built fictional walkthrough with actual R results; no active project or model settings accessed.',
);
