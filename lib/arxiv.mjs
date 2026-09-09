import { SaxesParser } from 'saxes';
const atom = 'http://www.w3.org/2005/Atom';
const arxiv = 'http://arxiv.org/schemas/atom';
const clean = (s, max = 4000) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
export function parseArxiv(xml) {
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let root,
    nodes = 0;
  parser.on('doctype', () => {
    throw Error('Document types are not accepted');
  });
  parser.on('error', (e) => {
    throw e;
  });
  parser.on('opentag', (tag) => {
    if (++nodes > 10000 || stack.length > 40) throw Error('XML too complex');
    const node = { name: tag.local, uri: tag.uri, text: '', children: [] };
    if (stack.length) stack.at(-1).children.push(node);
    else root = node;
    stack.push(node);
  });
  const text = (value) => {
    if (stack.length) stack.at(-1).text += value;
  };
  parser.on('text', text);
  parser.on('cdata', text);
  parser.on('closetag', () => stack.pop());
  parser.write(xml).close();
  if (root?.name !== 'feed' || root.uri !== atom) throw Error('Expected an Atom feed');
  const get = (node, name, uri = atom) =>
    node.children.find((c) => c.name === name && c.uri === uri)?.text || '';
  return root.children
    .filter((n) => n.name === 'entry' && n.uri === atom)
    .slice(0, 6)
    .map((entry) => {
      const id = new URL(get(entry, 'id').trim());
      if (
        id.hostname !== 'arxiv.org' ||
        !['https:', 'http:'].includes(id.protocol) ||
        id.username ||
        id.password ||
        !/^\/abs\/(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/.test(id.pathname)
      )
        throw Error('Invalid arXiv entry identifier');
      const url = `https://arxiv.org${id.pathname}`;
      const title = clean(get(entry, 'title'), 600);
      if (!title) throw Error('Missing arXiv title');
      return {
        provider: 'arXiv',
        title,
        doi: clean(get(entry, 'doi', arxiv), 300),
        url,
        arxivUrl: url,
        authors: clean(
          entry.children
            .filter((c) => c.name === 'author' && c.uri === atom)
            .map((a) => get(a, 'name'))
            .join(', '),
          1000,
        ),
        year: clean(get(entry, 'published').slice(0, 4), 10),
        journal: clean(get(entry, 'journal_ref', arxiv), 500),
        abstract: clean(get(entry, 'summary')),
        type: 'arXiv preprint / manuscript; peer-review status not verified',
        access:
          'Read the arXiv version and check its licence and publication status. A journal version may differ.',
      };
    });
}
// Serialize live requests, with a three-second interval between them.
let queue = Promise.resolve(),
  nextRequestAt = 0;
export async function searchArxiv(query, fetcher = fetch) {
  const terms =
    query
      .match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu)
      ?.filter((t) => !['AND', 'OR', 'NOT', 'ANDNOT'].includes(t.toUpperCase())) || [];
  if (!terms.length) throw Error('No arXiv search terms');
  const url = new URL('https://export.arxiv.org/api/query');
  url.search = new URLSearchParams({
    search_query: terms.map((t) => `all:${t}`).join(' AND '),
    start: '0',
    max_results: '6',
    sortBy: 'relevance',
    sortOrder: 'descending',
  });
  const request = async () => {
    const response = await fetcher(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: 'application/atom+xml',
        'User-Agent': 'ResearchGuide/0.14 (+https://github.com/yxie2/researchguide)',
      },
    });
    if (!response.ok) throw Error('arXiv unavailable');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw Error('arXiv response too large');
      chunks.push(chunk);
    }
    return parseArxiv(Buffer.concat(chunks).toString('utf8'));
  };
  if (fetcher !== fetch) return request();
  const pending = queue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())));
    try {
      return await request();
    } finally {
      nextRequestAt = Date.now() + 3000;
    }
  });
  queue = pending.catch(() => {});
  return pending;
}
