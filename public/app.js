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
      !turns.length &&
        el(
          'div',
          { className: 'empty' },
          el(
            'p',
            {},
            `We’ll begin with “${project.question || project.title}”. You do not need to complete the notebook first.`,
          ),
          button(
            'Start guiding me',
            () =>
              send(
                'Help me begin this milestone. Start from my project interest and ask me the most useful first question.',
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
          : `Each turn sends saved research context and this milestone’s conversation to ${modelSettings.baseUrl}.`,
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
      'Seven guided milestones, editable artifacts, understanding prompts, source records, version history, local review decisions, dependency invalidation, exports, and an optional mentor/reviewer/coordinator sequence using Ollama or an OpenAI-compatible API.',
    ),
    el('h3', {}, 'What is still ahead'),
    el(
      'p',
      {},
      'Authenticated collaboration, literature retrieval, citation verification, dataset inspection, sandboxed R execution, and validated assessments of research competence. The analysis milestone currently records work you perform in your own analysis environment.',
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
