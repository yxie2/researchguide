import { parentPort, workerData } from 'node:worker_threads';
try {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({
    data: new Uint8Array(workerData),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const pdf = await loading.promise;
  try {
    if (pdf.numPages > 100) throw new Error('PDFs are limited to 100 pages.');
    const pages = [];
    let total = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((i) => i.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      total += text.length;
      if (total > 500000) throw new Error('Extracted text exceeds 500,000 characters.');
      pages.push({ number: n, text });
      page.cleanup();
    }
    if (total < 20)
      throw new Error(
        'No usable text found. Scanned PDFs need OCR; paste an inspected passage instead.',
      );
    parentPort.postMessage({ pages });
  } finally {
    await loading.destroy();
  }
} catch (error) {
  parentPort.postMessage({
    error:
      error.message?.startsWith('PDFs are') ||
      error.message?.startsWith('Extracted text') ||
      error.message?.startsWith('No usable')
        ? error.message
        : 'Could not extract this PDF. It may be encrypted, damaged, or unsupported.',
  });
}
