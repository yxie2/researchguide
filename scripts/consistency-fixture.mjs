import { createProject } from '../lib/workflow.mjs';
export function consistencyFixture() {
  const p = createProject('Synthetic consistency study', 'Is study time associated with scores?');
  const artifacts = {
    evidence:
      'Literature review: prior achievement may confound study time and scores. Refined question: among first-year students in one course, is weekly study time associated with final exam scores? This synthetic fixture makes no verified novelty claim.',
    question:
      'Among first-year students in one course, is weekly study time associated with final exam scores?',
    design:
      'This is an observational study of first-year students in one course. We will estimate the association using regression and report uncertainty. Causal effects cannot be established.',
    analysis:
      'The estimated slope was -0.2 points per hour, with a 95% confidence interval from -1.4 to 1.0. The interval includes zero. The planned regression was used.',
    interpretation:
      'More study time caused higher exam scores for all university students. This demonstrates a clear positive effect.',
  };
  for (const m of p.milestones) {
    if (artifacts[m.id]) {
      m.artifact = artifacts[m.id];
      m.version = 1;
    }
  }
  return p;
}
export function consistencyReply() {
  return {
    summary:
      'The conclusions exceed the observational design and conflict with the reported uncertain estimate.',
    findings: [
      {
        kind: 'mismatch',
        severity: 'high',
        dimension: 'design_causality',
        title: 'Causal conclusion exceeds the study design',
        explanation: 'An observational association does not establish a causal effect.',
        recommendation:
          'Revise the conclusion to describe an association and retain the design limitations.',
        references: [
          { stageId: 'design', field: 'artifact', quote: 'Causal effects cannot be established.' },
          {
            stageId: 'interpretation',
            field: 'artifact',
            quote: 'More study time caused higher exam scores for all university students.',
          },
        ],
      },
      {
        kind: 'mismatch',
        severity: 'high',
        dimension: 'results_conclusions',
        title: 'Positive certainty conflicts with the reported estimate',
        explanation:
          'The estimate is negative and its interval includes zero; the conclusion asserts a clear positive effect.',
        recommendation:
          'Report the direction and uncertainty of the estimate without claiming a demonstrated positive effect.',
        references: [
          {
            stageId: 'analysis',
            field: 'artifact',
            quote:
              'The estimated slope was -0.2 points per hour, with a 95% confidence interval from -1.4 to 1.0.',
          },
          {
            stageId: 'interpretation',
            field: 'artifact',
            quote: 'This demonstrates a clear positive effect.',
          },
        ],
      },
    ],
  };
}
