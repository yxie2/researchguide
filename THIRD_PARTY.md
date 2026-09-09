# Third-party runtime software

ResearchGuide source is licensed under the repository MIT license. Runtime dependencies retain their own licenses; they are installed through npm and are not copied into this source repository.

- Mozilla PDF.js (`pdfjs-dist`): Apache-2.0; see the installed package license and https://github.com/mozilla/pdf.js.
- `csv-parse`: MIT; see https://github.com/adaltas/node-csv.
- webR 0.6.0: includes R/WebAssembly binaries distributed under GPL-3.0 and JavaScript/support software under the terms listed in its license. See `node_modules/webr/LICENSE.md`, https://github.com/r-wasm/webr/tree/v0.6.0 and https://docs.r-wasm.org/webr/latest/. Its runtime includes other third-party components listed in that license.

The lockfile pins exact package versions. Preserve applicable third-party notices and source references when redistributing runtime packages. Reproduction records identify the R and loaded package versions actually used.
