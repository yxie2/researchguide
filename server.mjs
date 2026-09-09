import http from 'node:http';
import { literatureAction, searchLiterature } from './lib/literature.mjs';
import { discoveryAction, searchPublicData } from './lib/discovery.mjs';
import {
  BACKUP_LIMIT,
  parseBackup,
  projectSummary,
  savedProjects,
  switchProject,
  editableProject,
  renamedProject,
  archiveProject,
  projectDeleted,
  trashProject,
} from './lib/projects.mjs';
import { proposeAnalysis, executeAnalysis } from './lib/analysis.mjs';
import { reviewConsistency, appendConsistency } from './lib/consistency.mjs';
import { extractPaper, assessClaim } from './lib/evidence.mjs';
import { converse, appendConversation } from './lib/conversation.mjs';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createProject,
  analysisUpdated,
  evidenceUpdated,
  applyAction,
  appendGuide,
  exportMarkdown,
  stages,
  milestone,
  text,
  WorkflowError,
} from './lib/workflow.mjs';
import { runGuide } from './lib/guide.mjs';
import { normalizeSettings, settingsFromEnv, publicSettings, callModel } from './lib/llm.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export async function createApp({
  dataDir = path.join(root, 'data'),
  model = '',
  modelUrl = 'http://127.0.0.1:11434',
  llmSettings,
  guide = runGuide,
  datasetSearch = searchPublicData,
  literatureSearch = searchLiterature,
} = {}) {
  await mkdir(dataDir, { recursive: true });
  const settingsFile = path.join(dataDir, 'model-settings.json');
  let settings =
    llmSettings ||
    normalizeSettings({ provider: model ? 'ollama' : 'demo', model, baseUrl: modelUrl });
  let settingsRevision = 0;
  try {
    const saved = JSON.parse(await readFile(settingsFile, 'utf8'));
    settings = normalizeSettings(saved.settings);
    settingsRevision = saved.revision;
    if (!Number.isSafeInteger(settingsRevision) || settingsRevision < 0)
      throw new Error('Invalid saved model settings revision.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const projectFile = path.join(dataDir, 'project.json');
  let project;
  try {
    project = JSON.parse(await readFile(projectFile, 'utf8'));
    if (project.schemaVersion !== 1 || !Array.isArray(project.milestones))
      throw new Error('Unsupported project data. Back up data/project.json before repairing.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    project = createProject();
  }
  let writing = false,
    guiding = false;
  // Recover cleanly if a previous process stopped after committing a deletion marker.
  if (await projectDeleted(dataDir, project.id)) {
    const next = switchProject(createProject(), project);
    await persist(next);
  }
  async function persist(next) {
    await writeFile(`${projectFile}.tmp`, JSON.stringify(next, null, 2));
    await rename(`${projectFile}.tmp`, projectFile);
    project = next;
  }
  async function archiveCurrent() {
    await writeFile(
      path.join(dataDir, `${project.id}-r${project.revision}.json`),
      JSON.stringify(project, null, 2),
    );
  }
  async function body(req, limit = 128 * 1024) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) throw new WorkflowError('Request exceeds the permitted size.', 413);
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new WorkflowError('Request must contain valid JSON.');
    }
  }
  return http.createServer(async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(payload));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))
        throw new WorkflowError('This prototype accepts localhost requests only.', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`)
        throw new WorkflowError('Cross-origin requests are not allowed.', 403);
      const pathname = new URL(req.url, `http://${host}`).pathname;
      if (pathname.startsWith('/api/analysis/runs/') && req.method === 'GET') {
        const parts = pathname.slice('/api/analysis/runs/'.length).split('/');
        const run = (project.analysisRuns || []).find((r) => r.id === parts[0]);
        if (!run) throw new WorkflowError('Execution record not found.', 404);
        const plan = project.analysisPlans.find((p) => p.id === run.planId);
        if (parts.length === 1) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${run.id}-reproduction.json"`,
            'Cache-Control': 'no-store',
          });
          return res.end(
            JSON.stringify(
              {
                run,
                plan,
                reproduce:
                  'Save run.inputCsv as input.csv and run.script as analysis.R, then run Rscript analysis.R in a clean directory. Package and R versions are in session.txt. Column mappings are stored in the plan; this bundle contains selected row-level numeric data.',
                dataset: project.datasets.find((d) => d.id === run.datasetId),
              },
              null,
              2,
            ),
          );
        }
        const filename = parts[1];
        if (filename === 'figure.svg')
          res.setHeader(
            'Content-Security-Policy',
            "sandbox; default-src 'none'; style-src 'unsafe-inline'",
          );
        const content =
          filename === 'analysis.R'
            ? run.script
            : filename === 'input.csv'
              ? run.inputCsv
              : run.files[filename];
        if (
          parts.length !== 2 ||
          ![
            'analysis.R',
            'input.csv',
            'counts.csv',
            'descriptives.csv',
            'coefficients.csv',
            'fit.csv',
            'diagnostics.csv',
            'histogram.csv',
            'figure.svg',
            'session.txt',
          ].includes(filename) ||
          typeof content !== 'string'
        )
          throw new WorkflowError('Run output not found.', 404);
        res.writeHead(200, {
          'Content-Type': filename === 'figure.svg' ? 'image/svg+xml' : 'text/plain; charset=utf-8',
          'Content-Disposition':
            filename === 'figure.svg' ? 'inline' : `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        });
        return res.end(content);
      }
      if (pathname.startsWith('/api/papers/') && req.method === 'GET') {
        const id = pathname.slice('/api/papers/'.length);
        const paper = (project.papers || []).find((p) => p.id === id);
        if (!paper || !/^[a-f0-9]{64}$/.test(paper.sha256))
          throw new WorkflowError('Paper not found.', 404);
        let bytes;
        try {
          bytes = await readFile(path.join(dataDir, 'papers', `${paper.sha256}.pdf`));
        } catch {
          throw new WorkflowError(
            'Original PDF is unavailable. Extracted pages remain in the notebook.',
            404,
          );
        }
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="research-paper.pdf"',
          'Cache-Control': 'no-store',
        });
        return res.end(bytes);
      }
      if (pathname === '/api/project' && req.method === 'GET')
        return send(200, {
          project,
          stages,
          mode: settings.provider,
          model: settings.model || null,
          settings: publicSettings(settings, settingsRevision),
        });
      if (pathname === '/api/settings' && req.method === 'GET')
        return send(200, { settings: publicSettings(settings, settingsRevision) });
      if (pathname === '/api/projects' && req.method === 'GET') {
        const saved = await savedProjects(dataDir, project);
        return send(200, {
          projects: [...saved.values()].map((p) => projectSummary(p.project, p.active)),
        });
      }
      if (pathname === '/api/export' && req.method === 'GET') {
        const format = new URL(req.url, `http://${host}`).searchParams.get('format');
        if (format === 'backup') {
          const snapshot = structuredClone(project);
          const attachments = [],
            missingAttachments = [];
          let size = Buffer.byteLength(JSON.stringify(snapshot));
          if (size > BACKUP_LIMIT - 1024 * 1024)
            throw new WorkflowError(
              'Backup exceeds 63 MB. Use the legacy JSON export and copy the data/papers folder separately.',
              413,
            );
          for (const paper of snapshot.papers || []) {
            if (attachments.some((a) => a.sha256 === paper.sha256)) continue;
            try {
              const bytes = await readFile(path.join(dataDir, 'papers', `${paper.sha256}.pdf`));
              const base64 = bytes.toString('base64');
              size += base64.length;
              if (size > BACKUP_LIMIT - 1024 * 1024)
                throw new WorkflowError(
                  'Backup exceeds 63 MB. Use the legacy JSON export and copy the data/papers folder separately.',
                  413,
                );
              attachments.push({ sha256: paper.sha256, base64 });
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              missingAttachments.push(paper.id);
            }
          }
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="researchguide-backup.json"',
            'Cache-Control': 'no-store',
          });
          return res.end(
            JSON.stringify({
              backupVersion: 1,
              project: snapshot,
              attachments,
              missingAttachments,
            }),
          );
        }
        const json = format === 'json';
        res.writeHead(200, {
          'Content-Type': json ? 'application/json' : 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="researchguide-project.${json ? 'json' : 'md'}"`,
          'Cache-Control': 'no-store',
        });
        return res.end(json ? JSON.stringify(project, null, 2) : exportMarkdown(project));
      }
      if (pathname.startsWith('/api/') && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json'))
          throw new WorkflowError('Content-Type must be application/json.', 415);
        const payload = await body(
          req,
          pathname === '/api/projects/import'
            ? BACKUP_LIMIT
            : pathname === '/api/papers'
              ? 7 * 1024 * 1024 + 4096
              : pathname === '/api/analysis/datasets'
                ? 3 * 1024 * 1024
                : 128 * 1024,
        );
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
          throw new WorkflowError('Request must be a JSON object.');
        if (['/api/projects/rename', '/api/projects/delete'].includes(pathname)) {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before managing projects.', 409);
          editableProject({ id: payload.id });
          writing = true;
          try {
            const saved = await savedProjects(dataDir, project);
            const target = saved.get(payload.id)?.project;
            if (!target)
              throw new WorkflowError('Project not found. Refresh the project list.', 404);
            editableProject(target);
            if (payload.targetRevision !== target.revision)
              throw new WorkflowError(
                'This project changed. Refresh the list before editing or deleting it.',
                409,
              );
            if (pathname.endsWith('/rename')) {
              const renamed = renamedProject(target, payload.title);
              if (target.id === project.id) await persist(renamed);
              else await archiveProject(dataDir, renamed);
            } else {
              if (payload.confirmTitle !== target.title)
                throw new WorkflowError('Confirm deletion using the current project title.');
              await trashProject(dataDir, target);
              if (target.id === project.id) {
                const other = [...saved.values()]
                  .filter((item) => item.project.id !== target.id)
                  .sort((a, b) => b.project.revision - a.project.revision)[0]?.project;
                await persist(switchProject(other || createProject(), project));
              }
            }
            return send(200, {
              project,
              projects: [...(await savedProjects(dataDir, project)).values()].map((v) =>
                projectSummary(v.project, v.active),
              ),
            });
          } finally {
            writing = false;
          }
        }
        if (['/api/projects/open', '/api/projects/import'].includes(pathname)) {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before switching projects.', 409);
          writing = true;
          try {
            let next,
              files = [];
            const imported = pathname.endsWith('/import');
            if (imported) ({ project: next, files } = parseBackup(payload.backup));
            else {
              const saved = await savedProjects(dataDir, project);
              next = saved.get(payload.id)?.project;
              if (!next)
                throw new WorkflowError('Saved project not found. Refresh the project list.', 404);
              if (next.id === project.id) return send(200, { project });
            }
            if (files.length) {
              await mkdir(path.join(dataDir, 'papers'), { recursive: true });
              for (const file of files)
                await writeFile(path.join(dataDir, 'papers', `${file.sha256}.pdf`), file.bytes);
            }
            const opened = switchProject(next, project, imported);
            await archiveCurrent();
            await persist(opened);
            return send(200, { project });
          } finally {
            writing = false;
          }
        }
        if (pathname === '/api/literature-discovery') {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before continuing.', 409);
          if (
            ['discover', 'assess'].includes(payload.action) &&
            payload.settingsRevision !== settingsRevision
          )
            throw new WorkflowError('Model settings changed. Reload before continuing.', 409);
          guiding = true;
          try {
            const result = await literatureAction(
              project,
              payload,
              { ...settings },
              literatureSearch,
            );
            await persist(result.project);
            return send(200, result);
          } finally {
            guiding = false;
          }
        }
        if (pathname === '/api/data-discovery') {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before continuing.', 409);
          if (
            ['terms', 'assess'].includes(payload.action) &&
            payload.settingsRevision !== settingsRevision
          )
            throw new WorkflowError('Model settings changed. Reload before continuing.', 409);
          guiding = true;
          try {
            const result = await discoveryAction(project, payload, { ...settings }, datasetSearch);
            if (result.project) await persist(result.project);
            return send(200, result);
          } finally {
            guiding = false;
          }
        }
        if (
          ['/api/analysis/datasets', '/api/analysis/propose', '/api/analysis/run'].includes(
            pathname,
          )
        ) {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before continuing.', 409);
          if (pathname === '/api/analysis/propose' && payload.settingsRevision !== settingsRevision)
            throw new WorkflowError('Model settings changed. Reload before proposing a plan.', 409);
          guiding = true;
          try {
            if (pathname === '/api/analysis/datasets')
              await persist(applyAction(project, { ...payload, type: 'analysis_dataset' }));
            else if (pathname === '/api/analysis/propose') {
              const next = structuredClone(project);
              await proposeAnalysis(next, payload.datasetId, { ...settings });
              await persist(
                analysisUpdated(
                  next,
                  'AI proposed a constrained analysis plan; no execution or approval occurred.',
                ),
              );
            } else {
              const run = await executeAnalysis(project, payload.planId, payload.approvalId);
              const next = structuredClone(project);
              next.analysisRuns ||= [];
              next.analysisRuns.push(run);
              await persist(
                analysisUpdated(
                  next,
                  `R execution ${run.id} ${run.status}; outputs preserved for inspection.`,
                  true,
                ),
              );
            }
            return send(200, { project });
          } finally {
            guiding = false;
          }
        }
        if (pathname === '/api/consistency') {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (
            payload.revision !== project.revision ||
            payload.settingsRevision !== settingsRevision
          )
            throw new WorkflowError(
              'Project or model settings changed. Reload before reviewing.',
              409,
            );
          guiding = true;
          try {
            const report = await reviewConsistency(
              project,
              { ...settings },
              payload.throughStage || 'writing',
            );
            await persist(appendConsistency(project, report));
            return send(200, { project });
          } finally {
            guiding = false;
          }
        }
        if (pathname === '/api/papers' || pathname === '/api/claims/assess') {
          if (writing || guiding)
            throw new WorkflowError('Wait for the current operation to finish.', 409);
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before continuing.', 409);
          if (pathname === '/api/claims/assess' && payload.settingsRevision !== settingsRevision)
            throw new WorkflowError('Model settings changed. Reload before sending evidence.', 409);
          guiding = true;
          try {
            let next = structuredClone(project);
            if (pathname === '/api/papers') {
              if ((next.papers || []).length >= 10)
                throw new WorkflowError('This notebook supports up to 10 PDFs.');
              const { paper, bytes } = await extractPaper(payload);
              next.papers ||= [];
              if (next.papers.some((p) => p.sha256 === paper.sha256))
                throw new WorkflowError('This PDF is already in your notebook.');
              const total =
                next.papers.reduce(
                  (n, p) => n + p.pages.reduce((n, p) => n + p.text.length, 0),
                  0,
                ) + paper.pages.reduce((n, p) => n + p.text.length, 0);
              if (total > 2000000)
                throw new WorkflowError('Notebook PDF text exceeds two million characters.');
              await mkdir(path.join(dataDir, 'papers'), { recursive: true });
              await writeFile(path.join(dataDir, 'papers', `${paper.sha256}.pdf`), bytes);
              next.papers.push(paper);
              next = evidenceUpdated(
                next,
                'PDF imported locally. Extracted text requires inspection before use as evidence.',
              );
            } else {
              const assessment = await assessClaim(project, payload.claimId, { ...settings });
              next.claims.find((c) => c.id === payload.claimId).assessments.push(assessment);
              next = evidenceUpdated(
                next,
                'AI claim assessment saved as a suggestion, pending researcher inspection.',
              );
            }
            await persist(next);
            return send(200, { project });
          } finally {
            guiding = false;
          }
        }
        if (pathname === '/api/settings' || pathname === '/api/settings/test') {
          if (guiding || writing)
            throw new WorkflowError(
              'Wait for the current operation before changing or testing model settings.',
              409,
            );
          if (payload.revision !== settingsRevision)
            throw new WorkflowError(
              'Model settings changed in another tab. Reopen LLM settings before continuing.',
              409,
            );
          if (pathname === '/api/settings/test') {
            guiding = true;
            try {
              await callModel(
                'You are testing a model connection. Respond briefly.',
                'Reply with OK.',
                settings,
              );
              return send(200, {
                message:
                  'Connection successful. The configured model returned text. No research project was sent.',
              });
            } finally {
              guiding = false;
            }
          }
          const next = normalizeSettings(payload, settings);
          writing = true;
          try {
            await writeFile(
              `${settingsFile}.tmp`,
              JSON.stringify({ revision: settingsRevision + 1, settings: next }, null, 2),
              { mode: 0o600 },
            );
            await rename(`${settingsFile}.tmp`, settingsFile);
            settings = next;
            settingsRevision += 1;
            return send(200, { settings: publicSettings(settings, settingsRevision) });
          } finally {
            writing = false;
          }
        }
        if (pathname === '/api/guide' || pathname === '/api/conversation') {
          if (guiding || writing)
            throw new WorkflowError(
              'A run or save is already in progress. Try again shortly.',
              409,
            );
          milestone(project, payload.stageId);
          if (payload.settingsRevision !== settingsRevision)
            throw new WorkflowError(
              'Model settings changed. Reload to review the active provider before sending your project.',
              409,
            );
          if (payload.revision !== project.revision)
            throw new WorkflowError('Project changed. Reload before requesting guidance.', 409);
          const question = text(payload.question, 'Question', 2000);
          guiding = true;
          const snapshot = structuredClone(project);
          try {
            const conversational = pathname === '/api/conversation';
            const run = await (conversational ? converse : guide)(
              snapshot,
              payload.stageId,
              question,
              { ...settings },
            );
            // A result may not be attached to a project/version changed during generation.
            if (project.id !== snapshot.id || project.revision !== snapshot.revision)
              throw new WorkflowError(
                'Project changed during guidance. Run again on the latest version.',
                409,
              );
            writing = true;
            try {
              await persist(
                conversational
                  ? appendConversation(project, payload.stageId, run)
                  : appendGuide(project, payload.stageId, run),
              );
            } finally {
              writing = false;
            }
            return send(200, { project, run });
          } finally {
            guiding = false;
          }
        }
        if (!['/api/action', '/api/new'].includes(pathname))
          throw new WorkflowError('Endpoint not found.', 404);
        if (writing || guiding)
          throw new WorkflowError('Wait for the current guide run or save to finish.', 409);
        writing = true;
        try {
          if (pathname === '/api/new') {
            if (payload.revision !== project.revision)
              throw new WorkflowError(
                'Project changed. Reload before creating a new project.',
                409,
              );
            const next = createProject(payload.title, payload.question);
            // Keep revisions increasing across switches so another tab cannot edit the wrong project.
            next.revision = project.revision + 1;
            await archiveCurrent();
            await persist(next);
          } else await persist(applyAction(project, payload));
          return send(200, { project });
        } finally {
          writing = false;
        }
      }
      if (pathname.startsWith('/api/'))
        throw new WorkflowError('Endpoint or method not found.', 404);
      if (!['GET', 'HEAD'].includes(req.method))
        throw new WorkflowError('Method not allowed.', 405);
      const allowed = {
        '/': 'index.html',
        '/demo': 'demo.html',
        '/demo.js': 'demo.js',
        '/demo.css': 'demo.css',
        '/demo-case.json': 'demo-case.json',
        '/business-demo-case.json': 'business-demo-case.json',
        '/app.js': 'app.js',
        '/workflow-flow.js': 'workflow-flow.js',
        '/style.css': 'style.css',
        '/favicon.svg': 'favicon.svg',
      };
      if (!allowed[pathname]) throw new WorkflowError('Page not found.', 404);
      const file = path.join(root, 'public', allowed[pathname]);
      const types = {
        '.json': 'application/json; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)],
        'Cache-Control': 'no-cache',
        'Content-Length': (await stat(file)).size,
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error instanceof WorkflowError ? error.status : 500;
      if (status === 500) console.error(error.message);
      send(status, {
        error:
          status === 500
            ? 'The operation failed. Check the server terminal and model connection; your saved project has not been replaced.'
            : error.message,
      });
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createApp({
    dataDir: process.env.RESEARCHGUIDE_DATA_DIR || path.join(root, 'data'),
    llmSettings: settingsFromEnv(process.env),
  });
  app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () =>
    console.log(
      `ResearchGuide: http://127.0.0.1:${process.env.PORT || 3000}\nChoose Demo, Ollama, or an LLM API in LLM settings.\nLocal prototype; supervisor reviews are not authenticated.`,
    ),
  );
}
