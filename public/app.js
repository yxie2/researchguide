const $ = (selector) => document.querySelector(selector);
const root = $('#app');
let project,
  stages = [],
  mode = 'demo',
  model = null,
  modelSettings,
  settingsDraft,
  selected = 'question',
  tab = 'conversation',
  draft,
  busy = false,
  newProject = false,
  noticeTimer;
let selectedConsistencyId, analysisDatasetId, analysisPlanId;
let analysisManualOpen = false;
let analysisDraft = { method: 'descriptive', outcome: null, predictor: null, rationale: '' };
let selectedPaperId,
  selectedPaperPage = 1,
  claimEditor = { claim: '', sourceIds: [] };
const labels = {
  draft: 'Draft',
  needs_revision: 'Needs revision',
  awaiting_review: 'Awaiting review',
  approved: 'Approved',
};
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key.startsWith('aria-') && value != null) node.setAttribute(key, String(value));
    else if (value !== false && value != null)
      node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity))
    if (child !== false && child != null)
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
function button(label, handler, kind = '', attrs = {}) {
  return el(
    'button',
    { className: `button ${kind}`, type: 'button', onClick: handler, disabled: busy, ...attrs },
    label,
  );
}
function notice(message) {
  clearTimeout(noticeTimer);
  $('#notice').textContent = message;
  noticeTimer = setTimeout(() => ($('#notice').textContent = ''), 9000);
}
async function api(url, payload) {
  const r = await fetch(
    url,
    payload
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      : {},
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Could not complete the request.');
  return data;
}
const current = () => project.milestones.find((s) => s.id === selected);
const stage = () => stages.find((s) => s.id === selected);
function isDirty() {
  return (
    draft && (draft.artifact !== current().artifact || draft.explanation !== current().explanation)
  );
}
function isUnlocked(id) {
  return project.milestones
    .slice(
      0,
      stages.findIndex((s) => s.id === id),
    )
    .every((m) => m.status === 'approved');
}
function date(value) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
async function mutate(action) {
  const response = await api('/api/action', { ...action, revision: project.revision });
  project = response.project;
}
async function perform(work, message) {
  if (busy) return;
  const inputs = [...document.querySelectorAll('input[id], textarea[id], select[id]')]
    .filter((node) => node.type !== 'file')
    .map((node) => [node.id, node.value, node.type === 'checkbox' ? node.checked : null]);
  let failed = false;
  busy = true;
  render();
  try {
    await work();
    if (message) notice(message);
  } catch (error) {
    failed = true;
    notice(error.message);
  } finally {
    busy = false;
    render();
    if (failed)
      for (const [id, value, checked] of inputs) {
        const node = document.getElementById(id);
        if (node) {
          node.value = value;
          if (checked !== null) node.checked = checked;
        }
      }
  }
}
async function saveDraft() {
  await mutate({ type: 'save', stageId: selected, ...draft });
  draft = { artifact: current().artifact, explanation: current().explanation };
}
function navigate(id) {
  if (busy) return;
  if (isDirty() && !confirm('Discard unsaved edits to this milestone? Save first to keep them.'))
    return;
  selected = id;
  draft = null;
  tab = 'conversation';
  newProject = false;
  render();
}
function field(id, title, hint, value = '', multiline = false, attrs = {}) {
  return el(
    'div',
    { className: 'form-row' },
    el(
      'label',
      { className: 'field', for: id },
      title,
      hint && el('span', { className: 'help' }, hint),
    ),
    el(multiline ? 'textarea' : 'input', { id, name: id, value, disabled: busy, ...attrs }),
  );
}
function heading() {
  const s = stage(),
    m = current(),
    index = stages.indexOf(s);
  return el(
    'header',
    { className: 'headline' },
    el(
      'p',
      { className: 'eyebrow' },
      `Your research notebook / Milestone ${String(index + 1).padStart(2, '0')}`,
    ),
    el('h1', {}, s.title),
    el('p', {}, s.purpose),
    el(
      'div',
      { className: 'stage-meta' },
      el('span', { className: `status ${m.status}` }, labels[m.status]),
      el('span', { className: 'muted' }, `${s.deliverable} · Version ${m.version}`),
    ),
  );
}
function sidebar() {
  const approved = project.milestones.filter((m) => m.status === 'approved').length;
  const progress = el('progress', { value: approved, max: 7, 'aria-label': 'Approved milestones' });
  return el(
    'aside',
    { className: 'sidebar' },
    el('div', { className: 'brand' }, 'ResearchGuide', el('small', {}, 'Learn through discovery')),
    el(
      'div',
      { className: 'project-block' },
      el('p', { className: 'eyebrow' }, 'Current project'),
      el('div', { className: 'project-name' }, project.title),
    ),
    el(
      'nav',
      { className: 'stage-nav', 'aria-label': 'Research milestones' },
      stages.map((s, i) =>
        el(
          'button',
          {
            className: `stage-button ${selected === s.id ? 'active' : ''} ${project.milestones[i].status === 'approved' ? 'complete' : ''}`,
            type: 'button',
            onClick: () => navigate(s.id),
            'aria-current': selected === s.id ? 'step' : null,
            disabled: busy,
          },
          el(
            'span',
            { className: 'number' },
            project.milestones[i].status === 'approved' ? '✓' : String(i + 1).padStart(2, '0'),
          ),
          el('span', { className: 'label' }, s.short),
        ),
      ),
    ),
    el(
      'div',
      { className: 'side-foot' },
      progress,
      el('p', { className: 'small' }, `${approved} of 7 milestones approved locally`),
      el(
        'p',
        { className: 'small' },
        'Good research starts with a better question. Take the time to explain your choices.',
      ),
      button(
        'About the prototype',
        () => {
          tab = 'about';
          newProject = false;
          render();
        },
        'quiet',
      ),
    ),
  );
}
function topbar() {
  function exportClick(event) {
    if (
      isDirty() &&
      !confirm('Export includes saved work only. Continue without your unsaved edits?')
    )
      event.preventDefault();
  }
  return el(
    'div',
    { className: 'topbar' },
    el(
      'span',
      { className: 'mode' },
      mode === 'demo'
        ? '◌ Demo guide · No AI calls'
        : `● ${mode === 'ollama' ? 'Ollama' : 'LLM API'} · ${model}`,
    ),
    el(
      'div',
      { className: 'toolbar' },
      el(
        'a',
        { className: 'button quiet', href: '/demo', target: '_blank', rel: 'noopener' },
        'Explore demo case ↗',
      ),
      button(
        'LLM settings',
        () =>
          perform(async () => {
            const data = await api('/api/settings');
            modelSettings = data.settings;
            mode = modelSettings.provider;
            model = modelSettings.model;
            settingsDraft = null;
            tab = 'settings';
            newProject = false;
            selectedPaperId = null;
            selectedPaperPage = 1;
            claimEditor = { claim: '', sourceIds: [] };
          }),
        'quiet',
      ),
      button(
        'New project',
        () => {
          if (isDirty() && !confirm('Discard unsaved edits and open project setup?')) return;
          newProject = true;
          render();
        },
        'quiet',
      ),
      el(
        'a',
        { className: 'button quiet', href: '/api/export?format=md', onClick: exportClick },
        'Export notebook ↓',
      ),
      el(
        'a',
        { className: 'button quiet', href: '/api/export?format=json', onClick: exportClick },
        'JSON ↓',
      ),
    ),
  );
}
function learningAside() {
  const s = stage();
  return el(
    'aside',
    { className: 'guide-aside' },
    el('p', { className: 'eyebrow' }, 'A little direction'),
    el('h2', {}, 'Think it through.'),
    el(
      'ol',
      { className: 'questions' },
      s.prompts.map((q) => el('li', {}, q)),
    ),
    el('details', {}, el('summary', {}, 'Show a worked example'), el('p', {}, s.example)),
    el(
      'details',
      {},
      el('summary', {}, 'What a reviewer will look for'),
      el(
        'ul',
        { className: 'checklist' },
        s.checks.map((c) => el('li', {}, c)),
      ),
    ),
    el(
      'p',
      { className: 'small muted' },
      'Your explanation matters as much as your artifact. Ask your supervisor when the next decision needs expertise.',
    ),
  );
}
function workspace() {
  const s = stage(),
    m = current();
  const artifact = field(
    'artifact',
    s.deliverable,
    'Record your decisions, supporting evidence, and what remains uncertain.',
    draft.artifact,
    true,
    {
      className: 'artifact',
      maxlength: 20000,
      placeholder: s.template,
      onInput: (e) => {
        draft.artifact = e.target.value;
        updateSaveLabel();
      },
    },
  );
  const explanation = field(
    'explanation',
    'Explain it in your own words',
    s.understanding,
    draft.explanation,
    true,
    {
      maxlength: 10000,
      placeholder: 'My reasoning is… A limitation I need to consider is…',
      onInput: (e) => {
        draft.explanation = e.target.value;
        updateSaveLabel();
      },
    },
  );
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      { className: 'editor' },
      !isUnlocked(selected) &&
        el(
          'div',
          { className: 'note warn' },
          'You can draft ahead. Submission opens after all earlier milestones are approved.',
        ),
      el(
        'div',
        { className: 'section-top' },
        el('h2', {}, 'Make your thinking visible.'),
        button(
          'Use a starter outline',
          () => {
            if (draft.artifact && !confirm('Replace your current draft with the starter outline?'))
              return;
            draft.artifact = s.template;
            render();
          },
          'text-button',
        ),
      ),
      artifact,
      explanation,
      el(
        'p',
        { className: 'small muted' },
        'Completeness checks use minimum text lengths only. They do not judge rigor or certify understanding.',
      ),
      el(
        'div',
        { className: 'form-actions' },
        button('Save your work', () =>
          perform(saveDraft, 'Saved. Changed versions require fresh reviews.'),
        ),
        button(
          'Request supervisor review →',
          () =>
            perform(async () => {
              if (isDirty()) await saveDraft();
              await mutate({ type: 'submit', stageId: selected });
              tab = 'review';
            }, 'Submitted for local review.'),
          'quiet',
          { disabled: busy || !isUnlocked(selected) },
        ),
      ),
      el(
        'p',
        { className: 'saved', id: 'save-label' },
        isDirty() ? 'Unsaved changes' : 'Saved on this computer',
      ),
    ),
    learningAside(),
  );
}
function updateSaveLabel() {
  const label = $('#save-label');
  if (label) label.textContent = isDirty() ? 'Unsaved changes' : 'Saved on this computer';
}
function conversationPanel() {
  const prior = project.milestones.slice(
    0,
    stages.findIndex((s) => s.id === selected),
  );
  const carried = prior.filter((m) => m.artifact || m.conversation?.length);
  const turns = current().conversation || [];
  const latest = turns.at(-1);
  const send = (message) =>
    perform(async () => {
      if (isDirty()) await saveDraft();
      const response = await api('/api/conversation', {
        stageId: selected,
        question: message,
        revision: project.revision,
        settingsRevision: modelSettings.revision,
      });
      project = response.project;
    }, 'Your guide has responded.');
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'Let’s work it out together.'),
      el(
        'p',
        { className: 'muted' },
        'Start with what you know. Your guide asks one question at a time and helps build a draft from your answers.',
      ),
      mode === 'demo' &&
        el(
          'div',
          { className: 'note' },
          'Conversational guidance needs a model. Open LLM settings and choose Ollama or an API. The demo is available under Research team.',
        ),
      carried.length > 0 &&
        el(
          'details',
          { className: 'note' },
          el(
            'summary',
            {},
            `Carried forward from ${carried.length} earlier milestone${carried.length === 1 ? '' : 's'}`,
          ),
          el(
            'p',
            { className: 'small' },
            'The guide receives saved artifacts, explanations, review status, and the latest 12 conversation turns from each earlier milestone. Saved drafts carry forward before supervisor approval.',
          ),
          carried.map((m) =>
            el(
              'section',
              {},
              el(
                'h3',
                {},
                `${stages.find((s) => s.id === m.id).short} · v${m.version} · ${labels[m.status]}`,
              ),
              el(
                'p',
                { className: 'prewrap' },
                m.artifact || 'No saved artifact yet; recent answers are available to the guide.',
              ),
            ),
          ),
        ),
      !turns.length &&
        el(
          'div',
          { className: 'empty' },
          el(
            'p',
            {},
            carried.length
              ? 'Continue this study using your earlier work. The guide will connect those decisions to the next task here.'
              : `We’ll begin with “${project.question || project.title}”. You do not need to complete the notebook first.`,
          ),
          button(
            carried.length ? 'Continue from earlier work' : 'Start guiding me',
            () =>
              send(
                carried.length
                  ? 'Help me continue into this milestone. Build on my saved research brief and earlier answers. Briefly explain what carries forward, then ask the next milestone-specific question without restarting the project.'
                  : 'Help me begin this milestone. Start from my project interest and ask me the most useful first question.',
              ),
            '',
            { disabled: busy || mode === 'demo' },
          ),
        ),
      el(
        'div',
        { className: 'conversation-log', 'aria-label': 'Guidance conversation' },
        turns.map((t) =>
          el(
            'article',
            { className: 'conversation-turn' },
            el('p', { className: 'eyebrow' }, 'You'),
            el('p', { className: 'prewrap' }, t.message),
            el('p', { className: 'eyebrow' }, `Research guide · ${t.model} · ${date(t.at)}`),
            el('p', { className: 'prewrap' }, t.reply),
            el('p', { className: 'next-question' }, t.question),
          ),
        ),
      ),
      el(
        'form',
        {
          onSubmit: (e) => {
            e.preventDefault();
            send($('#conversation-answer').value);
          },
        },
        field(
          'conversation-answer',
          'Your answer or question',
          'An incomplete answer is fine. Tell the guide when you need an explanation.',
          '',
          true,
          { required: true, maxlength: 2000, placeholder: 'Here is what I know so far…' },
        ),
        el(
          'button',
          { type: 'submit', className: 'button', disabled: busy || mode === 'demo' },
          busy ? 'Thinking…' : 'Continue conversation',
        ),
      ),
      el(
        'p',
        { className: 'small muted' },
        mode === 'demo'
          ? 'No model is connected.'
          : `Each turn sends saved research context, recent earlier-milestone answers, and this milestone’s conversation to ${modelSettings.baseUrl}.`,
      ),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('p', { className: 'eyebrow' }, 'Your developing notebook'),
      el('h2', {}, latest?.draft ? 'Review the proposed draft.' : 'Build understanding first.'),
      latest?.gaps.length > 0 && [
        el('h3', {}, 'Still to resolve'),
        el(
          'ul',
          {},
          latest.gaps.map((g) => el('li', {}, g)),
        ),
      ],
      latest?.draft
        ? [
            el(
              'p',
              { className: 'small' },
              'Check that this reflects your decisions. Accepting replaces this milestone’s artifact and preserves your own explanation.',
            ),
            el('div', { className: 'prewrap proposed-draft' }, latest.draft),
            button(
              latest.accepted ? 'Draft accepted' : 'Accept draft into notebook',
              () =>
                perform(async () => {
                  if (isDirty()) await saveDraft();
                  await mutate({ type: 'accept_draft', stageId: selected, turnId: latest.id });
                  draft = { artifact: current().artifact, explanation: current().explanation };
                }, 'Draft saved. Open Your workspace to explain your reasoning and request review.'),
              '',
              { disabled: busy || latest.accepted || latest.artifactVersion !== current().version },
            ),
            latest.artifactVersion !== current().version &&
              !latest.accepted &&
              el(
                'p',
                { className: 'small' },
                'Your artifact changed. Ask the guide to revise its draft before accepting.',
              ),
          ]
        : el(
            'p',
            {},
            'The guide will propose a draft when your answers provide enough information. You can also ask it to draft what is known and mark unresolved decisions.',
          ),
      el(
        'p',
        { className: 'small muted' },
        'You provide your own explanation in Your workspace. Supervisor reviews still control progression. The guide cannot search papers, execute analyses, or certify research quality.',
      ),
    ),
  );
}
function guidePanel() {
  const runs = current().guideRuns,
    latest = runs.at(-1);
  const form = el(
    'form',
    {
      onSubmit: (e) => {
        e.preventDefault();
        const question = $('#guide-question').value;
        perform(async () => {
          if (isDirty()) await saveDraft();
          const response = await api('/api/guide', {
            stageId: selected,
            question,
            revision: project.revision,
            settingsRevision: modelSettings.revision,
          });
          project = response.project;
        }, 'Guidance saved in your project history.');
      },
    },
    field(
      'guide-question',
      'Where are you getting stuck?',
      mode === 'demo'
        ? 'The demo returns a milestone-specific worked example. Choose a model in LLM settings for answers to your question.'
        : `Your saved artifact, sources, earlier milestones, and explanation will be sent to ${modelSettings.baseUrl}. Each guide run makes three model calls.`,
      '',
      true,
      {
        maxlength: 2000,
        placeholder: 'For example: how can I narrow my question to fit the data I have?',
      },
    ),
    el(
      'button',
      { className: 'button', type: 'submit', disabled: busy },
      busy
        ? 'The research team is working…'
        : mode === 'demo'
          ? 'Run the demo guide →'
          : 'Ask the research team →',
    ),
  );
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'A team to help you reason.'),
      el(
        'p',
        { className: 'muted' },
        'The coordinator assigns a mentor, a reviewer challenges the guidance, and the coordinator returns your next task.',
      ),
      form,
      latest &&
        el(
          'div',
          { className: 'note' },
          `${latest.mode === 'demo' ? 'Deterministic demo' : `${latest.mode} · ${latest.model}${latest.endpoint ? ` · ${latest.endpoint}` : ''}`} · Artifact v${latest.artifactVersion} · ${date(latest.finishedAt)}${latest.artifactVersion !== current().version ? ' · Your artifact has changed since this run.' : ''}`,
        ),
      latest
        ? el(
            'div',
            { className: 'trace' },
            latest.trace.map((t) =>
              el(
                'article',
                { className: 'trace-step' },
                el('p', { className: 'eyebrow' }, t.task),
                el('h3', {}, t.agent),
                el('p', { className: 'prewrap' }, t.output),
              ),
            ),
          )
        : el(
            'div',
            { className: 'empty' },
            'Your guidance trail will appear here. You will be able to inspect who did what, and what remains for you to decide.',
          ),
      runs.length > 1 &&
        el(
          'details',
          {},
          el('summary', {}, `${runs.length - 1} previous guidance runs`),
          runs
            .slice(0, -1)
            .reverse()
            .map((r) =>
              el(
                'div',
                { className: 'review' },
                el(
                  'p',
                  { className: 'small' },
                  `${date(r.finishedAt)} · ${r.mode} · v${r.artifactVersion}`,
                ),
                el('p', { className: 'prewrap' }, r.trace.at(-1).output),
              ),
            ),
        ),
    ),
    learningAside(),
  );
}
function paperLibrary() {
  const papers = project.papers || [];
  const paper = papers.find((p) => p.id === selectedPaperId) || papers.at(-1);
  const page = paper?.pages.find((p) => p.number === selectedPaperPage) || paper?.pages[0];
  const paperSelect = el(
    'select',
    {
      id: 'paper-select',
      disabled: busy,
      onChange: (e) => {
        selectedPaperId = e.target.value;
        selectedPaperPage = 1;
        render();
      },
    },
    papers.map((p) => el('option', { value: p.id }, p.title)),
  );
  if (paper) paperSelect.value = paper.id;
  const pageSelect = el(
    'select',
    {
      id: 'paper-page',
      disabled: busy,
      onChange: (e) => {
        selectedPaperPage = Number(e.target.value);
        render();
      },
    },
    (paper?.pages || []).map((p) =>
      el('option', { value: p.number }, `PDF page ${p.number}${p.text ? '' : ' — no text'}`),
    ),
  );
  if (page) pageSelect.value = page.number;
  return el(
    'section',
    { className: 'paper-library' },
    el('h3', {}, 'Inspect a paper'),
    el(
      'p',
      { className: 'small muted' },
      'Text-based PDFs only: up to 5 MB and 100 pages. Extraction happens locally, without a model call. Page numbers refer to file pages; layout and reading order may differ from the original. Scanned pages need OCR elsewhere.',
    ),
    el(
      'form',
      {
        onSubmit: (e) => {
          e.preventDefault();
          const file = $('#paper-file').files[0],
            title = $('#paper-title').value;
          if (!file || file.size > 5 * 1024 * 1024) {
            notice('Choose a PDF no larger than 5 MB.');
            return;
          }
          perform(async () => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 32768)
              binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
            const r = await api('/api/papers', {
              title,
              pdf: btoa(binary),
              revision: project.revision,
            });
            project = r.project;
            selectedPaperId = project.papers.at(-1).id;
            selectedPaperPage = 1;
          }, 'PDF extracted locally. Inspect a page and save a short passage.');
        },
      },
      field(
        'paper-title',
        'Title of uploaded paper',
        'Use a recognizable citation title.',
        '',
        false,
        { required: true, maxlength: 300 },
      ),
      el('label', { for: 'paper-file' }, 'PDF file'),
      el('input', {
        id: 'paper-file',
        type: 'file',
        accept: '.pdf,application/pdf',
        required: true,
        disabled: busy,
      }),
      el(
        'button',
        { type: 'submit', className: 'button', disabled: busy },
        'Upload and extract PDF',
      ),
    ),
    paper && [
      el('label', { for: 'paper-select' }, 'Uploaded paper'),
      paperSelect,
      el('label', { for: 'paper-page' }, 'Extracted page'),
      pageSelect,
      el(
        'a',
        { href: `/api/papers/${paper.id}`, target: '_blank', rel: 'noopener noreferrer' },
        'Download original PDF to compare',
      ),
      el('textarea', {
        id: 'extracted-page',
        className: 'extracted-page',
        readonly: true,
        'aria-label': 'Extracted page text',
        value: page.text || 'No text extracted on this page.',
      }),
      el(
        'p',
        { className: 'small muted' },
        'Copy an exact, short passage from the extracted text. Check its context against the original PDF.',
      ),
      el(
        'form',
        {
          onSubmit: (e) => {
            e.preventDefault();
            const passage = $('#pdf-passage').value;
            perform(
              () =>
                mutate({ type: 'paper_passage', paperId: paper.id, page: page.number, passage }),
              'Passage linked to its PDF page. You can now attach it to a claim.',
            );
          },
        },
        field(
          'pdf-passage',
          'Exact passage from this page',
          '20–8000 characters. Whitespace differences are normalized.',
          '',
          true,
          { required: true, minlength: 20, maxlength: 8000 },
        ),
        el(
          'button',
          { type: 'submit', className: 'button', disabled: busy || !page.text },
          'Save page-linked passage',
        ),
      ),
    ],
  );
}
function outputTable(csv) {
  const rows = csv
    .trim()
    .split('\n')
    .map((row) => row.split(',').map((v) => v.replace(/^"|"$/g, '')));
  return el(
    'div',
    { className: 'table-scroll' },
    el(
      'table',
      {},
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          rows[0].map((v) => el('th', { scope: 'col' }, v)),
        ),
      ),
      el(
        'tbody',
        {},
        rows.slice(1, 25).map((row) =>
          el(
            'tr',
            {},
            row.map((v) => el('td', {}, v)),
          ),
        ),
      ),
    ),
  );
}
function executionPanel() {
  const datasets = project.datasets || [],
    plans = project.analysisPlans || [],
    runs = project.analysisRuns || [];
  const dataset = datasets.find((d) => d.id === analysisDatasetId) || datasets.at(-1);
  const availablePlans = plans.filter((p) => p.datasetId === dataset?.id);
  const plan = availablePlans.find((p) => p.id === analysisPlanId) || availablePlans.at(-1);
  const current =
    plan &&
    plan.contextVersions.every(
      (s) => project.milestones.find((m) => m.id === s.id).version === s.version,
    );
  const approval = plan?.approvals.at(-1);
  const select = (id, values, value, onChange) => {
    const node = el(
      'select',
      { id, disabled: busy, onChange },
      values.map(([v, label]) => el('option', { value: v }, label)),
    );
    node.value = value;
    return node;
  };
  const numeric = dataset?.columns.filter((c) => c.numeric && c.observed >= 2) || [];
  const outcome =
    numeric.find((c) => c.index === analysisDraft.outcome)?.index ?? numeric[0]?.index;
  const predictor =
    numeric.find((c) => c.index === analysisDraft.predictor)?.index ?? numeric[1]?.index;
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'From a plan to recorded results.'),
      el(
        'p',
        { className: 'muted' },
        'Run descriptive statistics or simple linear regression in a local R runtime. Review the plan and exact script before execution. Tables and figures come from R, not from the language model.',
      ),
      el(
        'details',
        { open: !datasets.length },
        el('summary', {}, 'Import a permitted CSV dataset'),
        el(
          'form',
          {
            onSubmit: (e) => {
              e.preventDefault();
              const file = $('#analysis-csv').files[0],
                name = $('#dataset-name').value,
                permission = $('#dataset-permission').value;
              if (!file || file.size > 2 * 1024 * 1024) {
                notice('Choose a CSV no larger than 2 MB.');
                return;
              }
              perform(async () => {
                const r = await api('/api/analysis/datasets', {
                  name,
                  permission,
                  csv: await file.text(),
                  revision: project.revision,
                });
                project = r.project;
                analysisDatasetId = project.datasets.at(-1).id;
                analysisPlanId = null;
                analysisDraft = {
                  method: 'descriptive',
                  outcome: null,
                  predictor: null,
                  rationale: '',
                };
              }, 'Dataset version saved locally. Review its profile before choosing an analysis.');
            },
          },
          field('dataset-name', 'Dataset name', '', '', false, { required: true, maxlength: 160 }),
          el('label', { for: 'analysis-csv' }, 'CSV file'),
          el('input', {
            id: 'analysis-csv',
            type: 'file',
            accept: '.csv,text/csv',
            required: true,
            disabled: busy,
          }),
          field(
            'dataset-permission',
            'Why may you use these data?',
            'Describe the license, permission, or synthetic-data origin. At least 20 characters.',
            '',
            true,
            { required: true, minlength: 20, maxlength: 2000 },
          ),
          el(
            'p',
            { className: 'small muted' },
            'CSV files stay on this computer and are included in JSON exports and reproduction bundles. Plan generation sends column names, types, counts, and saved question/design/data text to your model; individual rows are not sent for planning.',
          ),
          el('button', { type: 'submit', className: 'button', disabled: busy }, 'Import CSV'),
        ),
      ),
      dataset && [
        el('label', { for: 'analysis-dataset' }, 'Dataset version'),
        select(
          'analysis-dataset',
          datasets.map((d) => [d.id, `${d.id} · ${d.name} · ${d.rowCount} rows`]),
          dataset.id,
          (e) => {
            analysisDatasetId = e.target.value;
            analysisPlanId = null;
            analysisDraft = {
              method: 'descriptive',
              outcome: null,
              predictor: null,
              rationale: '',
            };
            render();
          },
        ),
        el(
          'details',
          {},
          el('summary', {}, 'Column profile and dataset identity'),
          el('p', { className: 'small hash' }, `SHA-256 ${dataset.sha256}`),
          el(
            'ul',
            {},
            dataset.columns.map((c) =>
              el(
                'li',
                {},
                `${c.name}: ${c.numeric ? 'numeric' : 'not wholly numeric'}; ${c.observed} numeric values, ${c.missing} missing`,
              ),
            ),
          ),
        ),
        el('h3', {}, 'Propose an analysis'),
        button(
          'Ask AI to propose a plan',
          () =>
            perform(async () => {
              if (isDirty()) await saveDraft();
              const r = await api('/api/analysis/propose', {
                datasetId: dataset.id,
                revision: project.revision,
                settingsRevision: modelSettings.revision,
              });
              project = r.project;
              analysisPlanId = project.analysisPlans.at(-1).id;
            }, 'Proposed plan saved. Review its rationale, limitations, and R script before approving.'),
          '',
          { disabled: busy || mode === 'demo' },
        ),
        el(
          'details',
          { open: analysisManualOpen },
          el(
            'summary',
            {
              onClick: () => {
                analysisManualOpen = !analysisManualOpen;
              },
            },
            'Choose a plan manually',
          ),
          el(
            'form',
            {
              onSubmit: (e) => {
                e.preventDefault();
                const values = {
                  method: analysisDraft.method,
                  outcome,
                  predictor,
                  rationale: analysisDraft.rationale,
                };
                perform(async () => {
                  if (isDirty()) await saveDraft();
                  await mutate({ type: 'analysis_plan', datasetId: dataset.id, ...values });
                  analysisPlanId = project.analysisPlans.at(-1).id;
                }, 'Analysis plan saved for review.');
              },
            },
            el('label', { for: 'analysis-method' }, 'Analysis method'),
            select(
              'analysis-method',
              [
                ['descriptive', 'Descriptive statistics'],
                ['linear', 'Simple linear regression'],
              ],
              analysisDraft.method,
              (e) => {
                analysisDraft.method = e.target.value;
                render();
              },
            ),
            el('label', { for: 'analysis-outcome' }, 'Outcome variable'),
            select(
              'analysis-outcome',
              numeric.map((c) => [c.index, c.name]),
              outcome,
              (e) => {
                analysisDraft.outcome = Number(e.target.value);
                render();
              },
            ),
            analysisDraft.method === 'linear' && [
              el('label', { for: 'analysis-predictor' }, 'Predictor variable'),
              select(
                'analysis-predictor',
                numeric.map((c) => [c.index, c.name]),
                predictor,
                (e) => {
                  analysisDraft.predictor = Number(e.target.value);
                  render();
                },
              ),
            ],
            field(
              'analysis-rationale',
              'Why does this analysis fit the question?',
              'Explain assumptions and limitations. At least 40 characters.',
              analysisDraft.rationale,
              true,
              {
                required: true,
                minlength: 40,
                maxlength: 3000,
                onInput: (e) => {
                  analysisDraft.rationale = e.target.value;
                },
              },
            ),
            el(
              'button',
              { type: 'submit', className: 'button', disabled: busy || !numeric.length },
              'Save analysis plan',
            ),
          ),
        ),
      ],
      plan && [
        el('h3', {}, `Review ${plan.id}`),
        select(
          'analysis-plan',
          availablePlans.map((p) => [p.id, `${p.id} · ${p.method} · ${date(p.at)}`]),
          plan.id,
          (e) => {
            analysisPlanId = e.target.value;
            render();
          },
        ),
        el(
          'p',
          { className: 'status' },
          current
            ? 'Matches question, design and data report'
            : 'Outdated — create a new plan after reviewing your changes',
        ),
        el(
          'p',
          {},
          `Outcome (y): ${dataset.columns[plan.outcome].name}${plan.method === 'linear' ? `; predictor (x): ${dataset.columns[plan.predictor].name}` : ''}. Missing values: complete-case omission. No automatic confounder adjustment.`,
        ),
        el('p', { className: 'prewrap' }, plan.rationale),
        el(
          'details',
          {},
          el('summary', {}, 'Review the exact R script'),
          el('pre', { className: 'code-review' }, el('code', {}, plan.script)),
          el('p', { className: 'small hash' }, `Script SHA-256 ${plan.scriptHash}`),
        ),
        current &&
          el(
            'details',
            {},
            el('summary', {}, 'Approve this plan and script'),
            el(
              'form',
              {
                onSubmit: (e) => {
                  e.preventDefault();
                  const name = $('#analysis-reviewer').value,
                    note = $('#analysis-approval-note').value,
                    reviewed = $('#analysis-reviewed').checked;
                  perform(
                    () =>
                      mutate({
                        type: 'analysis_approve',
                        planId: plan.id,
                        planHash: plan.planHash,
                        name,
                        note,
                        reviewed,
                      }),
                    'Execution approval recorded. You can now run this exact plan.',
                  );
                },
              },
              field('analysis-reviewer', 'Reviewer name', '', '', false, {
                required: true,
                maxlength: 100,
              }),
              field(
                'analysis-approval-note',
                'Why is this plan appropriate?',
                'At least 40 characters. This is a local, unauthenticated execution approval.',
                '',
                true,
                { required: true, minlength: 40, maxlength: 2000 },
              ),
              el(
                'label',
                { className: 'checkbox-label' },
                el('input', {
                  id: 'analysis-reviewed',
                  type: 'checkbox',
                  required: true,
                  disabled: busy,
                }),
                'I reviewed the dataset, variable mapping, missing-data policy, rationale and exact script.',
              ),
              el(
                'button',
                { type: 'submit', className: 'button', disabled: busy },
                'Approve for execution',
              ),
            ),
          ),
        approval &&
          el(
            'p',
            { className: 'small' },
            `Execution approval: ${approval.name} · ${date(approval.at)}`,
          ),
        button(
          'Run approved R analysis',
          () =>
            perform(async () => {
              if (isDirty()) await saveDraft();
              const r = await api('/api/analysis/run', {
                planId: plan.id,
                approvalId: approval.id,
                revision: project.revision,
              });
              project = r.project;
              const run = project.analysisRuns.at(-1);
              notice(
                run.status === 'succeeded'
                  ? `Run ${run.id} completed. Inspect the recorded outputs below.`
                  : `Run ${run.id} failed. The failure log is saved below.`,
              );
            }),
          '',
          { disabled: busy || !current || !approval },
        ),
      ],
      el('h3', {}, 'Execution records'),
      !runs.length &&
        el(
          'p',
          { className: 'empty' },
          'No computations have run yet. Plan generation and approval do not execute R.',
        ),
      runs
        .slice()
        .reverse()
        .map((run) =>
          el(
            'article',
            { className: 'claim-record' },
            el('h3', {}, `${run.id} · ${run.status} · ${run.planId} / ${run.datasetId}`),
            el(
              'p',
              { className: 'small' },
              `${run.rVersion || run.engine} · ${date(run.finishedAt)}`,
            ),
            !run.contextVersions.every(
              (s) => project.milestones.find((m) => m.id === s.id).version === s.version,
            ) &&
              el(
                'p',
                { className: 'note warn' },
                'Question, design or data report changed since this plan. This is a historical run.',
              ),
            run.status === 'succeeded' && [
              el('h4', {}, 'Observation counts'),
              outputTable(run.files['counts.csv']),
              el('h4', {}, 'Descriptive statistics'),
              outputTable(run.files['descriptives.csv']),
              run.files['coefficients.csv'] && [
                el('h4', {}, 'Regression coefficients and 95% intervals'),
                outputTable(run.files['coefficients.csv']),
              ],
              el('img', {
                src: `/api/analysis/runs/${run.id}/figure.svg`,
                alt: 'Histogram of the selected outcome among complete observations',
                className: 'analysis-figure',
              }),
            ],
            el(
              'details',
              {},
              el('summary', {}, 'Execution log and environment'),
              el('pre', { className: 'code-review' }, run.log),
              el(
                'pre',
                { className: 'code-review' },
                run.files['session.txt'] || 'No environment record was returned.',
              ),
            ),
            el(
              'a',
              { href: `/api/analysis/runs/${run.id}`, className: 'button quiet' },
              'Download reproduction bundle',
            ),
            el(
              'div',
              { className: 'form-actions' },
              ['analysis.R', 'input.csv', ...Object.keys(run.files)].map((file) =>
                el('a', { href: `/api/analysis/runs/${run.id}/${file}` }, file),
              ),
            ),
            el(
              'p',
              { className: 'small muted' },
              `Cite run ${run.id} in your Analysis and Interpretation artifacts. Recorded output summaries are available to the conversational guide and consistency review.`,
            ),
          ),
        ),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('h2', {}, 'A bounded first analysis'),
      el(
        'p',
        {},
        'Descriptive statistics summarize one numeric variable. Simple regression estimates an unadjusted association between two numeric variables. Neither choice establishes causality.',
      ),
      el(
        'p',
        {},
        'Rows missing a selected variable are omitted and counted. Numeric variables only; categorical predictors, imputation, multivariable models, and arbitrary R scripts are not supported in this version.',
      ),
      el(
        'p',
        {},
        'A separate local webR process uses an in-memory filesystem, a 30-second deadline, bounded outputs, a 256 MB JavaScript heap limit, and a 512 MB limit per WebAssembly memory. The process receives numeric input only, without API keys or host filesystem mounts.',
      ),
      el(
        'p',
        { className: 'small muted' },
        'This is a constrained template runner, not a sandbox for arbitrary uploaded code. Only the reviewed templates execute. Downloads and JSON backups include row-level data. Inspect diagnostics and discuss assumptions with your supervisor.',
      ),
    ),
  );
}
function consistencyPanel() {
  const ids = ['question', 'design', 'data', 'analysis', 'interpretation', 'writing'];
  const reports = project.consistencyReports || [];
  const report = reports.find((r) => r.id === selectedConsistencyId) || reports.at(-1);
  const currentReport =
    report &&
    Boolean(report.snapshot.find((s) => s.id === 'execution')) ===
      Boolean((project.analysisRuns || []).some((r) => r.status === 'succeeded')) &&
    report.snapshot.every((s) => {
      if (s.id === 'execution') return s.version === project.analysisRuns.length;
      const m = project.milestones.find((m) => m.id === s.id);
      return (
        m.version === s.version && m.artifact === s.artifact && m.explanation === s.explanation
      );
    });
  const canDecide = currentReport && report === reports.at(-1) && !isDirty();
  const name = (id) =>
    id === 'execution' ? 'Recorded R outputs' : stages.find((s) => s.id === id).short;
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'Does the study tell one consistent story?'),
      el(
        'p',
        { className: 'muted' },
        'Compare the research brief, design, data report, analysis, conclusions, and research package. The guide flags mismatches and missing information; it does not execute analyses or certify rigor.',
      ),
      el(
        'div',
        { className: 'form-actions' },
        button(
          'Run consistency review',
          () =>
            perform(async () => {
              if (isDirty()) await saveDraft();
              const r = await api('/api/consistency', {
                revision: project.revision,
                settingsRevision: modelSettings.revision,
              });
              project = r.project;
              selectedConsistencyId = project.consistencyReports.at(-1).id;
            }, 'Consistency review saved. Inspect each finding against the quoted text.'),
          '',
          { disabled: busy || mode === 'demo' },
        ),
      ),
      el(
        'p',
        { className: 'small muted' },
        mode === 'demo'
          ? 'Connect a model in LLM settings to run a review.'
          : `This sends the six saved milestone artifacts and explanations to ${modelSettings.baseUrl}. Unsaved workspace edits will be saved first. Recorded R output summaries are included when available. No source PDFs or external files are inspected.`,
      ),
      !report &&
        el(
          'p',
          { className: 'empty' },
          'Save work in at least two review milestones, then compare it here. You can review an incomplete study; missing core milestones will be listed.',
        ),
      report && [
        el(
          'p',
          { className: 'status' },
          `${currentReport && !isDirty() ? 'Matches saved work' : 'Outdated or unsaved changes — rerun before relying on this report'} · ${report.model} · ${date(report.at)}`,
        ),
        el('p', { className: 'prewrap' }, report.summary),
        report.missing.length > 0 &&
          el(
            'div',
            { className: 'note warn' },
            `Partial review: ${report.missing.map(name).join(', ')} had no saved artifact. A full comparison was not possible.`,
          ),
        !report.findings.length &&
          el(
            'p',
            { className: 'note' },
            'The model identified no specific issue in the supplied text. This does not establish that the study is complete or scientifically sound.',
          ),
        report.findings.map((f) =>
          el(
            'article',
            { className: 'claim-record' },
            el(
              'p',
              { className: 'eyebrow' },
              `${f.id} · ${f.severity} priority · ${f.kind.replaceAll('_', ' ')} · ${f.dimension.replaceAll('_', ' ')}`,
            ),
            el('h3', {}, f.title),
            el('p', {}, f.explanation),
            f.references.map((ref) =>
              el(
                'div',
                { className: 'consistency-reference' },
                button(
                  `${name(ref.stageId)} · v${ref.version} · ${ref.field}`,
                  () => {
                    if (ref.stageId === 'execution') {
                      tab = 'execution';
                      render();
                      return;
                    }
                    navigate(ref.stageId);
                    if (selected === ref.stageId) {
                      tab = 'workspace';
                      render();
                    }
                  },
                  'quiet',
                ),
                el('blockquote', {}, ref.quote),
                el(
                  'p',
                  { className: 'small muted' },
                  'Exact quotation from the reviewed snapshot. The button opens the current workspace.',
                ),
              ),
            ),
            el(
              'div',
              { className: 'note' },
              el('strong', {}, 'Suggested next action'),
              el('p', {}, f.recommendation),
            ),
            f.decisions.map((d) =>
              el(
                'div',
                { className: 'review' },
                el('strong', {}, `${d.name} · ${d.decision} · ${date(d.at)}`),
                el('p', {}, d.note),
              ),
            ),
            canDecide &&
              el(
                'details',
                {},
                el('summary', {}, `Respond to ${f.id}`),
                el(
                  'form',
                  {
                    onSubmit: (e) => {
                      e.preventDefault();
                      const values = {
                        name: $(`#consistency-name-${f.id}`).value,
                        note: $(`#consistency-note-${f.id}`).value,
                        decision: $(`#consistency-decision-${f.id}`).value,
                      };
                      perform(
                        () =>
                          mutate({
                            type: 'consistency_decision',
                            reportId: report.id,
                            findingId: f.id,
                            ...values,
                          }),
                        'Researcher response saved. This does not resolve the issue automatically or grant approval.',
                      );
                    },
                  },
                  field(`consistency-name-${f.id}`, 'Researcher name', '', '', false, {
                    required: true,
                    maxlength: 100,
                  }),
                  el('label', { for: `consistency-decision-${f.id}` }, 'Your assessment'),
                  el(
                    'select',
                    { id: `consistency-decision-${f.id}`, disabled: busy },
                    el('option', { value: 'unresolved' }, 'Still unresolved'),
                    el('option', { value: 'agree' }, 'Agree with the finding'),
                    el('option', { value: 'disagree' }, 'Disagree with the finding'),
                  ),
                  field(
                    `consistency-note-${f.id}`,
                    'Explain your response',
                    'Describe what needs changing, or why the flagged difference is justified. At least 40 characters.',
                    '',
                    true,
                    { required: true, minlength: 40, maxlength: 4000 },
                  ),
                  el(
                    'button',
                    { type: 'submit', className: 'button', disabled: busy },
                    'Save finding response',
                  ),
                ),
              ),
          ),
        ),
        el(
          'p',
          { className: 'small muted' },
          'Researcher responses are local and unauthenticated. Agreement acknowledges a finding; it does not fix it. Edit the relevant milestones and rerun the review to reassess.',
        ),
      ],
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('h2', {}, 'Review coverage'),
      ids.map((id) => {
        const m = project.milestones.find((m) => m.id === id);
        return el(
          'p',
          {},
          `${name(id)} · v${m.version} · ${m.artifact.trim() ? 'saved text available' : 'no saved artifact'}`,
        );
      }),
      el(
        'p',
        { className: 'small' },
        'Checks population and measurement, design and causal claims, planned versus reported analysis, results and conclusions, and limitations. Up to six priority findings per run; not an exhaustive audit.',
      ),
      report &&
        el(
          'details',
          {},
          el('summary', {}, 'Text examined in this report'),
          report.snapshot.map((s) =>
            el(
              'section',
              {},
              el('h3', {}, `${name(s.id)} · v${s.version}`),
              el('p', { className: 'prewrap' }, s.artifact || '(No artifact)'),
              el('p', { className: 'prewrap small' }, s.explanation || '(No student explanation)'),
            ),
          ),
        ),
      reports.length > 0 && [
        el('h3', {}, 'Review history'),
        reports
          .slice()
          .reverse()
          .map((r) =>
            button(
              `${date(r.at)} · ${r.findings.length} findings`,
              () => {
                selectedConsistencyId = r.id;
                render();
              },
              'quiet',
              { 'aria-pressed': report.id === r.id },
            ),
          ),
      ],
      el(
        'p',
        { className: 'small muted' },
        'Reports and researcher responses are included in notebook exports. Any edit to a reviewed artifact or explanation makes the report outdated. Earlier reports remain available.',
      ),
    ),
  );
}
function claimsPanel() {
  const claims = project.claims || [];
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'What supports this claim?'),
      el(
        'p',
        { className: 'muted' },
        'Link a claim to inspected passages. Compare the model’s suggestion with the source text, then record your own decision. These checks do not verify a whole paper or certify scientific truth.',
      ),
      !claims.length &&
        el(
          'p',
          { className: 'empty' },
          'Begin in Sources: upload a PDF and select a passage, or paste a passage with a source link. Then add the claim you want to examine here.',
        ),
      claims.map((c) => {
        const assessment = c.assessments.at(-1),
          currentAssessment = assessment?.claimVersion === c.version;
        return el(
          'article',
          { className: 'claim-record' },
          el('p', { className: 'eyebrow' }, `${c.id} · version ${c.version}`),
          el('h3', {}, c.claim),
          c.sourceIds.map((id) => {
            const source = project.sources.find((s) => s.id === id);
            return el(
              'details',
              {},
              el('summary', {}, `${id} · ${source.title} · ${source.location}`),
              el('blockquote', {}, source.passage),
              source.paperId
                ? el(
                    'a',
                    {
                      href: `/api/papers/${source.paperId}`,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    },
                    'Download original PDF',
                  )
                : el(
                    'a',
                    { href: source.url, target: '_blank', rel: 'noopener noreferrer' },
                    'Open source link',
                  ),
              el(
                'p',
                { className: 'small muted' },
                source.provenance === 'pdf-exact-match'
                  ? 'Matched to extracted page text; inspect the original context.'
                  : 'Manual passage: not independently matched to the source.',
              ),
            );
          }),
          el(
            'div',
            { className: 'form-actions' },
            button(
              'Assess linked evidence',
              () =>
                perform(async () => {
                  const r = await api('/api/claims/assess', {
                    claimId: c.id,
                    revision: project.revision,
                    settingsRevision: modelSettings.revision,
                  });
                  project = r.project;
                }, 'AI assessment saved. Inspect the passages and record your own decision.'),
              '',
              { disabled: busy || mode === 'demo' },
            ),
            button(
              'Edit claim and links',
              () => {
                claimEditor = { claimId: c.id, claim: c.claim, sourceIds: [...c.sourceIds] };
                render();
                $('#claim-text').focus();
              },
              'quiet',
            ),
          ),
          assessment && [
            el(
              'p',
              { className: 'status' },
              `${currentAssessment ? 'AI suggestion' : 'Outdated AI suggestion'} · ${assessment.verdict.replaceAll('_', ' ')} · ${assessment.model}`,
            ),
            el('p', { className: 'prewrap' }, assessment.rationale),
            el(
              'ul',
              {},
              assessment.sources.map((s) =>
                el('li', {}, `${s.sourceId} — ${s.relation}: ${s.reason}`),
              ),
            ),
            assessment.suggestedClaim &&
              el(
                'div',
                { className: 'note' },
                el('strong', {}, 'Suggested wording — not applied'),
                el('p', {}, assessment.suggestedClaim),
                button(
                  'Edit using this wording',
                  () => {
                    claimEditor = {
                      claimId: c.id,
                      claim: assessment.suggestedClaim,
                      sourceIds: [...c.sourceIds],
                    };
                    render();
                    $('#claim-text').focus();
                  },
                  'quiet',
                  { disabled: busy || !currentAssessment },
                ),
              ),
            (assessment.confirmations || []).map((f) =>
              el(
                'div',
                { className: 'review' },
                el('strong', {}, `Researcher ${f.decision} · ${f.name} · ${date(f.at)}`),
                el('p', {}, f.note),
                el('p', { className: 'small muted' }, 'Local, unauthenticated decision.'),
              ),
            ),
            currentAssessment &&
              el(
                'details',
                {},
                el('summary', {}, 'Record your inspection and decision'),
                el(
                  'form',
                  {
                    onSubmit: (e) => {
                      e.preventDefault();
                      const name = $(`#researcher-${c.id}`).value,
                        note = $(`#reason-${c.id}`).value,
                        decision = $(`#decision-${c.id}`).value,
                        inspected = $(`#inspected-${c.id}`).checked;
                      perform(
                        () =>
                          mutate({
                            type: 'claim_confirm',
                            claimId: c.id,
                            assessmentId: assessment.id,
                            name,
                            note,
                            decision,
                            inspected,
                          }),
                        'Researcher decision recorded. This is not supervisor approval.',
                      );
                    },
                  },
                  field(`researcher-${c.id}`, 'Researcher name', '', '', false, {
                    required: true,
                    maxlength: 100,
                  }),
                  el('label', { for: `decision-${c.id}` }, 'Your decision'),
                  el(
                    'select',
                    { id: `decision-${c.id}`, disabled: busy },
                    el('option', { value: 'unresolved' }, 'Still unresolved'),
                    el('option', { value: 'agree' }, 'I agree with the assessment'),
                    el('option', { value: 'disagree' }, 'I disagree with the assessment'),
                  ),
                  field(
                    `reason-${c.id}`,
                    'Explain why the passages support or limit the claim',
                    'At least 40 characters, in your own words.',
                    '',
                    true,
                    { required: true, minlength: 40, maxlength: 4000 },
                  ),
                  el(
                    'label',
                    { className: 'checkbox-label' },
                    el('input', {
                      id: `inspected-${c.id}`,
                      type: 'checkbox',
                      required: true,
                      disabled: busy,
                    }),
                    'I inspected the linked passages and their source context.',
                  ),
                  el(
                    'button',
                    { type: 'submit', className: 'button', disabled: busy },
                    'Save researcher decision',
                  ),
                ),
              ),
          ],
          c.assessments.length > 1 &&
            el(
              'details',
              {},
              el('summary', {}, 'Earlier assessments'),
              c.assessments.slice(0, -1).map((a) =>
                el(
                  'div',
                  { className: 'review' },
                  el('p', {}, `Claim v${a.claimVersion}: ${a.verdict} · ${date(a.at)}`),
                  el('p', {}, a.rationale),
                  (a.confirmations || []).map((f) =>
                    el('p', {}, `${f.name}: ${f.decision}. ${f.note}`),
                  ),
                ),
              ),
            ),
        );
      }),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('h2', {}, claimEditor.claimId ? `Edit ${claimEditor.claimId}` : 'Add a research claim'),
      el(
        'form',
        {
          onSubmit: (e) => {
            e.preventDefault();
            const values = { ...claimEditor, sourceIds: [...claimEditor.sourceIds] };
            perform(async () => {
              await mutate({ type: 'claim_save', ...values });
              claimEditor = { claim: '', sourceIds: [] };
            }, 'Claim saved. Assess its linked evidence next.');
          },
        },
        field(
          'claim-text',
          'Claim to assess',
          'A specific statement you intend to make in your literature review or interpretation.',
          claimEditor.claim,
          true,
          {
            required: true,
            minlength: 10,
            maxlength: 3000,
            onInput: (e) => {
              claimEditor.claim = e.target.value;
            },
          },
        ),
        el(
          'fieldset',
          {},
          el('legend', {}, 'Linked source passages (choose 1–8)'),
          project.sources.map((s) =>
            el(
              'label',
              { className: 'checkbox-label' },
              el('input', {
                type: 'checkbox',
                checked: claimEditor.sourceIds.includes(s.id),
                disabled: busy,
                onChange: (e) => {
                  claimEditor.sourceIds = e.target.checked
                    ? [...claimEditor.sourceIds, s.id]
                    : claimEditor.sourceIds.filter((id) => id !== s.id);
                },
              }),
              `${s.id} · ${s.title} · ${s.location}`,
            ),
          ),
        ),
        el(
          'button',
          { type: 'submit', className: 'button', disabled: busy || !project.sources.length },
          'Save claim',
        ),
        claimEditor.claimId &&
          button(
            'Cancel editing',
            () => {
              claimEditor = { claim: '', sourceIds: [] };
              render();
            },
            'quiet',
          ),
      ),
      el(
        'p',
        { className: 'small muted' },
        mode === 'demo'
          ? 'Connect a model in LLM settings to request an assessment. You can still collect sources and claims.'
          : `Assessment sends the claim and its linked excerpts to ${modelSettings.baseUrl}. Full PDFs are not sent. Research guidance also receives the claim ledger.`,
      ),
      el(
        'p',
        { className: 'small muted' },
        'Editing a claim makes its earlier assessments outdated. Changes renew evidence and downstream review requirements. Cite claim IDs such as C1 alongside source IDs in your research artifacts.',
      ),
    ),
  );
}
function sourcesPanel() {
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'Leave a trail to the evidence.'),
      el(
        'p',
        { className: 'muted' },
        'Import a paper or record a passage from a source link. Cite its ID in your artifacts, then connect it to a claim in Claims & evidence. Source links are not fetched automatically.',
      ),
      paperLibrary(),
      project.sources.map((s) =>
        el(
          'article',
          { className: 'source' },
          el(
            'span',
            { className: 'status' },
            `${s.id} · ${s.provenance === 'pdf-exact-match' ? 'Matched to extracted PDF page' : 'Manual passage — unverified'}`,
          ),
          el('h3', {}, s.title),
          s.paperId
            ? el(
                'a',
                { href: `/api/papers/${s.paperId}`, target: '_blank', rel: 'noopener noreferrer' },
                `Download original PDF · file page ${s.page}`,
              )
            : el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.url),
          el('p', { className: 'small muted' }, s.location),
          el('blockquote', {}, s.passage),
        ),
      ),
      !project.sources.length &&
        el(
          'p',
          { className: 'empty' },
          'No sources yet. Start with a paper that informs—or challenges—your research question.',
        ),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('h2', {}, 'Add an inspected source'),
      el(
        'form',
        {
          onSubmit: (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            perform(async () => {
              await mutate({ type: 'source', ...values });
            }, 'Source added. Evidence and dependent reviews need renewal.');
          },
        },
        field('title', 'Paper or resource title', '', '', false, {
          required: true,
          maxlength: 300,
        }),
        field('url', 'Source URL', 'Full https:// or http:// URL.', '', false, {
          type: 'url',
          required: true,
          maxlength: 2000,
        }),
        field('location', 'Page or section', '', '', false, {
          required: true,
          maxlength: 300,
          placeholder: 'Page 4, Results',
        }),
        field(
          'passage',
          'Passage you inspected',
          'Keep excerpts brief and include only what you need.',
          '',
          true,
          { required: true, minlength: 20, maxlength: 8000 },
        ),
        el('button', { className: 'button', type: 'submit', disabled: busy }, 'Add source'),
      ),
    ),
  );
}
function reviewPanel() {
  const m = current();
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'Bring your supervisor into the loop.'),
      el(
        'div',
        { className: 'note warn' },
        'Local review demonstration: anyone using this computer can enter a review. There are no authenticated roles or remote supervisor accounts yet.',
      ),
      el('h3', {}, `${stage().deliverable} · v${m.version}`),
      el(
        'p',
        { className: 'prewrap' },
        m.artifact || 'Save your artifact to create a review packet.',
      ),
      el('h3', {}, 'Student explanation'),
      el('p', { className: 'prewrap' }, m.explanation || 'No explanation saved.'),
      el('h3', {}, 'Review history'),
      !m.reviews.length && el('p', { className: 'small muted' }, 'No reviews yet.'),
      m.reviews
        .slice()
        .reverse()
        .map((r) =>
          el(
            'article',
            { className: 'review' },
            el(
              'p',
              { className: 'small' },
              `${r.reviewer} · v${r.version} · ${r.decision === 'approve' ? 'Approved' : 'Revision requested'} · ${date(r.at)}`,
            ),
            el('p', { className: 'prewrap' }, r.note),
          ),
        ),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('p', { className: 'eyebrow' }, 'Supervisor checkpoint'),
      el('h2', {}, 'Review the reasoning.'),
      el(
        'ul',
        { className: 'checklist' },
        stage().checks.map((c) => el('li', {}, c)),
      ),
      el('p', { className: 'small' }, stage().understanding),
      m.status === 'awaiting_review'
        ? el(
            'form',
            {
              onSubmit: (e) => {
                e.preventDefault();
                const values = Object.fromEntries(new FormData(e.currentTarget));
                const decision = e.submitter.value;
                perform(
                  async () => {
                    await mutate({ type: 'review', stageId: selected, decision, ...values });
                  },
                  decision === 'approve'
                    ? 'Local approval recorded. The next milestone is available.'
                    : 'Revision requested. Your review note has been preserved.',
                );
              },
            },
            field('reviewer', 'Reviewer name', '', '', false, { required: true, maxlength: 100 }),
            field(
              'note',
              'Reason for your decision',
              'Explain what is sound, what is uncertain, and what needs changing.',
              '',
              true,
              { required: true, minlength: 20, maxlength: 4000 },
            ),
            el(
              'div',
              { className: 'form-actions' },
              el(
                'button',
                { className: 'button', type: 'submit', value: 'approve', disabled: busy },
                'Approve this version',
              ),
              el(
                'button',
                { className: 'button quiet', type: 'submit', value: 'revise', disabled: busy },
                'Request revision',
              ),
            ),
          )
        : el(
            'p',
            { className: 'note' },
            m.status === 'approved'
              ? 'This version has been approved locally. Editing it will require another review.'
              : 'Save your work and request review from the workspace tab first.',
          ),
    ),
  );
}
function activityPanel() {
  return el(
    'section',
    {},
    el('h2', {}, 'A record of your decisions.'),
    el(
      'p',
      { className: 'muted' },
      'Saved versions, guidance runs, and local review decisions. This local history is not a tamper-proof institutional audit log.',
    ),
    project.events
      .slice()
      .reverse()
      .map((e) =>
        el(
          'div',
          { className: 'event' },
          el('time', { datetime: e.at }, date(e.at)),
          el('span', {}, e.message),
        ),
      ),
    el('h2', {}, 'Earlier artifact versions'),
    current().history.length
      ? current()
          .history.slice()
          .reverse()
          .map((h) =>
            el(
              'details',
              {},
              el('summary', {}, `Version ${h.version} · ${date(h.at)}`),
              el('p', { className: 'prewrap' }, h.artifact || '(Empty initial draft)'),
              el('p', { className: 'prewrap' }, h.explanation),
            ),
          )
      : el('p', { className: 'small muted' }, 'Versions will appear after you save changes.'),
  );
}
function aboutPanel() {
  return el(
    'section',
    { className: 'headline' },
    el('h2', {}, 'A first step toward better research.'),
    el(
      'p',
      {},
      'ResearchGuide helps beginning PhD students move from a question to a complete research package. Each milestone pairs an artifact with an explanation and a supervisor checkpoint.',
    ),
    el('h3', {}, 'What works today'),
    el(
      'p',
      {},
      'Seven guided milestones, editable artifacts, understanding prompts, source records, version history, local review decisions, dependency invalidation, exports, PDF text extraction, a claim–evidence ledger, cross-milestone consistency reviews, approved local R analyses with recorded outputs, and researcher decisions, and optional guidance using Ollama or an OpenAI-compatible API.',
    ),
    el('h3', {}, 'What is still ahead'),
    el(
      'p',
      {},
      'Authenticated collaboration, literature retrieval, full-paper verification, OCR, advanced statistical models, unrestricted-code isolation, and validated assessments of research competence. Basic CSV profiling and reviewed R template execution are available under Run analysis.',
    ),
    el('h3', {}, 'Choose your model'),
    el(
      'p',
      {},
      'Open LLM settings to choose Demo, Ollama, or an OpenAI-compatible API. Configure the endpoint, model name, and API key if required. Saved settings apply immediately. The guide makes three sequential model calls. Demo mode never sends your project to a model.',
    ),
    el('h3', {}, 'Storage and model processing'),
    el(
      'p',
      {},
      'The server saves project files and model settings in its data directory, excluded from Git. API mode sends project context to your configured provider. API keys are saved separately from project exports and are not returned by settings reads. This prototype serves one local project at a time and has no multi-user security boundary.',
    ),
  );
}
function onboardPanel() {
  return el(
    'section',
    { className: 'onboard' },
    el('p', { className: 'eyebrow' }, 'Begin a research notebook'),
    el('h1', {}, 'A good question is a place to start.'),
    el(
      'p',
      {},
      el(
        'a',
        { href: '/demo', target: '_blank', rel: 'noopener' },
        'New to research? Follow Maya’s complete fictional demo case ↗',
      ),
      ' Opens in a separate tab so you can keep your notebook here.',
    ),
    el(
      'p',
      { className: 'muted' },
      'You do not need a perfect plan. Bring an interest, a dataset, or a question. We will work through the decisions one milestone at a time.',
    ),
    el(
      'form',
      {
        onSubmit: (e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          perform(async () => {
            const response = await api('/api/new', { ...values, revision: project.revision });
            project = response.project;
            selectedPaperId = null;
            selectedPaperPage = 1;
            claimEditor = { claim: '', sourceIds: [] };
            selected = 'question';
            tab = 'conversation';
            draft = null;
            newProject = false;
          }, 'Your research notebook is ready.');
        },
      },
      field('title', 'Project title', 'A working title is enough.', '', false, {
        required: true,
        maxlength: 160,
        placeholder: 'Feedback and student learning',
      }),
      field(
        'question',
        'What would you like to investigate?',
        'Include your population, outcome, or available data if you know them.',
        '',
        true,
        { maxlength: 2000, placeholder: 'I want to understand how…' },
      ),
      el(
        'div',
        { className: 'form-actions' },
        el(
          'button',
          { className: 'button', type: 'submit', disabled: busy },
          'Create research notebook →',
        ),
        button(
          'Back to my project',
          () => {
            newProject = false;
            render();
          },
          'quiet',
        ),
      ),
    ),
    el(
      'p',
      { className: 'small muted' },
      'The previous project is archived on this computer. This release supports one active notebook at a time.',
    ),
  );
}
function settingsPanel() {
  if (!settingsDraft) settingsDraft = { ...modelSettings, apiKey: '', clearApiKey: false };
  const d = settingsDraft;
  const providerSelect = el(
    'select',
    {
      id: 'llm-provider',
      disabled: busy,
      onChange: (e) => {
        d.provider = e.target.value;
        d.apiKey = '';
        d.clearApiKey = false;
        d.baseUrl =
          d.provider === modelSettings.provider
            ? modelSettings.baseUrl
            : d.provider === 'ollama'
              ? 'http://127.0.0.1:11434'
              : 'https://api.openai.com/v1';
        d.model = d.provider === modelSettings.provider ? modelSettings.model : '';
        render();
      },
    },
    el('option', { value: 'demo' }, 'Demo — no model calls'),
    el('option', { value: 'ollama' }, 'Ollama — installed model'),
    el('option', { value: 'openai-compatible' }, 'OpenAI-compatible API'),
  );
  providerSelect.value = d.provider;
  const keepKey =
    modelSettings.hasApiKey &&
    d.provider === modelSettings.provider &&
    d.baseUrl.replace(/\/+$/, '') === modelSettings.baseUrl;
  const tokenSelect = el(
    'select',
    {
      id: 'token-parameter',
      disabled: busy,
      onChange: (e) => {
        d.tokenParameter = e.target.value;
      },
    },
    el('option', { value: 'max_completion_tokens' }, 'max_completion_tokens (OpenAI)'),
    el('option', { value: 'max_tokens' }, 'max_tokens (other compatible APIs)'),
  );
  tokenSelect.value = d.tokenParameter;
  return el(
    'div',
    { className: 'columns' },
    el(
      'section',
      {},
      el('h2', {}, 'Your choice of model.'),
      el(
        'p',
        { className: 'muted' },
        'Keep the demo, run a model with Ollama, or connect a hosted API. Saving these settings does not send a model request.',
      ),
      el(
        'form',
        {
          onSubmit: (e) => {
            e.preventDefault();
            const values = { ...d, revision: modelSettings.revision };
            perform(async () => {
              const response = await api('/api/settings', values);
              modelSettings = response.settings;
              mode = modelSettings.provider;
              model = modelSettings.model;
              settingsDraft = null;
            }, 'Model settings saved. Your next guide run will use this provider.');
          },
        },
        el(
          'div',
          { className: 'form-row' },
          el('label', { className: 'field', for: 'llm-provider' }, 'Provider'),
          providerSelect,
        ),
        d.provider !== 'demo' && [
          field(
            'base-url',
            'API base URL',
            d.provider === 'ollama'
              ? 'For example, http://127.0.0.1:11434. Do not append /api/chat.'
              : 'For OpenAI, https://api.openai.com/v1. For other providers, use their compatible base URL, without /chat/completions.',
            d.baseUrl,
            false,
            {
              type: 'url',
              required: true,
              maxlength: 2000,
              onInput: (e) => {
                d.baseUrl = e.target.value;
              },
            },
          ),
          field(
            'model-name',
            'Model name',
            'Enter the exact model ID available in your provider account or installed in Ollama.',
            d.model,
            false,
            {
              required: true,
              maxlength: 200,
              onInput: (e) => {
                d.model = e.target.value;
              },
            },
          ),
          field(
            'api-key',
            'API key',
            `${keepKey ? 'A key is saved. Leave blank to retain it for this same endpoint.' : 'Enter your provider key, or leave blank if this endpoint does not require one.'} Changing endpoint never transfers a saved key.`,
            d.apiKey,
            false,
            {
              type: 'password',
              autocomplete: 'new-password',
              maxlength: 4096,
              onInput: (e) => {
                d.apiKey = e.target.value;
              },
            },
          ),
          el(
            'label',
            { className: 'checkbox-label' },
            el('input', {
              type: 'checkbox',
              checked: d.clearApiKey,
              disabled: busy,
              onChange: (e) => {
                d.clearApiKey = e.target.checked;
              },
            }),
            'Remove the saved API key when saving',
          ),
          field(
            'output-tokens',
            'Output token limit per call',
            '128–16384. Reasoning models may need a larger limit. A guidance run makes three calls.',
            d.maxOutputTokens,
            false,
            {
              type: 'number',
              min: 128,
              max: 16384,
              required: true,
              onInput: (e) => {
                d.maxOutputTokens = Number(e.target.value);
              },
            },
          ),
          d.provider === 'openai-compatible' &&
            el(
              'div',
              { className: 'form-row' },
              el(
                'label',
                { className: 'field', for: 'token-parameter' },
                'Output limit parameter',
                el(
                  'span',
                  { className: 'help' },
                  'Select the parameter supported by your provider. Native Anthropic and Responses-only endpoints are not supported.',
                ),
              ),
              tokenSelect,
            ),
        ],
        el(
          'div',
          { className: 'form-actions' },
          el(
            'button',
            { type: 'submit', className: 'button', disabled: busy },
            'Save model settings',
          ),
          button(
            'Test saved connection',
            () =>
              perform(async () => {
                const response = await api('/api/settings/test', {
                  revision: modelSettings.revision,
                });
                notice(response.message);
              }),
            'quiet',
            { disabled: busy || modelSettings.provider === 'demo' },
          ),
        ),
      ),
      el(
        'p',
        { className: 'small muted' },
        'The connection test uses the saved configuration and sends only a short test prompt. It may incur a small API charge. Unsaved form edits are not tested.',
      ),
    ),
    el(
      'aside',
      { className: 'guide-aside' },
      el('p', { className: 'eyebrow' }, 'Before you connect'),
      el('h2', {}, 'Know where your work goes.'),
      el(
        'p',
        { className: 'small' },
        'Demo mode sends nothing. Model guidance sends your saved artifact, explanation, source passages, earlier milestones, and question to the configured endpoint.',
      ),
      el(
        'p',
        { className: 'small' },
        'Keys are stored in a separate local settings file, excluded from Git and project exports. This file is not encrypted; protect access to this computer. A saved key is never sent back to the browser.',
      ),
      el(
        'p',
        { className: 'small' },
        'Saved UI settings override .env defaults and apply without restarting. Switching to Demo removes the key from the active saved settings.',
      ),
      el(
        'p',
        { className: 'small' },
        'Use HTTPS for remote APIs. Plain HTTP is accepted only on localhost. Model output remains guidance, not supervisor approval.',
      ),
    ),
  );
}
function render() {
  if (!project) return;
  if (!draft) draft = { artifact: current().artifact, explanation: current().explanation };
  const panels = {
    workspace,
    conversation: conversationPanel,
    guide: guidePanel,
    sources: sourcesPanel,
    claims: claimsPanel,
    consistency: consistencyPanel,
    execution: executionPanel,
    review: reviewPanel,
    activity: activityPanel,
    about: aboutPanel,
    settings: settingsPanel,
  };
  const tabs = [
    ['conversation', 'Guided conversation'],
    ['workspace', 'Your workspace'],
    ['guide', 'Research team'],
    ['sources', 'Sources'],
    ['claims', 'Claims & evidence'],
    ['consistency', 'Consistency review'],
    ['execution', 'Run analysis'],
    ['review', 'Supervisor review'],
    ['activity', 'History'],
  ];
  root.replaceChildren(
    el(
      'div',
      { className: 'shell' },
      sidebar(),
      el(
        'div',
        { className: 'content' },
        topbar(),
        el(
          'main',
          { id: 'main', className: 'workspace', 'aria-busy': busy },
          newProject
            ? onboardPanel()
            : [
                tab === 'settings'
                  ? el(
                      'header',
                      { className: 'headline' },
                      el('p', { className: 'eyebrow' }, 'ResearchGuide / Configuration'),
                      el('h1', {}, 'LLM settings'),
                    )
                  : heading(),
                el(
                  'nav',
                  { className: 'tabs', 'aria-label': 'Milestone views' },
                  tabs.map(([id, label]) =>
                    el(
                      'button',
                      {
                        type: 'button',
                        className: `tab ${tab === id ? 'active' : ''}`,
                        disabled: busy,
                        'aria-pressed': tab === id,
                        onClick: () => {
                          tab = id;
                          render();
                        },
                      },
                      label,
                    ),
                  ),
                ),
                busy &&
                  el(
                    'p',
                    { role: 'status', className: 'small muted' },
                    el('span', { className: 'busy' }),
                    ' Working… Model guidance can take a few minutes.',
                  ),
                panels[tab](),
              ],
        ),
      ),
    ),
  );
}
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
async function load() {
  try {
    const data = await api('/api/project');
    ({ project, stages, mode, model } = data);
    modelSettings = data.settings;
    selected = project.milestones.find((m) => m.status !== 'approved')?.id || 'writing';
    render();
  } catch (error) {
    root.replaceChildren(
      el(
        'main',
        { className: 'loading' },
        el('h1', {}, 'Your notebook could not open.'),
        el('p', {}, error.message),
        button('Try again', load),
      ),
    );
  }
}
load();
