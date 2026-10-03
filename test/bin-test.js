'use strict';

// End-to-end tests for bin.js: spawn the real CLI against tiny fixture
// scripts (no browser needed) and assert on exit codes and results JSON.

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'bin.js');
const fixture = (name) => path.join(__dirname, 'fixtures', name);

function runBin(args, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('node', [bin, ...args], { timeout }, (error, stdout, stderr) => {
      // execFile reports non-zero exits as errors; we want the details.
      resolve({
        exitCode: error && typeof error.code === 'number' ? error.code : 0,
        stdout,
        stderr,
      });
    });
  });
}

// debug() writes to stderr, so stdout is the results JSON on its own.
function parseResults(stdout) {
  return JSON.parse(stdout);
}

describe('bin.js', function () {
  this.timeout(20000);

  it('exits 0 and reports no failures when instances succeed', async () => {
    const { exitCode, stdout } = await runBin([
      `--file=${fixture('ok.js')}`,
      '--s=1',
      '--c=2',
    ]);

    assert.equal(exitCode, 0);
    const results = parseResults(stdout);
    assert.equal(results.failed, 0);
    assert.deepEqual(Object.keys(results.sample1.concurrency).sort(), ['1', '2']);
  });

  it('exits 1 and records the failure when an instance fails (#24)', async () => {
    const { exitCode, stdout, stderr } = await runBin([
      `--file=${fixture('fail.js')}`,
      '--s=1',
      '--c=1',
    ]);

    assert.equal(exitCode, 1);
    const results = parseResults(stdout);
    assert.equal(results.failed, 1);
    assert.equal(results.sample1.failed, 1);
    assert.match(results.sample1.concurrency['1'].error, /boom/);
    assert.match(stderr, /instance\(s\) failed/);
  });

  it('kills a hung instance after --timeout and exits 1 (#82)', async () => {
    const { exitCode, stdout, stderr } = await runBin([
      `--file=${fixture('slow.js')}`,
      '--s=1',
      '--c=1',
      '--timeout=500',
    ]);

    assert.equal(exitCode, 1);
    const results = parseResults(stdout);
    assert.equal(results.failed, 1);
    assert.equal(results.sample1.concurrency['1'].timedOut, true);
    assert.match(stderr, /timed out after 500ms/);
  });

  it('supports -t and -d short flags', async () => {
    const { exitCode, stdout } = await runBin([
      `--file=${fixture('ok.js')}`,
      '-s', '1',
      '-c', '2',
      '-d', '50',
      '-t', '10000',
    ]);

    assert.equal(exitCode, 0);
    const results = parseResults(stdout);
    assert.equal(results.failed, 0);
  });

  it('errors when --file is missing', async () => {
    const { exitCode, stderr } = await runBin(['--s=1']);

    assert.equal(exitCode, 1);
    assert.match(stderr, /cannot find --file option/);
  });

  it('staggers instance starts with --delay (#86)', async () => {
    const started = Date.now();
    const { exitCode, stdout } = await runBin([
      `--file=${fixture('ok.js')}`,
      '--s=1',
      '--c=3',
      '--delay=400',
    ]);

    assert.equal(exitCode, 0);
    const results = parseResults(stdout);
    assert.equal(results.failed, 0);
    // 2 gaps x 400ms between 3 staggered starts.
    assert.ok(Date.now() - started >= 650, 'instances were not staggered');
  });

  it('writes results JSON to --outputFile', async () => {
    const outputFile = path.join(os.tmpdir(), `puppeteer-loadtest-${Date.now()}.json`);
    try {
      const { exitCode, stdout } = await runBin([
        `--file=${fixture('ok.js')}`,
        '--s=1',
        '--c=1',
        `--outputFile=${outputFile}`,
      ]);

      assert.equal(exitCode, 0);
      const fromFile = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      assert.deepEqual(fromFile, parseResults(stdout));
      assert.equal(fromFile.failed, 0);
    } finally {
      fs.rmSync(outputFile, { force: true });
    }
  });

  it('warns and falls back to 0 for an invalid --timeout', async () => {
    const { exitCode, stdout, stderr } = await runBin([
      `--file=${fixture('ok.js')}`,
      '--s=1',
      '--c=1',
      '--timeout=banana',
    ]);

    assert.equal(exitCode, 0);
    assert.match(stderr, /invalid --timeout value "banana", using 0/);
    assert.equal(parseResults(stdout).failed, 0);
  });

  it('--silent suppresses the results JSON on stdout', async () => {
    const { exitCode, stdout } = await runBin([
      `--file=${fixture('ok.js')}`,
      '--s=1',
      '--c=1',
      '--silent',
    ]);

    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), '');
  });

  it('reports a missing script file as a failure', async () => {
    const { exitCode, stdout } = await runBin([
      `--file=${fixture('does-not-exist.js')}`,
      '--s=1',
      '--c=1',
    ]);

    assert.equal(exitCode, 1);
    const results = parseResults(stdout);
    assert.equal(results.failed, 1);
    assert.equal(results.sample1.failed, 1);
    assert.ok(results.sample1.concurrency['1'].error.length > 0);
  });
});
