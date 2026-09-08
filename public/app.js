const $ = (selector) => document.querySelector(selector);
const root = $('#app');
let project,
  stages = [],
  mode = 'demo',
  model = null,
  selected = 'question',
  tab = 'workspace',
  draft,
  busy = false,
  newProject = false,
  noticeTimer;
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
  const inputs = [...document.querySelectorAll('input[id], textarea[id]')].map((node) => [
    node.id,
    node.value,
  ]);
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
      for (const [id, value] of inputs) {
        const node = document.getElementById(id);
        if (node) node.value = value;
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
  tab = 'workspace';
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
      mode === 'demo' ? '◌ Demo guide · No AI calls' : `● Local AI · ${model}`,
    ),
    el(
      'div',
      { className: 'toolbar' },
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
          });
          project = response.project;
        }, 'Guidance saved in your project history.');
      },
    },
    field(
      'guide-question',
      'Where are you getting stuck?',
      mode === 'demo'
        ? 'The demo returns a milestone-specific worked example. Connect Ollama for answers to your question.'
        : 'The local model will use your saved artifact, sources, and student explanation.',
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
          `${latest.mode === 'demo' ? 'Deterministic demo' : `Model: ${latest.model}`} · Artifact v${latest.artifactVersion} · ${date(latest.finishedAt)}${latest.artifactVersion !== current().version ? ' · Your artifact has changed since this run.' : ''}`,
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
        'Record sources you have inspected. Cite their IDs, such as S1, in your artifacts. This prototype does not search the web or verify passages.',
      ),
      project.sources.map((s) =>
        el(
          'article',
          { className: 'source' },
          el('span', { className: 'status' }, `${s.id} · User-provided`),
          el('h3', {}, s.title),
          el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.url),
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
      'Seven guided milestones, editable artifacts, understanding prompts, source records, version history, local review decisions, dependency invalidation, Markdown and JSON exports, and an optional local-model mentor/reviewer/coordinator sequence.',
    ),
    el('h3', {}, 'What is still ahead'),
    el(
      'p',
      {},
      'Authenticated collaboration, literature retrieval, citation verification, dataset inspection, sandboxed R execution, and validated assessments of research competence. The analysis milestone currently records work you perform in your own analysis environment.',
    ),
    el('h3', {}, 'Connect a local model'),
    el(
      'p',
      {},
      'Install Ollama and a model, copy .env.example to .env, set OLLAMA_MODEL to the installed model name, then restart the server. The guide makes three sequential model calls. Demo mode never sends your project to a model.',
    ),
    el('h3', {}, 'Your project stays on this computer'),
    el(
      'p',
      {},
      'The server saves files in its data directory, excluded from Git. Export a JSON copy for backup. Creating a new project archives the previous one on disk. This prototype serves one local project at a time and has no multi-user security boundary.',
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
            selected = 'question';
            tab = 'workspace';
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
function render() {
  if (!project) return;
  if (!draft) draft = { artifact: current().artifact, explanation: current().explanation };
  const panels = {
    workspace,
    guide: guidePanel,
    sources: sourcesPanel,
    review: reviewPanel,
    activity: activityPanel,
    about: aboutPanel,
  };
  const tabs = [
    ['workspace', 'Your workspace'],
    ['guide', 'Research team'],
    ['sources', 'Sources'],
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
                heading(),
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
                    ' Working… Local-model guidance can take a few minutes.',
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
