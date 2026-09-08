import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createProject,
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
  async function persist(next) {
    await writeFile(`${projectFile}.tmp`, JSON.stringify(next, null, 2));
    await rename(`${projectFile}.tmp`, projectFile);
    project = next;
  }
  async function body(req) {
    let content = '',
      length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 128 * 1024) throw new WorkflowError('Request exceeds the 128 KB limit.', 413);
      content += chunk;
    }
    try {
      return JSON.parse(content);
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
      if (pathname === '/api/export' && req.method === 'GET') {
        const format = new URL(req.url, `http://${host}`).searchParams.get('format');
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
        const payload = await body(req);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
          throw new WorkflowError('Request must be a JSON object.');
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
        if (pathname === '/api/guide') {
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
            const run = await guide(snapshot, payload.stageId, question, { ...settings });
            // A result may not be attached to a project/version changed during generation.
            if (project.id !== snapshot.id || project.revision !== snapshot.revision)
              throw new WorkflowError(
                'Project changed during guidance. Run again on the latest version.',
                409,
              );
            writing = true;
            try {
              await persist(appendGuide(project, payload.stageId, run));
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
            // Preserve every previous project in a local archive.
            await writeFile(
              path.join(dataDir, `${project.id}-r${project.revision}.json`),
              JSON.stringify(project, null, 2),
            );
            await persist(createProject(payload.title, payload.question));
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
        '/app.js': 'app.js',
        '/style.css': 'style.css',
        '/favicon.svg': 'favicon.svg',
      };
      if (!allowed[pathname]) throw new WorkflowError('Page not found.', 404);
      const file = path.join(root, 'public', allowed[pathname]);
      const types = {
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
