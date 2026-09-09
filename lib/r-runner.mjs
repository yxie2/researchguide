// Dedicated, short-lived process. Inputs contain only a method enum and a numeric CSV.
import { WebR } from 'webr';
import { analysisScript } from './r-template.mjs';
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 2 * 1024 * 1024) throw new Error('Input too large');
}
const data = JSON.parse(input);
if (
  !['descriptive', 'linear'].includes(data.method) ||
  typeof data.csv !== 'string' ||
  !/^[yx,\nNA0-9.eE+\-]+$/.test(data.csv)
)
  throw new Error('Invalid numeric input');
let r;
try {
  r = new WebR({ interactive: false });
  await r.init();
  await r.FS.writeFile('/home/web_user/input.csv', new TextEncoder().encode(data.csv));
  const shelter = await new r.Shelter();
  const captured = await shelter.captureR(analysisScript(data.method), { captureGraphics: false });
  const log = captured.output
    .filter((x) => x.type === 'stdout' || x.type === 'stderr')
    .map((x) => String(x.data))
    .join('\n');
  const files = {};
  const names = [
    'counts.csv',
    'descriptives.csv',
    'histogram.csv',
    'figure.svg',
    'session.txt',
    ...(data.method === 'linear' ? ['coefficients.csv', 'fit.csv', 'diagnostics.csv'] : []),
  ];
  for (const name of names)
    files[name] = new TextDecoder().decode(await r.FS.readFile(`/home/web_user/${name}`));
  const version = await r.evalRString('R.version.string');
  console.log(JSON.stringify({ ok: true, version, log, files }));
  await shelter.purge();
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.message).slice(0, 2000) }));
} finally {
  if (r) await r.close();
}
