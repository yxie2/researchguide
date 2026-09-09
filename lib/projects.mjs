import { readFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { stages, WorkflowError } from './workflow.mjs';

export const BACKUP_LIMIT = 64 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const fail = (field) => {
  throw new WorkflowError(
    `Invalid project backup: ${field}. Export a project backup from ResearchGuide and try again.`,
  );
};
const object = (v, name) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(name);
};
const string = (v, name) => {
  if (typeof v !== 'string') fail(name);
};
const integer = (v, name) => {
  if (!Number.isSafeInteger(v) || v < 0) fail(name);
};
function list(v, name, check) {
  if (!Array.isArray(v)) fail(name);
  v.forEach((item) => {
    object(item, name);
    check?.(item);
  });
}
function strings(v, name) {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) fail(name);
}
function fields(v, names) {
  names.forEach((n) => string(v[n], n));
}
function unique(v, name) {
  if (new Set(v.map((s) => s.id)).size !== v.length) fail(`${name} contains duplicate IDs`);
}
function contexts(v) {
  list(v, 'context versions', (s) => {
    if (!stages.some((stage) => stage.id === s.id)) fail('context milestone');
    integer(s.version, 'context version');
  });
}

export function validateProject(p) {
  object(p, 'project');
  if (p.schemaVersion !== 1 || !uuid.test(p.id)) fail('project version or ID');
  fields(p, ['title', 'question', 'createdAt']);
  if (!p.title.trim() || p.title.length > 160) fail('title');
  integer(p.revision, 'revision');
  list(p.milestones, 'milestones', (m) => {
    fields(m, ['id', 'artifact', 'explanation']);
    integer(m.version, 'milestone version');
    if (!['draft', 'needs_revision', 'awaiting_review', 'approved'].includes(m.status))
      fail('milestone status');
    list(m.reviews, 'reviews', (r) => fields(r, ['reviewer', 'note', 'decision']));
    list(m.history, 'history', (h) => fields(h, ['artifact', 'explanation']));
    list(m.guideRuns, 'guide runs', (r) => {
      list(r.trace, 'guide trace', (t) => fields(t, ['task', 'agent', 'output']));
      if (!r.trace.length) fail('empty guide trace');
    });
    if (m.conversation !== undefined)
      list(m.conversation, 'conversation', (t) => {
        fields(t, ['message', 'reply', 'question']);
        strings(t.gaps, 'conversation gaps');
        if (t.draft !== null) string(t.draft, 'proposed draft');
      });
  });
  if (p.milestones.length !== stages.length || p.milestones.some((m, i) => m.id !== stages[i].id))
    fail('seven ordered milestones required');
  list(p.events, 'events', (e) => fields(e, ['id', 'at', 'type', 'message']));
  list(p.sources, 'sources', (s) => {
    fields(s, ['id', 'title', 'passage', 'location']);
    if (s.url) {
      let u;
      try {
        u = new URL(s.url);
      } catch {
        fail('source URL');
      }
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) fail('source URL');
    }
  });
  for (const name of [
    'papers',
    'claims',
    'datasets',
    'analysisPlans',
    'analysisRuns',
    'consistencyReports',
  ]) {
    if (p[name] !== undefined) {
      list(p[name], name);
      unique(p[name], name);
    }
  }
  unique(p.sources, 'sources');
  for (const paper of p.papers || []) {
    fields(paper, ['id', 'title', 'sha256']);
    if (!hash.test(paper.sha256)) fail('paper hash');
    list(paper.pages, 'paper pages', (page) => string(page.text, 'page text'));
  }
  for (const c of p.claims || []) {
    fields(c, ['id', 'claim']);
    strings(c.sourceIds, 'claim source IDs');
    if (c.sourceIds.some((id) => !p.sources.some((s) => s.id === id))) fail('unknown claim source');
    list(c.history, 'claim history');
    list(c.assessments, 'claim assessments', (a) => {
      fields(a, ['verdict']);
      list(a.sources, 'assessment sources');
      if (a.confirmations !== undefined) list(a.confirmations, 'confirmations');
    });
  }
  for (const d of p.datasets || []) {
    fields(d, ['id', 'name', 'csv', 'sha256']);
    if (createHash('sha256').update(d.csv).digest('hex') !== d.sha256)
      fail('dataset hash mismatch');
    list(d.columns, 'dataset columns', (c) => {
      fields(c, ['name']);
      integer(c.index, 'column index');
    });
  }
  for (const plan of p.analysisPlans || []) {
    fields(plan, ['id', 'datasetId', 'script', 'planHash']);
    if (!(p.datasets || []).some((d) => d.id === plan.datasetId)) fail('plan dataset');
    contexts(plan.contextVersions);
    list(plan.approvals, 'execution approvals');
  }
  for (const run of p.analysisRuns || []) {
    fields(run, ['id', 'planId', 'datasetId', 'script', 'inputCsv', 'log']);
    contexts(run.contextVersions);
    object(run.files, 'run files');
    Object.values(run.files).forEach((v) => string(v, 'run output'));
    if (
      !(p.analysisPlans || []).some((plan) => plan.id === run.planId) ||
      !(p.datasets || []).some((d) => d.id === run.datasetId)
    )
      fail('run references');
  }
  for (const r of p.consistencyReports || []) {
    strings(r.missing, 'missing milestones');
    list(r.snapshot, 'consistency snapshot', (s) => {
      if (s.id !== 'execution' && !stages.some((m) => m.id === s.id)) fail('snapshot milestone');
      fields(s, ['artifact', 'explanation']);
      integer(s.version, 'snapshot version');
    });
    list(r.findings, 'consistency findings', (f) => {
      fields(f, ['id', 'kind', 'dimension', 'title', 'explanation', 'recommendation']);
      list(f.references, 'finding references', (ref) => {
        if (ref.stageId !== 'execution' && !stages.some((m) => m.id === ref.stageId))
          fail('finding milestone');
        fields(ref, ['field', 'quote']);
      });
      list(f.decisions, 'finding decisions');
    });
  }
  // Reject prototype keys and embedded configuration; imports are research data only.
  const walk = (v, depth = 0) => {
    if (depth > 40) fail('excessive nesting');
    if (v && typeof v === 'object')
      for (const [k, child] of Object.entries(v)) {
        if (k === 'id' && (typeof child !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(child)))
          fail('record ID');
        if (['__proto__', 'constructor', 'prototype', 'apiKey', 'modelSettings'].includes(k))
          fail('unsupported configuration or object key');
        walk(child, depth + 1);
      }
  };
  walk(p);
  return p;
}

export function parseBackup(input) {
  const p = validateProject(input?.backupVersion === 1 ? input.project : input);
  const attachments = input?.backupVersion === 1 ? input.attachments : [];
  list(attachments, 'PDF attachments');
  const files = attachments.map((a) => {
    if (
      !hash.test(a.sha256) ||
      typeof a.base64 !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64)
    )
      fail('PDF attachment');
    const bytes = Buffer.from(a.base64, 'base64');
    if (
      !(p.papers || []).some((paper) => paper.sha256 === a.sha256) ||
      createHash('sha256').update(bytes).digest('hex') !== a.sha256 ||
      !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
    )
      fail('PDF attachment hash or content');
    return { sha256: a.sha256, bytes };
  });
  return { project: structuredClone(p), files };
}

export function projectSummary(p, active = false) {
  return {
    id: p.id,
    title: p.title,
    revision: p.revision,
    createdAt: p.createdAt,
    updatedAt: p.events.at(-1)?.at || p.createdAt,
    approved: p.milestones.filter((m) => m.status === 'approved').length,
    active,
    imported: Boolean(p.importedFromId),
  };
}

export async function savedProjects(dataDir, active) {
  const found = new Map([[active.id, { project: active, active: true }]]);
  for (const name of await readdir(dataDir)) {
    if (!/^[a-f0-9-]{36}-r\d+\.json$/i.test(name)) continue;
    try {
      const p = validateProject(JSON.parse(await readFile(path.join(dataDir, name), 'utf8')));
      if (p.id === active.id) continue;
      if (!found.has(p.id) || found.get(p.id).project.revision < p.revision)
        found.set(p.id, { project: p, active: false });
    } catch {
      /* Unreadable archives are kept on disk, never overwritten or opened. */
    }
  }
  return found;
}

export function switchProject(next, current, imported = false) {
  const p = structuredClone(next);
  if (imported) {
    p.importedFromId = p.id;
    p.id = randomUUID();
  }
  p.revision = Math.max(current.revision, p.revision) + 1;
  p.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    type: imported ? 'imported' : 'opened',
    message: imported
      ? 'Imported as a separate project from a backup. Existing local review records are not authenticated approvals.'
      : 'Opened saved project.',
  });
  return p;
}
