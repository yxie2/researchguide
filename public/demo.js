const root = document.querySelector('#demo');
let data,
  index = -1,
  revealed = 1,
  answer = null,
  decisionAnswer = null;
const business = new URLSearchParams(location.search).get('case') === 'business';
const key = business ? 'researchguide-business-case-v2' : 'researchguide-teaching-case-v2';
const researcher = () => data.researcher || 'Maya';
const documentNames = {
  question: 'research direction',
  evidence: 'literature review and research question',
  design: 'study protocol',
  data: 'data preparation and quality report',
  analysis: 'analysis record',
  interpretation: 'conclusions and limitations',
  writing: 'research report',
};
const documentHeading = (stage) => `${researcher()}’s accepted ${documentNames[stage.id]}`;
const seen = new Set();
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value !== null && value !== false)
      node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity))
    if (child !== null && child !== false && child !== undefined)
      node.append(child instanceof Node ? child : document.createTextNode(child));
  return node;
}
function button(label, fn, quiet = false, attrs = {}) {
  return el(
    'button',
    { type: 'button', class: `button ${quiet ? 'quiet' : ''}`, onClick: fn, ...attrs },
    label,
  );
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify({ index, revealed, seen: [...seen] }));
  } catch {
    /* Works without storage. */
  }
}
function go(next) {
  index = next;
  revealed = 1;
  answer = null;
  decisionAnswer = null;
  save();
  render();
  document.querySelector('h1').focus();
  window.scrollTo(0, 0);
}
function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = el('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function notebook() {
  return (
    `# ${data.title}\n\n${data.disclosure}\n\n` +
    data.stages
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.title}\n\nIncoming context: ${s.input}\n\n` +
          s.tasks.map((t, j) => `### Task ${j + 1}. ${t.title}\n\n${t.example}\n`).join('\n') +
          s.turns.map(([who, text]) => `**${who}:** ${text}`).join('\n\n') +
          '\n\n' +
          (s.sources || [])
            .map((s) => `### ${s.id}: ${s.title}\n\n> ${s.passage}\n\n${s.limitation}`)
            .join('\n\n') +
          `\n\n### ${documentHeading(s)}\n\n${s.artifact}\n\n${researcher()}’s explanation (${s.checkpoint ? 'for supervisor review' : 'optional reflection'}): ${s.understanding}\n\n${s.checkpoint ? 'Required checkpoint in live projects' : 'Optional discussion'}: ${s.review}\n\nCarried forward: ${s.carry}\n\n### Decision exercise: ${s.depth.complication}\n\n${s.depth.prompt}\n\n${s.depth.options.map(([choice, consequence]) => `- ${choice}: ${consequence}`).join('\n')}\n\nRecorded decision: ${s.depth.decision}\n`,
      )
      .join('\n') +
    `\n## Authored search and screening\n\n${data.search.disclosure}\n${data.search.results.map((r) => `- ${r.label}: ${r.status}`).join('\n')}\n\n## Public-data candidate decisions (simulated)\n\n${data.publicCandidates.map((c) => `- ${c.title}: ${c.decision}`).join('\n')}\n\n## Reproduction\n\nR results built ${data.builtAt}. Save run.inputCsv as input.csv and run.script as analysis.R from the reproduction JSON, then run Rscript analysis.R in a clean directory. Repeat in a separate directory using sensitivity.run for R2. No external R packages are needed. Dataset preparation instructions and code are included in the dataset workspace download. This export is a teaching narrative, not an importable active notebook.\n`
  );
}
function downloads() {
  return el(
    'section',
    { class: 'demo-downloads' },
    el('h2', {}, 'Take the example apart.'),
    el(
      'p',
      {},
      'Download the fictional case and inspect the original data, script and computed outputs. You can import the CSV into your own notebook to practice the approval and execution steps.',
    ),
    el(
      'div',
      { class: 'toolbar' },
      button('Download walkthrough (.md)', () => download(`${data.id}-walkthrough.md`, notebook())),
      button(
        'Download synthetic CSV',
        () => download(data.datasetName || 'synthetic-study-hours.csv', data.csv, 'text/csv'),
        true,
      ),
      button(
        'Download reproduction bundle',
        () =>
          download(
            `${data.id}-reproduction.json`,
            JSON.stringify(
              {
                disclosure: data.disclosure,
                reproduce:
                  'Save run.inputCsv as input.csv and run.script as analysis.R in a clean directory. Run Rscript analysis.R. Repeat in a separate directory with sensitivity.run. See each run.files["session.txt"] for its original environment.',
                ...data.computation,
              },
              null,
              2,
            ),
            'application/json',
          ),
        true,
      ),
      button(
        'Download dataset workspace',
        () =>
          download(
            `${data.id}-datasets.json`,
            JSON.stringify(
              {
                disclosure: data.disclosure,
                instructions:
                  'Save each datasets[].csv with its dataset name. Save preparation.script as prepare.mjs; run node prepare.mjs raw-register.csv primary-rebuilt.csv. Compare the result with D1. This is not a project backup.',
                datasets: data.computation.datasets,
                preparation: data.computation.preparation,
              },
              null,
              2,
            ),
            'application/json',
          ),
        true,
      ),
    ),
    el(
      'p',
      { class: 'small muted' },
      'The walkthrough is a readable teaching report. The reproduction JSON contains synthetic row-level data and run provenance; it is not a project-import file.',
    ),
  );
}
function outputs(exploratory = false) {
  const run = exploratory ? data.computation.sensitivity.run : data.computation.run;
  return el(
    'section',
    { class: 'demo-outputs' },
    el('h2', {}, exploratory ? 'Exploratory R2 outputs' : 'Recorded R outputs'),
    el(
      'p',
      {},
      exploratory
        ? 'Highest complete exposure omitted after the primary result was known. This separately approved run is one sensitivity check; retain R1 and report both.'
        : 'Primary R1: the planned complete-case association in the synthetic sample.',
    ),
    el(
      'p',
      { class: 'small' },
      `Computed when the demo was built: ${new Date(data.builtAt).toLocaleDateString()}. ${run.rVersion}. These numbers were not generated by a language model.`,
    ),
    ['counts.csv', 'coefficients.csv', 'diagnostics.csv'].map((name) =>
      el(
        'details',
        { open: name === 'counts.csv' },
        el('summary', {}, name),
        el('pre', { class: 'demo-artifact' }, run.files[name]),
      ),
    ),
    el(
      'details',
      {},
      el('summary', {}, 'Exact script, environment and execution log'),
      el('pre', { class: 'demo-artifact' }, run.script),
      el('pre', { class: 'demo-artifact' }, run.files['session.txt']),
      el('pre', { class: 'demo-artifact' }, run.log),
    ),
    el(
      'div',
      { class: 'toolbar' },
      button('Download R script', () => download('analysis.R', run.script), true),
      button('Download R input', () => download('input.csv', run.inputCsv, 'text/csv'), true),
      button(
        'Download computed figure',
        () => download('figure.svg', run.files['figure.svg'], 'image/svg+xml'),
        true,
      ),
    ),
  );
}
function workspaceFiles() {
  return el(
    'section',
    { class: 'demo-datasets' },
    el('h2', {}, 'Four datasets, four distinct roles'),
    el(
      'p',
      {},
      'All files are synthetic and stored with the demo. These are actual downloadable CSVs; no public repository was contacted.',
    ),
    data.computation.datasets.map((d) =>
      el(
        'details',
        {},
        el('summary', {}, `${d.id} · ${d.name} · ${d.rowCount} rows`),
        el('p', {}, d.notes || 'Primary harmonized extract used for R1.'),
        el('p', { class: 'small' }, `SHA-256: ${d.sha256}`),
        el('pre', { class: 'demo-artifact' }, d.csv),
        button(`Download ${d.id} CSV`, () => download(d.name, d.csv, 'text/csv'), true),
      ),
    ),
    el(
      'details',
      {},
      el('summary', {}, 'Reproduce preparation and inspect the transformation log'),
      el('p', {}, data.computation.preparation.scope),
      el(
        'ul',
        {},
        data.computation.preparation.log.map((t) => el('li', {}, t)),
      ),
      el(
        'p',
        {},
        'Save D2 as raw-register.csv, download prepare.mjs, then run: node prepare.mjs raw-register.csv primary-rebuilt.csv. The output should match D1 exactly.',
      ),
      el('pre', { class: 'demo-artifact' }, data.computation.preparation.script),
      button(
        'Download preparation script',
        () => download('prepare.mjs', data.computation.preparation.script),
        true,
      ),
    ),
    el(
      'details',
      {},
      el('summary', {}, 'Public dataset candidate decisions (simulated)'),
      data.publicCandidates.map((c) =>
        el('section', {}, el('h3', {}, c.title), el('p', {}, c.decision)),
      ),
    ),
  );
}
function decisionExercise(s) {
  const d = s.depth;
  return el(
    'section',
    { class: 'demo-challenge demo-decision' },
    el('h3', {}, d.complication),
    el('p', {}, d.prompt),
    d.options.map(([choice], i) =>
      button(
        choice,
        () => {
          decisionAnswer = i;
          render();
        },
        true,
        { 'aria-pressed': decisionAnswer === i },
      ),
    ),
    decisionAnswer !== null &&
      el(
        'div',
        { role: 'status' },
        el(
          'p',
          {},
          `${decisionAnswer === d.correct ? 'Defensible choice. ' : 'Consider the consequence. '}${d.options[decisionAnswer][1]}`,
        ),
        el('p', {}, `In this case: ${d.decision}`),
      ),
    el(
      'p',
      { class: 'small muted' },
      'This exercise reveals consequences; it does not change the saved example or run an agent.',
    ),
  );
}
function scene() {
  const s = data.stages[index],
    complete = revealed >= s.turns.length;
  return [
    el(
      'header',
      { class: 'headline' },
      el('p', { class: 'eyebrow' }, `Fictional case / Step ${index + 1} of 7`),
      el('p', { class: 'step-project-title' }, data.title),
      el('h1', { tabindex: '-1' }, s.title),
      el('p', {}, s.input),
    ),
    el(
      'section',
      { class: 'demo-task-sequence', 'aria-label': 'Tasks in this step' },
      s.tasks.map((t, j) =>
        el(
          'details',
          {},
          el('summary', {}, `${j + 1}. ${t.title}`),
          el('p', {}, t.description),
          el('p', {}, t.example),
        ),
      ),
      el(
        'p',
        { class: 'small muted' },
        s.checkpoint
          ? 'This step includes a required supervisor checkpoint in a live project. The decisions below are fictional.'
          : 'Use Save and continue when ready. Guide conversations, mentor feedback and extra supervisor discussions are optional; shared tools remain in Project materials.',
      ),
    ),
    el(
      'div',
      { class: 'columns' },
      el(
        'section',
        {},
        el('h2', {}, 'Watch the conversation'),
        el(
          'p',
          { class: 'small muted' },
          `Authored simulation. Reveal each exchange to see ${researcher()} question, revise and accept the work.`,
        ),
        el(
          'div',
          { class: 'demo-transcript', 'aria-live': 'polite', 'aria-relevant': 'additions' },
          s.turns
            .slice(0, revealed)
            .map(([who, text]) =>
              el(
                'article',
                { class: `demo-turn ${who.startsWith(researcher()) ? 'researcher' : 'mentor'}` },
                el('p', { class: 'eyebrow' }, who),
                el('p', {}, text),
              ),
            ),
        ),
        !complete &&
          el(
            'div',
            { class: 'toolbar' },
            button('Reveal next exchange', () => {
              revealed++;
              if (revealed >= s.turns.length) seen.add(s.id);
              save();
              render();
              document
                .querySelector('.demo-transcript article:last-child')
                .scrollIntoView({ block: 'nearest' });
            }),
            button(
              'Show full step',
              () => {
                revealed = s.turns.length;
                seen.add(s.id);
                save();
                render();
              },
              true,
            ),
          ),
        complete && [
          s.sources?.map((source) =>
            el(
              'article',
              { class: 'demo-source' },
              el('h3', {}, `${source.id} · ${source.title}`),
              el('blockquote', {}, source.passage),
              el('p', { class: 'small' }, source.limitation),
            ),
          ),
          el('h2', {}, documentHeading(s)),
          el('pre', { class: 'demo-artifact' }, s.artifact),
          el(
            'details',
            { open: s.checkpoint },
            el(
              'summary',
              {},
              s.checkpoint
                ? 'Reasoning and supervisor checkpoint'
                : 'Optional reflection and supervisor discussion',
            ),
            el('p', {}, s.understanding),
            el('p', {}, s.review),
          ),
          el(
            'details',
            {},
            el('summary', {}, 'How the saved decisions changed (authored history)'),
            el(
              'ol',
              {},
              s.depth.revision.map((r) => el('li', {}, r)),
            ),
          ),
          index === 1 &&
            el(
              'details',
              {},
              el('summary', {}, 'Search and screening record (simulated)'),
              el('p', {}, data.search.disclosure),
              data.search.results.map((r) => el('p', {}, `${r.id} · ${r.label}: ${r.status}`)),
            ),
          index === 3 &&
            el(
              'details',
              {},
              el('summary', {}, `Inspect all ${data.computation.dataset.rowCount} synthetic rows`),
              el('pre', { class: 'demo-artifact' }, data.csv),
            ),
          index === 3 && workspaceFiles(),
          index === 4 && [
            outputs(),
            el(
              'details',
              {},
              el('summary', {}, 'Compare the exploratory sensitivity run'),
              outputs(true),
            ),
          ],
          index === 6 && downloads(),
        ],
      ),
      el(
        'aside',
        { class: 'guide-aside' },
        el('p', { class: 'eyebrow' }, 'How steps connect'),
        el('h2', {}, 'Carry the decision forward.'),
        el('p', {}, s.carry),
        decisionExercise(s),
        s.challenge &&
          el(
            'section',
            { class: 'demo-challenge' },
            el('h3', {}, 'Pause and decide'),
            el('p', {}, s.challenge.question),
            s.challenge.choices.map((choice, i) =>
              button(
                choice,
                () => {
                  answer = i;
                  render();
                },
                true,
                { 'aria-pressed': answer === i },
              ),
            ),
            answer !== null &&
              el(
                'p',
                { role: 'status' },
                `${answer === s.challenge.correct ? 'Yes. ' : 'Reconsider. '}${s.challenge.feedback}`,
              ),
          ),
        el(
          'p',
          { class: 'small muted' },
          'In your own project, accepted drafts become saved context. Changes can make later plans and reviews stale. The researcher remains responsible for checking evidence and methods.',
        ),
      ),
    ),
    el(
      'nav',
      { class: 'demo-footer toolbar', 'aria-label': 'Walkthrough pages' },
      button(index === 0 ? 'Case overview' : 'Previous step', () => go(index - 1), true),
      index < 6
        ? button('Next step →', () => go(index + 1))
        : button('Return to case overview', () => go(-1)),
    ),
  ];
}
function overview() {
  return [
    el(
      'header',
      { class: 'headline' },
      el('p', { class: 'eyebrow' }, 'An extended worked example / Explore at your own pace'),
      el('h1', { tabindex: '-1' }, data.title),
      el('p', {}, data.subtitle),
    ),
    el(
      'div',
      { class: 'columns' },
      el(
        'section',
        {},
        el('h2', {}, 'A first study, including the wrong turns.'),
        el(
          'p',
          {},
          data.overview ||
            'Maya begins by wanting to prove a causal claim. Follow how she narrows the question, challenges a source, chooses a protocol, handles missing data, reviews an R plan, corrects her conclusion and assembles a transparent report.',
        ),
        el(
          'p',
          {},
          `Choose a step in the sidebar or reveal the conversation one exchange at a time. Each step shows the research document ${researcher()} accepted, the reasoning behind it and what carries forward. This teaching example includes extra supervisor discussions; your live project requires checkpoints only for the protocol and final report.`,
        ),
        button('Start the seven-step walkthrough', () => go(0)),
        el(
          'p',
          { class: 'small muted demo-spacing' },
          `${seen.size} of 7 step conversations explored in this browser. Progress is saved locally when browser storage is available.`,
        ),
      ),
      el(
        'aside',
        { class: 'guide-aside' },
        el('h2', {}, 'What you will learn'),
        el(
          'ul',
          {},
          [
            'How agents use decisions from earlier steps.',
            'Why accepting a draft requires your judgment.',
            'How a claim is checked against an inspected passage.',
            'How approved code produces recorded results.',
            'How a consistency review catches an overclaim.',
            'How to screen duplicates, preprints and inaccessible literature.',
            'How raw data, harmonized data and contextual files stay distinct.',
            'How to retain primary and exploratory results with separate approvals.',
            'How revision requests and changed context affect later work.',
          ].map((t) => el('li', {}, t)),
        ),
        el(
          'p',
          { class: 'small' },
          'This case is deliberately tiny. It demonstrates the process; it is not a model of adequate sample size or a publication-ready study.',
        ),
      ),
    ),
    downloads(),
  ];
}
function render() {
  root.replaceChildren(
    el(
      'div',
      { class: 'shell' },
      el(
        'aside',
        { class: 'sidebar' },
        el(
          'div',
          { class: 'brand' },
          el('img', { class: 'brand-logo', src: '/researchguide-logo.png', alt: 'ResearchGuide' }),
          el('small', {}, 'Learn through a worked example'),
        ),
        el(
          'p',
          { class: 'eyebrow' },
          `${researcher()}’s fictional ${business ? 'business' : 'first'} study`,
        ),
        el(
          'nav',
          { class: 'stage-nav', 'aria-label': 'Demo steps' },
          button('Case overview', () => go(-1), true),
          data.stages.map((s, i) =>
            el(
              'button',
              {
                type: 'button',
                class: `stage-button ${index === i ? 'active' : ''}`,
                'aria-current': index === i ? 'step' : null,
                onClick: () => go(i),
              },
              el('span', { class: 'stage-number' }, String(i + 1).padStart(2, '0')),
              s.title,
            ),
          ),
        ),
        button(
          'Restart walkthrough',
          () => {
            seen.clear();
            go(-1);
          },
          true,
        ),
      ),
      el(
        'div',
        { class: 'content' },
        el(
          'div',
          { class: 'topbar' },
          el('span', { class: 'mode' }, 'Fictional teaching case · No AI calls'),
          el('a', { class: 'button quiet', href: '/' }, 'Open my notebook'),
        ),
        el(
          'main',
          { id: 'main', class: 'workspace', tabindex: '-1' },
          el(
            'nav',
            { class: 'demo-case-picker toolbar', 'aria-label': 'Choose a demo case' },
            el('span', { class: 'small' }, 'Choose a case:'),
            el(
              'a',
              { class: 'button quiet', href: '/demo', 'aria-current': business ? null : 'page' },
              'Education · Study habits',
            ),
            el(
              'a',
              {
                class: 'button quiet',
                href: '/demo?case=business',
                'aria-current': business ? 'page' : null,
              },
              'Business · Training and sales',
            ),
          ),
          el('p', { class: 'demo-disclosure' }, data.disclosure),
          index === -1 ? overview() : scene(),
        ),
      ),
    ),
  );
}
async function load() {
  try {
    const response = await fetch(business ? '/business-demo-case.json' : '/demo-case.json');
    if (!response.ok) throw new Error('The teaching case could not be loaded.');
    data = await response.json();
    document.title = `ResearchGuide — ${data.title}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Number.isInteger(saved.index) && saved.index >= -1 && saved.index < 7) {
        index = saved.index;
        revealed = Math.max(
          1,
          Math.min(Number(saved.revealed) || 1, data.stages[index]?.turns.length || 1),
        );
        for (const id of Array.isArray(saved.seen) ? saved.seen : [])
          if (data.stages.some((s) => s.id === id)) seen.add(id);
      }
    } catch {
      /* Ignore unavailable or invalid local progress. */
    }
    render();
  } catch (error) {
    root.replaceChildren(
      el(
        'main',
        { class: 'loading' },
        el('h1', {}, 'The demo could not open.'),
        el('p', {}, error.message),
        button('Try again', load),
        el('a', { href: '/' }, 'Open my notebook'),
      ),
    );
  }
}
load();
