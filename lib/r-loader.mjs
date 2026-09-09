// webR 0.6 uses absolute Windows paths in dynamic imports. Normalize them for Node's ESM loader.
import { pathToFileURL } from 'node:url';
export function resolve(specifier, context, nextResolve) {
  return nextResolve(
    /^[A-Za-z]:[\\/]/.test(specifier) ? pathToFileURL(specifier).href : specifier,
    context,
  );
}
