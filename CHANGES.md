## 2.3.0
- Add `--timeout` (`-t`) option: kill an instance running longer than the given milliseconds (issue #82).
- Add `--delay` (`-d`) option: wait the given milliseconds between spawning concurrent instances (issue #86).
- Surface instance failures: each failure is logged with its sample/instance, recorded in the results JSON (`failed` counts, per-instance `error`/`timedOut`/`exitCode`), and the CLI exits non-zero when any instance fails (issue #24).
- Replace Travis CI with GitHub Actions; refresh the npm publish workflow (Node 20, current actions).
- Update dependencies (puppeteer 25, mocha 12); require Node >= 20.
- CI runs on Node 22 and 24; `.nvmrc` pins 24; npm publish workflow uses Node 24.
- Expanded test suite: 20 tests (unit + end-to-end CLI).

## 2.1.1
- update dependency packages.

## 2.1.0
- Add option to use package as node module.

## 2.0.0
- Add option (`outputFile`) for measuring performance.
- update packages.

## 1.0.6
- update pacakges, publish.
