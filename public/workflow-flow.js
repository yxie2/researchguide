// Presentation guidance only. Scientific decisions and server review gates remain separate.
const discuss = [
  'conversation',
  'Discuss this step with your guide',
  'Use earlier decisions to develop the work through conversation.',
];
const write = [
  'workspace',
  'Write and explain your decisions',
  'Review the document, explain the reasoning in your own words, and save it.',
];
const critique = [
  'guide',
  'Get mentor feedback',
  'Ask the research team to challenge assumptions and suggest improvements.',
];
const check = [
  'consistency',
  'Check alignment with the study',
  'Compare saved decisions and outputs; investigate findings and record your response.',
];
const review = [
  'review',
  'Request and record supervisor review',
  'Submit the saved version and keep the reviewer’s decision with it.',
];
const sources = [
  'sources',
  'Inspect sources and save passages',
  'Upload papers or add source records, then preserve the passages you inspected.',
];
const claims = [
  'claims',
  'Check claims against source passages',
  'Link literature claims to inspected excerpts and record your judgment.',
];
const data = [
  'execution',
  'Import and inspect your data',
  'For a supported numeric study, import a CSV and inspect ranges and missing values.',
];
const analysis = [
  'execution',
  'Review the plan and run the analysis',
  'Review the exact script, approve execution, and inspect the recorded R results.',
];
const flows = {
  question: [discuss, write, critique, review],
  evidence: [discuss, sources, claims, write, critique, review],
  design: [discuss, write, critique, check, review],
  data: [discuss, data, write, check, review],
  analysis: [discuss, analysis, write, critique, check, review],
  interpretation: [discuss, write, claims, check, critique, review],
  writing: [
    discuss,
    write,
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
export function recommendTask(project, id, provider) {
  const m = project.milestones.find((s) => s.id === id);
  if (m.status === 'approved')
    return {
      id: id === 'writing' ? 'export' : 'continue',
      reason: 'This version has a recorded local approval. Continue when you are ready.',
    };
  if (m.status === 'awaiting_review')
    return { id: 'review', reason: 'The saved document is awaiting a supervisor decision.' };
  if (m.status === 'needs_revision')
    return {
      id: 'workspace',
      reason:
        'This step needs renewed review after a change or reviewer feedback. Check the document and its reasoning first.',
    };
  const latest = m.conversation?.at(-1);
  if (latest?.draft && latest.artifactVersion === m.version && !latest.accepted)
    return {
      id: 'conversation',
      reason: 'Your guide proposed a draft. Inspect it and decide whether to accept or revise it.',
    };
  if (!m.artifact.trim())
    return {
      id: provider === 'demo' ? 'workspace' : 'conversation',
      reason:
        provider === 'demo'
          ? 'No model is connected. Start the document yourself, or connect a model in LLM settings for conversational guidance.'
          : 'Begin with your guide. The conversation uses saved decisions from earlier steps.',
    };
  if (id === 'evidence' && !project.sources.length)
    return {
      id: 'sources',
      reason: 'The evidence map needs an inspected source passage before it can be submitted.',
    };
  if (!m.explanation.trim())
    return {
      id: 'workspace',
      reason: 'Add your own explanation of why these research decisions are appropriate.',
    };
  if (
    id === 'analysis' &&
    (project.datasets || []).length &&
    !(project.analysisRuns || []).some(
      (r) =>
        r.status === 'succeeded' &&
        r.contextVersions.every(
          (s) => project.milestones.find((m) => m.id === s.id)?.version === s.version,
        ),
    )
  )
    return {
      id: 'execution',
      reason:
        'There is an imported dataset but no successful run matching the current study context. Review and execute a supported plan, or document results from your own analysis environment.',
    };
  const report = project.consistencyReports?.at(-1);
  if (
    workflowFor(id).some(([task]) => task === 'consistency') &&
    report &&
    report.snapshot.some((s) =>
      s.id === 'execution'
        ? s.version !== (project.analysisRuns || []).length
        : project.milestones.find((m) => m.id === s.id)?.version !== s.version,
    )
  )
    return {
      id: 'consistency',
      reason:
        'Earlier consistency findings refer to changed versions. Run a fresh check on the saved study before relying on those findings.',
    };
  return {
    id: 'review',
    reason:
      'Review the saved document and any relevant checks, then request a supervisor decision. This suggestion does not certify completeness or quality.',
  };
}
