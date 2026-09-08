import { randomUUID } from 'node:crypto';

export const stages = [
  {
    id: 'question',
    title: 'Frame your question',
    short: 'Question',
    role: 'Methods mentor',
    deliverable: 'Research brief',
    purpose: 'Turn a broad interest into a question your available data can actually answer.',
    prompts: [
      'What population and outcome will you study?',
      'What comparison or relationship matters?',
      'What would count as an answer, including a null result?',
    ],
    understanding:
      'Why is your question answerable with these data, and what would this study fail to establish?',
    example:
      'Instead of “Does feedback improve learning?”, ask “In this dataset, how is feedback frequency associated with end-of-term scores among first-year students?” An association alone would not establish that feedback caused the difference.',
    template:
      'Research question:\n\nPopulation and setting:\n\nOutcome and comparison:\n\nAvailable dataset and permissions:\n\nContribution and boundaries:\n',
    checks: [
      'An explicit population and outcome',
      'A feasible data source',
      'A question that allows more than one answer',
    ],
  },
  {
    id: 'evidence',
    title: 'Understand the evidence',
    short: 'Evidence',
    role: 'Evidence mentor',
    deliverable: 'Evidence map',
    purpose:
      'Build a reasoned foundation from sources you have inspected, including findings that disagree.',
    prompts: [
      'Which studies address your question?',
      'How do their methods and populations differ?',
      'What evidence challenges your starting assumptions?',
    ],
    understanding:
      'Which source most challenges your expectation, and how does its design affect what you can conclude?',
    example:
      'Two studies may disagree because one measures immediate performance and the other measures retention weeks later. Record this difference instead of counting positive and negative papers.',
    template:
      'Search scope and terms:\n\nRelevant findings (cite source IDs):\n\nContradictory evidence:\n\nMethodological limitations:\n\nRemaining gap:\n',
    checks: [
      'At least one linked source with an inspected passage',
      'Findings distinguished from interpretations',
      'Conflicting evidence or search limitations recorded',
    ],
  },
  {
    id: 'design',
    title: 'Design a defensible study',
    short: 'Design',
    role: 'Methods mentor',
    deliverable: 'Study protocol',
    purpose: 'Decide how to answer the question before choosing analyses based on their results.',
    prompts: [
      'How do variables represent your concepts?',
      'How will missing data and exclusions be handled?',
      'What have you already seen in these data?',
    ],
    understanding:
      'Why does your chosen method fit the question, and which assumption would most threaten your interpretation?',
    example:
      'When comparing existing groups, prior achievement could influence both group membership and outcomes. Document possible confounding and avoid automatically interpreting group differences as causal effects.',
    template:
      'Variables and definitions:\n\nDesign and comparison:\n\nExclusion and missing-data plan:\n\nAnalysis plan and assumptions:\n\nPrior exposure to data/results:\n\nLimitations and required permissions:\n',
    checks: [
      'Question and method aligned',
      'Exclusions and missingness planned',
      'Prior data exposure disclosed',
    ],
  },
  {
    id: 'data',
    title: 'Inspect your data',
    short: 'Data',
    role: 'Data mentor',
    deliverable: 'Data quality report',
    purpose: 'Find out what your dataset can support and document its limitations before analysis.',
    prompts: [
      'Are units, ranges, and identifiers consistent?',
      'Where are values missing?',
      'Do observations match your planned population?',
    ],
    understanding:
      'Which data-quality issue could change your conclusion, and how will you handle it transparently?',
    example:
      'A score of 999 might mean “not recorded,” not an unusually high score. Check the data dictionary before computing a mean.',
    template:
      'Dataset version and provenance:\n\nVariables and valid ranges:\n\nMissingness and duplicates:\n\nObserved quality issues:\n\nChanges proposed to protocol:\n',
    checks: [
      'Dataset version recorded',
      'Missingness and ranges inspected',
      'Protocol deviations documented',
    ],
  },
  {
    id: 'analysis',
    title: 'Analyze with intention',
    short: 'Analysis',
    role: 'Analysis mentor',
    deliverable: 'Analysis record',
    purpose:
      'Run your approved plan in your own analysis environment and bring back reproducible evidence.',
    prompts: [
      'Can someone rerun your code?',
      'What do the diagnostics show?',
      'Which analyses were planned versus exploratory?',
    ],
    understanding:
      'What do your estimates and uncertainty mean, and why would a small p-value alone be insufficient?',
    example:
      'Report the estimated difference and its uncertainty alongside the model assumptions. A statistically detectable effect can still be too small to matter in practice.',
    template:
      'Code location and environment:\n\nData version and run instructions:\n\nPlanned analysis outputs:\n\nDiagnostics and uncertainty:\n\nExploratory analyses and deviations:\n',
    checks: [
      'Run instructions and versions recorded',
      'Estimates and uncertainty reported',
      'Exploratory work labeled',
    ],
  },
  {
    id: 'interpretation',
    title: 'Make defensible claims',
    short: 'Interpretation',
    role: 'Critical reviewer',
    deliverable: 'Claims and limitations',
    purpose:
      'Connect every conclusion to evidence and consider explanations your design cannot rule out.',
    prompts: [
      'Which result supports each claim?',
      'What competing explanation remains?',
      'Where do the findings not generalize?',
    ],
    understanding:
      'Give the strongest alternative explanation for your result and explain what your design can and cannot rule out.',
    example:
      '“Students who used the tool scored higher” describes an association. “The tool improved scores” adds a causal claim that requires a design capable of supporting it.',
    template:
      'Claim → supporting output:\n\nAlternative explanations:\n\nNull or conflicting findings:\n\nLimitations and generalizability:\n\nWhat remains unknown:\n',
    checks: [
      'Claims linked to specific outputs',
      'Alternative explanations considered',
      'Null results and uncertainty retained',
    ],
  },
  {
    id: 'writing',
    title: 'Share the complete work',
    short: 'Research package',
    role: 'Writing mentor',
    deliverable: 'Research package',
    purpose: 'Prepare a manuscript and supporting materials that another researcher can inspect.',
    prompts: [
      'Do the text, tables, and figures agree?',
      'Are methods and deviations disclosed?',
      'What can you share under the data license?',
    ],
    understanding:
      'How could another researcher check your main claim, and what access or methodological limitations would remain?',
    example:
      'A complete package includes a clear question, protocol, source list, analysis instructions, outputs, limitations, and disclosure of AI contributions. Sharing still needs the appropriate permissions.',
    template:
      'Manuscript location and summary:\n\nConsistency checks:\n\nCode/data availability and restrictions:\n\nReproduction instructions:\n\nAI and human contributions:\n\nOutstanding supervisor decisions:\n',
    checks: [
      'Claims consistent with outputs',
      'Materials and restrictions documented',
      'Contributions and limitations disclosed',
    ],
  },
];

export class WorkflowError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function text(value, name, max = 20000) {
  if (typeof value !== 'string' || value.length > max)
    throw new WorkflowError(`${name} must be text of at most ${max} characters.`);
  return value.trim();
}
function record(project, type, message, extra = {}) {
  project.events.push({ id: randomUUID(), at: new Date().toISOString(), type, message, ...extra });
}
export function createProject(title = 'My first research project', question = '') {
  const p = {
    schemaVersion: 1,
    id: randomUUID(),
    revision: 0,
    title: text(title, 'Title', 160) || 'My first research project',
    question: text(question, 'Question', 2000),
    createdAt: new Date().toISOString(),
    sources: [],
    milestones: stages.map((s) => ({
      id: s.id,
      artifact: '',
      explanation: '',
      version: 0,
      status: 'draft',
      reviews: [],
      history: [],
      guideRuns: [],
    })),
    events: [],
  };
  record(
    p,
    'created',
    'Research project created. Supervisor review is a local demonstration, not authenticated approval.',
  );
  return p;
}
export function milestone(project, id) {
  const m = project.milestones.find((s) => s.id === id);
  if (!m) throw new WorkflowError('Unknown milestone.');
  return m;
}
export function unlocked(project, id) {
  const index = stages.findIndex((s) => s.id === id);
  return index >= 0 && project.milestones.slice(0, index).every((s) => s.status === 'approved');
}
export function readiness(project, id) {
  const m = milestone(project, id),
    issues = [];
  if (!unlocked(project, id)) issues.push('Complete the preceding supervisor reviews first.');
  if (m.artifact.trim().length < 120)
    issues.push('Develop your artifact to at least 120 characters.');
  if (m.explanation.trim().length < 80)
    issues.push('Explain your choices in your own words (at least 80 characters).');
  if (id === 'evidence' && !project.sources.length)
    issues.push('Add at least one source with a passage you inspected.');
  return issues;
}
function invalidate(project, start, reason, preserveCurrentDraft = false) {
  for (const [offset, m] of project.milestones.slice(start).entries()) {
    if (m.status !== 'draft' || (m.version > 0 && !(preserveCurrentDraft && offset === 0)))
      m.status = 'needs_revision';
  }
  record(project, 'invalidation', reason);
}
export function applyAction(input, action) {
  const p = structuredClone(input);
  if (!action || typeof action !== 'object') throw new WorkflowError('Action required.');
  if (action.revision !== p.revision)
    throw new WorkflowError('The project changed in another tab. Reload before trying again.', 409);
  if (action.type === 'save') {
    const m = milestone(p, action.stageId);
    const artifact = text(action.artifact, 'Artifact'),
      explanation = text(action.explanation, 'Explanation', 10000);
    if (artifact !== m.artifact || explanation !== m.explanation) {
      m.history.push({
        version: m.version,
        artifact: m.artifact,
        explanation: m.explanation,
        at: new Date().toISOString(),
      });
      m.artifact = artifact;
      m.explanation = explanation;
      m.version += 1;
      invalidate(
        p,
        stages.findIndex((s) => s.id === m.id),
        `${stages.find((s) => s.id === m.id).deliverable} changed; this and downstream reviews need renewal.`,
        true,
      );
      record(p, 'saved', `Saved ${m.id} version ${m.version}.`, {
        stageId: m.id,
        version: m.version,
      });
    }
  } else if (action.type === 'submit') {
    const m = milestone(p, action.stageId),
      issues = readiness(p, m.id);
    if (issues.length) throw new WorkflowError(issues.join(' '));
    if (m.status === 'approved' || m.status === 'awaiting_review')
      throw new WorkflowError('This version has already been submitted.');
    m.status = 'awaiting_review';
    record(p, 'submitted', `${m.id} version ${m.version} submitted for local supervisor review.`, {
      stageId: m.id,
      version: m.version,
    });
  } else if (action.type === 'review') {
    const m = milestone(p, action.stageId);
    if (m.status !== 'awaiting_review' || !unlocked(p, m.id))
      throw new WorkflowError('Submit the current version before reviewing it.');
    const reviewer = text(action.reviewer, 'Reviewer', 100),
      note = text(action.note, 'Review note', 4000);
    if (!reviewer || note.length < 20)
      throw new WorkflowError(
        'Enter a reviewer name and a substantive review note (at least 20 characters).',
      );
    if (!['approve', 'revise'].includes(action.decision))
      throw new WorkflowError('Choose approve or request revision.');
    const review = {
      id: randomUUID(),
      reviewer,
      note,
      decision: action.decision,
      version: m.version,
      at: new Date().toISOString(),
      authenticated: false,
    };
    m.reviews.push(review);
    m.status = action.decision === 'approve' ? 'approved' : 'needs_revision';
    record(
      p,
      'reviewed',
      `${reviewer} ${action.decision === 'approve' ? 'approved' : 'requested revision of'} ${m.id} v${m.version} (local demo).`,
      { stageId: m.id, reviewId: review.id },
    );
  } else if (action.type === 'source') {
    if (p.sources.length >= 100)
      throw new WorkflowError('This prototype supports up to 100 sources.');
    const title = text(action.title, 'Source title', 300),
      url = text(action.url, 'URL', 2000),
      passage = text(action.passage, 'Source passage', 8000),
      location = text(action.location, 'Location', 300);
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new WorkflowError('Use a complete http or https source URL.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
      throw new WorkflowError('Use an http or https URL without credentials.');
    if (!title || passage.length < 20 || !location)
      throw new WorkflowError(
        'Add a title, page/section location, and inspected passage of at least 20 characters.',
      );
    const source = {
      id: `S${p.sources.length + 1}`,
      title,
      url,
      passage,
      location,
      verified: false,
      addedAt: new Date().toISOString(),
    };
    p.sources.push(source);
    invalidate(p, 1, `Source ${source.id} added; evidence and downstream milestones need review.`);
    record(
      p,
      'source_added',
      `Added ${source.id}: ${title}. User-provided source; not independently verified.`,
    );
  } else throw new WorkflowError('Unknown action.');
  p.revision += 1;
  return p;
}
export function appendGuide(input, stageId, run) {
  const p = structuredClone(input),
    m = milestone(p, stageId);
  m.guideRuns.push({ ...run, artifactVersion: m.version });
  if (m.guideRuns.length > 20) m.guideRuns.shift();
  record(
    p,
    'guide',
    `${run.mode} guidance on ${stageId} v${m.version}; no approval or scientific validation granted.`,
    { stageId, runId: run.id },
  );
  p.revision += 1;
  return p;
}
export function exportMarkdown(p) {
  const lines = [
    `# ${p.title}`,
    '',
    p.question,
    '',
    '> ResearchGuide prototype export. Local reviews are not authenticated. Guidance is not scientific validation.',
    '',
    '## Sources',
  ];
  for (const s of p.sources)
    lines.push(
      '',
      `### ${s.id}: ${s.title}`,
      s.url,
      `Location: ${s.location}`,
      `User-provided passage (unverified): ${s.passage}`,
    );
  for (const s of stages) {
    const m = milestone(p, s.id);
    lines.push(
      '',
      `## ${s.title}`,
      `Status: ${m.status}; version: ${m.version}`,
      '',
      m.artifact || '(No artifact yet)',
      '',
      '### Student explanation',
      m.explanation || '(No explanation yet)',
      '',
      '### Review history',
    );
    for (const r of m.reviews)
      lines.push(
        `- ${r.at} — ${r.reviewer}: ${r.decision} on v${r.version} (local, unauthenticated). ${r.note}`,
      );
  }
  lines.push('', '## Activity log');
  for (const e of p.events) lines.push(`- ${e.at}: ${e.message}`);
  return lines.join('\n');
}
