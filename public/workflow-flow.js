// Shared progression policy; task suggestions are not scientific validation.
export const requiresSupervisorReview = (id) => ['design', 'writing'].includes(id);
export const milestoneFinished = (m) =>
  m.status === 'approved' || (m.status === 'completed' && !requiresSupervisorReview(m.id));
const document = (title, description) => ['workspace', title, description];
const check = [
  'consistency',
  'Check alignment with the study (optional AI check)',
  'Compare saved decisions and outputs; investigate findings and record your response.',
];
const review = [
  'review',
  'Review the final report with your supervisor',
  'Resolve outstanding concerns and record the reviewer’s decision on the saved research package.',
];
const sources = [
  'sources',
  'Inspect sources and save passages',
  'Upload papers or add source records, then preserve the passages you inspected.',
];
const data = [
  'execution',
  'Manage your project data workspace',
  'Keep multiple uploaded datasets and public-data candidates together, record their origins, and inspect each CSV before analysis.',
];
const analysis = [
  'execution',
  'Run and inspect your analysis',
  'For supported CSV analyses, review and approve the exact script, then inspect the R results. If you analyze elsewhere, record those methods and results in the next task.',
];
const flows = {
  question: [
    [
      'conversation',
      'Explore a topic with your guide (optional)',
      'Discuss your interests and practical constraints, or go straight to recording your direction.',
    ],
    document(
      'Save a direction for your reading',
      'Record your interest, motivation and what you need to learn. Save and continue; a final question and supervisor sign-off are not required here.',
    ),
  ],
  evidence: [
    [
      'literature',
      'Find literature for your research interest (optional)',
      'Ask the agent to search public scholarly catalogues and suggest a reading order, or upload papers you already have in the next task.',
    ],
    sources,
    document(
      'Synthesize the literature and refine your question',
      'Connect inspected studies and theory, identify a feasible contribution, and save a clear question and objectives. Use the optional claim ledger for claims that need closer checking.',
    ),
  ],
  design: [
    document(
      'Develop the study protocol',
      'Specify sampling, measures, data access, planned analysis and safeguards. Explain the key methodological choices for your supervisor.',
    ),
    [
      'consistency',
      'Can these methods answer your question? (optional)',
      'Check the proposed sample, measures and analysis against the refined question. This is a planning check; findings are not expected yet.',
    ],
    [
      'review',
      'Review the protocol with your supervisor',
      'Record approval of the current protocol before completing data preparation. This local checkpoint does not replace institutional ethics or access permissions.',
    ],
  ],
  data: [
    [
      'discovery',
      'Find relevant public datasets (optional)',
      'Search a public catalogue and assess candidates, or skip this task if you already have data.',
    ],
    data,
    document(
      'Record preparation and data quality',
      'Document cleaning, missingness, exclusions, access and deviations from the protocol. Save and continue when the data are ready; revisit the design if the methods change.',
    ),
  ],
  analysis: [
    analysis,
    document(
      'Record results and analysis checks',
      'Preserve outputs, uncertainty, diagnostics and departures from the plan. You can document analyses performed outside the app. Save and continue to interpretation.',
    ),
  ],
  interpretation: [
    document(
      'Answer the question and explain the limitations',
      'Use recorded results to answer the refined question, relate findings to the literature, and consider alternative explanations.',
    ),
    check,
  ],
  writing: [
    document(
      'Assemble and revise the research report',
      'Bring earlier writing, results and limitations together. Add data/code availability and contribution statements; explain key decisions for final review.',
    ),
    check,
    review,
    [
      'export',
      'Export the research package',
      'Download a readable report and a project backup with supporting materials.',
    ],
  ],
};
export const workflowFor = (id) => flows[id];
export const studyContextCurrent = (project, record) =>
  ['question', 'evidence', 'design', 'data'].every(
    (id) =>
      record.contextVersions.find((s) => s.id === id)?.version ===
      project.milestones.find((m) => m.id === id).version,
  );
export function recommendTask(project, id, provider) {
  const m = project.milestones.find((s) => s.id === id);
  if (milestoneFinished(m))
    return {
      id: id === 'writing' ? 'export' : 'continue',
      reason:
        m.status === 'completed'
          ? 'You marked this saved version ready to continue. This is researcher completion, not supervisor approval.'
          : 'This version has a recorded local approval. Continue when you are ready.',
    };
  if (m.status === 'awaiting_review')
    return { id: 'review', reason: 'The saved document is awaiting a supervisor decision.' };
  if (m.status === 'needs_revision')
    return {
      id: 'workspace',
      reason:
        'Earlier work or feedback changed. Revisit the saved document, address the changes and renew completion or review as appropriate.',
    };
  const latest = m.conversation?.at(-1);
  if (latest?.draft && latest.artifactVersion === m.version && !latest.accepted)
    return {
      id: 'conversation',
      reason: 'Your guide proposed a draft. Inspect it and decide whether to accept or revise it.',
    };
  if (!m.artifact.trim())
    return {
      id:
        id === 'question'
          ? provider === 'demo'
            ? 'workspace'
            : 'conversation'
          : id === 'evidence'
            ? project.literatureSearches?.length || project.sources.length
              ? 'sources'
              : 'literature'
            : id === 'data' || (id === 'analysis' && project.datasets?.length)
              ? 'execution'
              : 'workspace',
      reason:
        'Start with this stage’s research task. Your guide and mentor feedback are available when you need help; a separate AI conversation is not required.',
    };
  if (id === 'evidence' && !project.sources.length)
    return {
      id: 'sources',
      reason:
        'The literature review needs an inspected source passage before it can be submitted. Use reading to develop and justify the refined question.',
    };
  if (requiresSupervisorReview(id) && !m.explanation.trim())
    return {
      id: 'workspace',
      reason: 'Add your own explanation of why these research decisions are appropriate.',
    };
  if (
    id === 'analysis' &&
    (project.datasets || []).length &&
    !(project.analysisRuns || []).some(
      (r) => r.status === 'succeeded' && studyContextCurrent(project, r),
    )
  )
    return {
      id: 'execution',
      reason:
        'There is an imported dataset but no successful run matching the current study context. Review and execute a supported plan, or document results from your own analysis environment.',
    };
  const report = project.consistencyReports?.at(-1);
  if (
    ['design', 'data', 'analysis', 'interpretation', 'writing'].includes(id) &&
    report &&
    (!report.snapshot.some((s) => s.id === 'evidence') ||
      report.snapshot.some((s) =>
        s.id === 'execution'
          ? s.version !== (project.analysisRuns || []).length
          : project.milestones.find((m) => m.id === s.id)?.version !== s.version,
      ))
  )
    return {
      id: 'consistency',
      reason:
        'Earlier consistency findings refer to changed versions. Run a fresh check on the saved study before relying on those findings.',
    };
  return {
    id: requiresSupervisorReview(id) ? 'review' : 'workspace',
    reason: requiresSupervisorReview(id)
      ? 'Review the saved document and request a supervisor decision at this checkpoint. AI feedback cannot approve the study.'
      : 'Check the saved work, then use Save and continue. Extra mentor feedback or supervisor review is available if you need it; completion does not certify scientific quality.',
  };
}
