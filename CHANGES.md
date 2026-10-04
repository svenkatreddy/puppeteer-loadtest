## 2.3.0
- Add `--timeout` (`-t`) option: kill an instance running longer than the given milliseconds (issue #82).
- Add `--delay` (`-d`) option: wait the given milliseconds between spawning concurrent instances (issue #86).
- Surface instance failures: each failure is logged with its sample/instance, recorded in the results JSON (`failed` counts, per-instance `error`/`timedOut`/`exitCode`), and the CLI exits non-zero when any instance fails (issue #24).
- Add `--help` (`-h`) usage output; validate `--s`/`--c` (invalid values now error instead of silently running nothing).
- Run scripts via `execFile` with the current Node binary (no shell): paths with spaces work, no quoting bugs; stdout buffer raised to 10MB; timeout kills use SIGKILL.
- Drop per-instance stdout retention (nothing consumed it; it bloated memory and debug output at scale); package.json files whitelist; drop stale test/performance.json.
- Stream instance output via `spawn` instead of buffering: no `maxBuffer` ceiling, constant memory; new `--logs-dir` writes per-instance `sampleN-instanceM.log` files.
- Fix `--silent=false` parsing as truthy; add `--version` (`-v`).
- Fix `startConcurrencyLogPerformance` wiping earlier concurrency entries when starts interleave with stops; each `startPuppeteerLoadTest()` call now gets a fresh results object.
- Replace Travis CI with GitHub Actions; refresh the npm publish workflow (Node 24, current actions).
- Update dependencies (puppeteer 25, mocha 12); require Node >= 20.
- CI runs on Node 22 and 24; `.nvmrc` pins 24; npm publish workflow uses Node 24.
- Expanded test suite: 29 tests (unit + end-to-end CLI).

## 2.1.1
- update dependency packages.

## 2.1.0
- Add option to use package as node module.

## 2.0.0
- Add option (`outputFile`) for measuring performance.
- update packages.

## 1.0.6
- update pacakges, publish.
