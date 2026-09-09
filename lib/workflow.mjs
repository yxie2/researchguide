import { randomUUID } from 'node:crypto';
import { requiresSupervisorReview, milestoneFinished } from '../public/workflow-flow.js';
import { importDataset, addAnalysisPlan, approvePlan } from './analysis.mjs';
import { decideConsistency, consistencyIsCurrent } from './consistency.mjs';
import { evidenceAction } from './evidence.mjs';

export const stages = [
  {
    id: 'question',
    title: 'Explore your research interest',
    short: 'Research interest',
    role: 'Methods mentor',
    deliverable: 'Research direction',
    purpose:
      'Describe a problem worth exploring and a preliminary direction. You will refine the question through literature reading in the next step.',
    prompts: [
      'What topic or practical problem interests you, and why?',
      'Who or what might you study, and what do you need to learn first?',
      'What access, time or resource constraints might affect feasibility?',
    ],
    understanding:
      'Why is this topic worth exploring, and which assumptions or unanswered questions should your initial reading examine?',
    example:
      '“I want to understand employee training and sales performance” is a useful starting direction. Read about measures, theories and study designs before claiming a research gap or settling on a final question.',
    template:
      'Topic or practical problem:\n\nWhy it matters:\n\nPossible setting or population:\n\nTentative questions (open to revision):\n\nWhat I need to learn from the literature:\n\nPossible data access and practical constraints:\n',
    checks: [
      'A meaningful interest or problem',
      'A preliminary scope and reading direction',
      'Unknowns and feasibility constraints acknowledged; no final question required',
    ],
  },
  {
    id: 'evidence',
    title: 'Review the literature and refine your question',
    short: 'Literature & question',
    role: 'Literature mentor',
    deliverable: 'Literature review and research question',
    purpose:
      'Read relevant scholarship, understand concepts and theories, identify a defensible contribution, and refine an answerable research question.',
    prompts: [
      'What is already known, and how do studies define the key concepts?',
      'Which theories, conflicting findings or methodological limitations matter?',
      'What question and feasible contribution follow from this reading?',
    ],
    understanding:
      'How did the literature change your starting assumptions, and why is your refined question worthwhile and answerable?',
    example:
      'A training study may motivate skill development as a mechanism, while another highlights employee selection. Use that contrast to refine the question and acknowledge what your available design cannot resolve. Do not claim a gap solely because a search was small.',
    template:
      'Search scope, terms and selection decisions:\n\nKey concepts and theoretical framework:\n\nSynthesis of inspected studies (cite source IDs):\n\nDisagreements and methodological limitations:\n\nUnresolved problem and proposed contribution:\n\nRefined research question and objectives:\n\nHypotheses, if appropriate (otherwise explain the exploratory aim):\n\nFeasibility and changes from the initial direction:\n',
    checks: [
      'Inspected sources and a reasoned synthesis, not just a list',
      'Relevant concepts or theory and a justified contribution; search limitations disclosed',
      'An explicit refined question and feasible objectives; hypotheses only when appropriate',
    ],
  },
  {
    id: 'design',
    title: 'Plan the study and methods',
    short: 'Study design',
    role: 'Methods mentor',
    deliverable: 'Study protocol',
    purpose:
      'Use the literature-informed question to choose a suitable design, sampling strategy, methods and ethical safeguards before the main study.',
    prompts: [
      'Which design and sampling approach fit the refined question?',
      'How will you collect or obtain data, define measures, and plan analysis?',
      'What permissions, safeguards, prior data exposure and practical constraints need attention?',
    ],
    understanding:
      'Why does your chosen method fit the question, and which assumption would most threaten your interpretation?',
    example:
      'When comparing existing groups, prior achievement could influence both group membership and outcomes. Document possible confounding and avoid automatically interpreting group differences as causal effects.',
    template:
      'Refined question and objectives carried from the literature review:\n\nDesign and sampling strategy:\n\nConcepts, measures or interview/observation approach:\n\nData access or collection plan:\n\nExclusions, missingness and analysis plan:\n\nPrior exposure to data/results:\n\nEthics, permissions, resources and limitations:\n',
    checks: [
      'Question and method aligned',
      'Exclusions and missingness planned',
      'Prior data exposure disclosed',
    ],
  },
  {
    id: 'data',
    title: 'Obtain and prepare your data',
    short: 'Data preparation',
    role: 'Data mentor',
    deliverable: 'Data preparation and quality report',
    purpose:
      'Obtain existing data or collect new material under the agreed protocol, then document provenance, preparation and quality before the main analysis.',
    prompts: [
      'Have the required permissions and collection arrangements been addressed?',
      'How were the data or materials obtained, organized and checked?',
      'What missingness, quality issues or protocol deviations need to be documented?',
    ],
    understanding:
      'Which data-quality issue could change your conclusion, and how will you handle it transparently?',
    example:
      'A score of 999 might mean “not recorded,” not an unusually high score. Check the data dictionary before computing a mean.',
    template:
      'Data access or collection record and permissions:\n\nDataset/material versions and provenance:\n\nVariables, coding or transcript preparation:\n\nMissingness, duplicates and quality checks:\n\nCleaning and preparation decisions:\n\nProtocol deviations and whether earlier decisions need revision:\n',
    checks: [
      'Dataset version recorded',
      'Missingness and ranges inspected',
      'Protocol deviations documented',
    ],
  },
  {
    id: 'analysis',
    title: 'Analyze your data',
    short: 'Data analysis',
    role: 'Analysis mentor',
    deliverable: 'Analysis record',
    purpose:
      'Apply the planned methods, inspect outputs and diagnostics, and keep an auditable record of planned and exploratory analysis.',
    prompts: [
      'Can another researcher follow or reproduce your analysis procedures?',
      'What do diagnostics or trustworthiness checks show?',
      'Which analyses were planned versus exploratory?',
    ],
    understanding:
      'How do your estimates or qualitative findings answer the question, what uncertainty remains, and which checks support your interpretation?',
    example:
      'Report the estimated difference and its uncertainty alongside the model assumptions. A statistically detectable effect can still be too small to matter in practice.',
    template:
      'Question and analysis approach:\n\nCode, coding procedures or analysis environment:\n\nData/material version and reproduction instructions:\n\nResults, estimates or themes:\n\nDiagnostics, uncertainty or trustworthiness checks:\n\nExploratory work and deviations from the plan:\n',
    checks: [
      'Run instructions and versions recorded',
      'Findings and uncertainty or trustworthiness addressed',
      'Exploratory work labeled',
    ],
  },
  {
    id: 'interpretation',
    title: 'Interpret findings in context',
    short: 'Interpretation',
    role: 'Critical reviewer',
    deliverable: 'Claims and limitations',
    purpose:
      'Answer the refined question by relating findings to the literature and theory, while explaining uncertainty, alternatives and limits.',
    prompts: [
      'What answer do the findings support, including null or conflicting results?',
      'How do they relate to prior studies and the theoretical framework?',
      'What alternatives, limitations and implications are justified?',
    ],
    understanding:
      'Give the strongest alternative explanation for your result and explain what your design can and cannot rule out.',
    example:
      '“Students who used the tool scored higher” describes an association. “The tool improved scores” adds a causal claim that requires a design capable of supporting it.',
    template:
      'Refined question → answer supported by results:\n\nSpecific claims and supporting outputs:\n\nRelationship to prior literature and theory:\n\nAlternative explanations and uncertainty:\n\nLimitations, scope and justified implications:\n\nWhat remains unknown:\n',
    checks: [
      'Claims linked to specific outputs',
      'Alternative explanations considered',
      'Null results and uncertainty retained',
    ],
  },
  {
    id: 'writing',
    title: 'Write, review and share your research',
    short: 'Report & share',
    role: 'Writing mentor',
    deliverable: 'Research package',
    purpose:
      'Bring writing developed throughout the study into a coherent report, review it with your supervisor, and prepare appropriate sharing or submission materials.',
    prompts: [
      'Does the report connect the motivation, literature, question, methods and findings?',
      'Do text, tables, citations and supporting files agree?',
      'What revisions, permissions and sharing restrictions remain?',
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
  return index >= 0 && project.milestones.slice(0, index).every(milestoneFinished);
}
export function readiness(project, id, { forReview = true } = {}) {
  const m = milestone(project, id),
    issues = [];
  if (!unlocked(project, id))
    issues.push(
      'Complete the preceding steps first: save and continue for routine work; record supervisor approval for the study protocol and final report.',
    );
  if (m.artifact.trim().length < 120)
    issues.push('Develop your artifact to at least 120 characters.');
  if (forReview && m.explanation.trim().length < 80)
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
  if (action.type === 'analysis_dataset') {
    importDataset(p, action);
    invalidate(p, 3, 'Dataset version added; data and downstream reviews need renewal.');
    record(p, 'dataset', 'CSV dataset version imported with permission statement.');
  } else if (action.type === 'dataset_notes') {
    const dataset = p.datasets?.find((d) => d.id === action.datasetId);
    if (!dataset) throw new WorkflowError('Choose a dataset stored in this project.');
    dataset.notes = text(action.notes, 'Dataset notes', 2000);
    record(p, 'dataset_notes', `Organizational notes updated for ${dataset.id}.`, {
      datasetId: dataset.id,
      notes: dataset.notes,
    });
  } else if (action.type === 'analysis_plan') {
    addAnalysisPlan(p, action);
    record(
      p,
      'analysis_plan',
      'Analysis plan and script proposed; execution requires explicit review.',
    );
  } else if (action.type === 'analysis_approve') {
    approvePlan(p, action);
    record(
      p,
      'analysis_approval',
      'Exact analysis plan and script approved for execution (local, unauthenticated).',
    );
  } else if (action.type === 'consistency_decision') {
    decideConsistency(p, action);
    record(
      p,
      'consistency_decision',
      'Researcher response to a consistency finding recorded; no milestone approval granted.',
      { reportId: action.reportId, findingId: action.findingId },
    );
  } else if (['paper_passage', 'claim_save', 'claim_confirm'].includes(action.type)) {
    evidenceAction(p, action);
    invalidate(p, 1, 'Evidence records changed; evidence and downstream reviews need renewal.');
    record(
      p,
      action.type,
      `Evidence action: ${action.type}. Researcher decisions are local and unauthenticated.`,
    );
  } else if (action.type === 'accept_draft') {
    const m = milestone(p, action.stageId);
    const turn = (m.conversation || []).find((t) => t.id === action.turnId);
    if (
      !turn?.draft ||
      turn.accepted ||
      turn !== m.conversation.at(-1) ||
      turn.artifactVersion !== m.version
    )
      throw new WorkflowError(
        'This draft is outdated or already accepted. Ask the guide for a new draft.',
        409,
      );
    const next = applyAction(p, {
      type: 'save',
      stageId: m.id,
      revision: p.revision,
      artifact: turn.draft,
      explanation: m.explanation,
    });
    milestone(next, m.id).conversation.find((t) => t.id === turn.id).accepted = true;
    return next;
  } else if (action.type === 'save') {
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
  } else if (action.type === 'complete') {
    const m = milestone(p, action.stageId);
    if (requiresSupervisorReview(m.id))
      throw new WorkflowError(
        'This checkpoint requires supervisor review; it cannot be self-completed.',
      );
    if (m.status === 'awaiting_review')
      throw new WorkflowError(
        'A supervisor review is already pending. Record its decision before continuing.',
      );
    if (m.reviews.at(-1)?.decision === 'revise' && m.reviews.at(-1).version === m.version)
      throw new WorkflowError(
        'Address the requested revisions and save an updated version before continuing.',
      );
    const issues = readiness(p, m.id, { forReview: false });
    if (issues.length) throw new WorkflowError(issues.join(' '));
    if (!milestoneFinished(m)) {
      m.status = 'completed';
      record(
        p,
        'completed',
        `${m.id} version ${m.version} marked ready by the researcher; not supervisor approval.`,
        { stageId: m.id, version: m.version },
      );
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
export function analysisUpdated(input, message, run = false) {
  const p = structuredClone(input);
  if (run) invalidate(p, 4, 'New execution record; analysis and downstream reviews need renewal.');
  record(p, 'analysis_execution', message);
  p.revision += 1;
  return p;
}
export function evidenceUpdated(input, message) {
  const p = structuredClone(input);
  invalidate(p, 1, message);
  record(p, 'evidence', message);
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
      `Passage (${s.provenance || 'manual-unverified'}; scientific support not verified): ${s.passage}`,
      ...(s.paperId ? [`Paper ID: ${s.paperId}; SHA-256: ${s.sha256}`] : []),
    );
  lines.push(
    '',
    '## Literature discovery and reading list',
    'Retrieved records and AI reading suggestions are not inspected evidence or a systematic review.',
  );
  for (const search of p.literatureSearches || []) {
    lines.push(
      '',
      `### ${search.query} — ${search.at}`,
      `Catalogues: ${search.catalogues.join(', ')}`,
      ...search.warnings,
    );
    for (const paper of search.results) {
      const suggestion = search.assessment?.suggestions.find((s) => s.id === paper.id);
      lines.push(
        '',
        `${paper.authors} (${paper.year}). ${paper.title}. ${paper.journal}.`,
        paper.url,
        paper.repositoryUrl || '',
        paper.arxivUrl ? `arXiv version (publication status not verified): ${paper.arxivUrl}` : '',
        paper.access,
        `Reading list: ${paper.readingList ? 'yes' : 'no'}; researcher note: ${paper.note || 'none'}`,
        suggestion
          ? `AI suggestion (${search.assessment.at}; verify against current interest): ${suggestion.priority}; ${suggestion.reason} Read to check: ${suggestion.readFor}`
          : 'No AI assessment.',
      );
    }
  }
  lines.push(
    '',
    '## Public dataset discovery',
    'Catalogue candidates are not imported data or verified permissions.',
  );
  for (const search of p.dataSearches || []) {
    lines.push('', `### ${search.query}`, `${search.provider}; searched ${search.at}`);
    for (const candidate of search.results)
      lines.push(
        '',
        candidate.title,
        candidate.url,
        candidate.description,
        candidate.citation,
        candidate.access,
        `Shortlisted: ${candidate.shortlisted ? 'yes' : 'no'}; decision: ${candidate.note || 'not recorded'}`,
        candidate.assessment
          ? `AI assessment (${candidate.assessment.at}; verify context in project backup): ${candidate.assessment.text}`
          : 'No AI assessment.',
      );
  }
  lines.push('', '## Claim–evidence ledger');
  for (const c of p.claims || []) {
    lines.push(
      '',
      `### ${c.id} v${c.version}: ${c.claim}`,
      `Linked passages: ${c.sourceIds.join(', ')}`,
    );
    for (const h of c.history || [])
      lines.push(`Earlier claim v${h.version}: ${h.claim} (passages: ${h.sourceIds.join(', ')})`);
    for (const a of c.assessments) {
      lines.push(`AI suggestion (${a.model}, claim v${a.claimVersion}): ${a.verdict}`, a.rationale);
      for (const relation of a.sources)
        lines.push(`${relation.sourceId}: ${relation.relation} — ${relation.reason}`);
      if (a.suggestedClaim)
        lines.push(`Suggested wording (not automatically applied): ${a.suggestedClaim}`);
      for (const f of a.confirmations || [])
        lines.push(`Local researcher decision (${f.name}, ${f.at}): ${f.decision}. ${f.note}`);
    }
  }
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
    for (const t of m.conversation || []) {
      lines.push(
        '',
        '### Guided conversation',
        `${t.at} — ${t.model}; artifact v${t.artifactVersion}`,
        `Researcher: ${t.message}`,
        `Guide: ${t.reply}`,
        `Next question: ${t.question}`,
        `Unresolved: ${t.gaps.join('; ')}`,
      );
      if (t.draft)
        lines.push(`Proposed draft (${t.accepted ? 'accepted' : 'not accepted'}):`, t.draft);
    }
    for (const r of m.reviews)
      lines.push(
        `- ${r.at} — ${r.reviewer}: ${r.decision} on v${r.version} (local, unauthenticated). ${r.note}`,
      );
  }
  lines.push('', '## Reproducible analysis');
  for (const dataset of p.datasets || [])
    lines.push(
      `Dataset ${dataset.id}: ${dataset.name}; ${dataset.rowCount} rows; SHA-256 ${dataset.sha256}. Permission: ${dataset.permission}`,
      `Origin: ${dataset.origin?.kind || 'upload (legacy record)'}; original filename: ${dataset.origin?.filename || 'not recorded'}.`,
      ...(dataset.origin?.kind === 'dataverse'
        ? [dataset.origin.url, dataset.origin.citation, dataset.origin.linkage]
        : []),
      `Workspace notes: ${dataset.notes || 'none'}`,
    );
  for (const plan of p.analysisPlans || []) {
    lines.push(
      '',
      `### Plan ${plan.id}: ${plan.method}`,
      `Dataset ${plan.datasetId}; outcome column index ${plan.outcome}; predictor ${plan.predictor ?? 'none'}`,
      plan.rationale,
      `Plan SHA-256 ${plan.planHash}; script SHA-256 ${plan.scriptHash}`,
      '```r',
      plan.script,
      '```',
    );
    for (const approval of plan.approvals)
      lines.push(`Local execution approval by ${approval.name} (${approval.at}): ${approval.note}`);
  }
  for (const run of p.analysisRuns || []) {
    lines.push(
      '',
      `### Run ${run.id}: ${run.status}`,
      `Plan ${run.planId}; dataset SHA-256 ${run.datasetHash}; script SHA-256 ${run.scriptHash}`,
      `${run.engine}; ${run.rVersion || 'runtime failed'}; ${run.startedAt}`,
      '```text',
      run.log,
      '```',
    );
    for (const name of [
      'counts.csv',
      'descriptives.csv',
      'coefficients.csv',
      'fit.csv',
      'session.txt',
    ])
      if (run.files[name]) lines.push(`Output: ${name}`, '```text', run.files[name], '```');
  }
  lines.push('', '## Cross-milestone consistency reviews');
  for (const report of p.consistencyReports || []) {
    lines.push(
      '',
      `### ${report.at} — ${report.model} (${consistencyIsCurrent(p, report) ? 'matches current artifacts' : 'outdated'})`,
      `Review scope: through ${report.throughStage || 'writing'}; later stages excluded.`,
      report.summary,
      `Missing core milestones: ${report.missing.join(', ') || 'none'}`,
      `Reviewed versions: ${report.snapshot.map((s) => `${s.id} v${s.version}`).join(', ')}`,
    );
    if (!report.findings.length)
      lines.push('No issue identified by the model; not a certification of scientific rigor.');
    for (const f of report.findings) {
      lines.push(
        `#### ${f.id}: ${f.title} (${f.severity}; ${f.kind})`,
        f.explanation,
        `Suggested action: ${f.recommendation}`,
      );
      for (const ref of f.references)
        lines.push(`${ref.stageId} v${ref.version}, ${ref.field}: ${ref.quote}`);
      for (const d of f.decisions)
        lines.push(`Local researcher ${d.name} (${d.at}): ${d.decision}. ${d.note}`);
    }
  }
  lines.push('', '## Activity log');
  for (const e of p.events) lines.push(`- ${e.at}: ${e.message}`);
  return lines.join('\n');
}
