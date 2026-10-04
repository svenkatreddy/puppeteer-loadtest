'use strict';

// Unit tests for index.js with child_process.spawn mocked out.
// No real browser or script is launched here; bin.js is covered in bin-test.js.

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sinon = require('sinon');
const mock = require('mock-require');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = sinon.stub();
  return child;
}

// Drives the fake child to completion on the next tick.
function complete(child, { stdout = 'ok\n', stderr = '', code = 0, signal = null } = {}) {
  process.nextTick(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', code, signal);
  });
}

describe('startPuppeteerLoadTest', () => {
  let spawnStub;
  let startPuppeteerLoadTest;

  beforeEach(() => {
    spawnStub = sinon.stub();
    mock('child_process', { spawn: spawnStub });
    startPuppeteerLoadTest = mock.reRequire('../index');
  });

  afterEach(() => {
    mock.stopAll();
  });

  function succeedingRun(options) {
    spawnStub.callsFake(() => {
      const child = fakeChild();
      complete(child);
      return child;
    });
    return startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      results: {},
      ...options,
    });
  }

  it('spawns the file with the current node binary, once per concurrency slot', async () => {
    const results = await succeedingRun({ concurrencyRequested: 3 });

    assert.equal(spawnStub.callCount, 3);
    assert.ok(spawnStub.alwaysCalledWith(process.execPath, ['./test/basic.js']));
    assert.equal(results.failed, 0);
    assert.equal(results.sample1.failed, 0);
    assert.deepEqual(Object.keys(results.sample1.concurrency).sort(), ['1', '2', '3']);
    assert.equal(results.sample1.concurrency['1'].error, undefined);
  });

  it('kills the child with SIGKILL after the timeout (#82)', async () => {
    spawnStub.callsFake(() => {
      const child = fakeChild();
      child.kill.callsFake((signal) => {
        assert.equal(signal, 'SIGKILL');
        child.emit('close', null, 'SIGKILL');
      });
      return child; // never closes on its own
    });

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      timeout: 30,
      results: {},
    });

    assert.equal(results.failed, 1);
    const entry = results.sample1.concurrency['1'];
    assert.equal(entry.timedOut, true);
    assert.match(entry.error, /timed out after 30ms/);
  });

  it('records stderr output as a failure (#24)', async () => {
    spawnStub.callsFake(() => {
      const child = fakeChild();
      complete(child, { stderr: 'something broke\n' });
      return child;
    });

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 2,
      concurrencyRequested: 1,
      results: {},
    });

    assert.equal(results.failed, 2);
    assert.equal(results.sample1.failed, 1);
    assert.equal(results.sample2.failed, 1);
    assert.equal(results.sample1.concurrency['1'].error, 'something broke');
    assert.equal(results.sample1.concurrency['1'].timedOut, false);
  });

  it('records a non-zero exit as a failure with its exit code (#24)', async () => {
    spawnStub.callsFake(() => {
      const child = fakeChild();
      complete(child, { stdout: '', stderr: 'boom\n', code: 1 });
      return child;
    });

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      results: {},
    });

    assert.equal(results.failed, 1);
    assert.equal(results.sample1.concurrency['1'].exitCode, 1);
    assert.equal(results.sample1.concurrency['1'].timedOut, false);
    assert.match(results.sample1.concurrency['1'].error, /exited with code 1/);
  });

  it('counts mixed success and failure within one sample', async () => {
    let calls = 0;
    spawnStub.callsFake(() => {
      const child = fakeChild();
      calls += 1;
      if (calls === 2) {
        complete(child, { stdout: '', stderr: 'boom\n', code: 1 });
      } else {
        complete(child);
      }
      return child;
    });

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 3,
      results: {},
    });

    assert.equal(results.failed, 1);
    assert.equal(results.sample1.failed, 1);
    assert.equal(results.sample1.concurrency['1'].error, undefined);
    assert.match(results.sample1.concurrency['2'].error, /exited with code 1/);
    assert.equal(results.sample1.concurrency['3'].error, undefined);
  });

  it('accumulates failures across samples in results.failed', async () => {
    spawnStub.callsFake(() => {
      const child = fakeChild();
      complete(child, { stdout: '', stderr: 'nope\n' });
      return child;
    });

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 3,
      concurrencyRequested: 2,
      results: {},
    });

    assert.equal(results.failed, 6);
    assert.equal(results.sample1.failed, 2);
    assert.equal(results.sample2.failed, 2);
    assert.equal(results.sample3.failed, 2);
  });

  it('keeps per-sample timing entries when starts interleave with stops', async () => {
    // nextTick completion => each start runs after the previous stop.
    // Entries must not be wiped by later starts (regression test).
    const results = await succeedingRun({ samplesRequested: 2, concurrencyRequested: 2 });

    for (const sample of ['sample1', 'sample2']) {
      assert.deepEqual(Object.keys(results[sample].concurrency).sort(), ['1', '2']);
      assert.ok(typeof results[sample].concurrency['1'].time === 'number');
      assert.ok(typeof results[sample].sample.time === 'number');
    }
  });

  it('does not share results between runs', async () => {
    const first = await succeedingRun();
    const second = await succeedingRun();

    assert.notEqual(first, second);
    assert.deepEqual(Object.keys(second), ['failed', 'sample1']);
    assert.equal(second.failed, 0);
  });

  it('writes per-instance logs when logsDir is set', async () => {
    const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plt-'));
    try {
      spawnStub.callsFake(() => {
        const child = fakeChild();
        complete(child, { stdout: 'hello-log\n' });
        return child;
      });

      const results = await startPuppeteerLoadTest({
        file: './test/basic.js',
        samplesRequested: 1,
        concurrencyRequested: 2,
        logsDir,
        results: {},
      });

      assert.equal(results.failed, 0);
      const files = fs.readdirSync(logsDir).sort();
      assert.deepEqual(files, ['sample1-instance1.log', 'sample1-instance2.log']);
      assert.match(fs.readFileSync(path.join(logsDir, files[0]), 'utf8'), /hello-log/);
    } finally {
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
  });

  it('staggers concurrent instance starts by the delay (#86)', async () => {
    const startedAt = [];
    spawnStub.callsFake(() => {
      const child = fakeChild();
      startedAt.push(Date.now());
      complete(child);
      return child;
    });

    await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 3,
      delay: 60,
      results: {},
    });

    assert.equal(startedAt.length, 3);
    // Generous margins: each start should lag the previous by ~the delay.
    assert.ok(startedAt[1] - startedAt[0] >= 40, `gap was ${startedAt[1] - startedAt[0]}ms`);
    assert.ok(startedAt[2] - startedAt[1] >= 40, `gap was ${startedAt[2] - startedAt[1]}ms`);
  });

  it('spawns all instances at once when no delay is given', async () => {
    const startedAt = [];
    spawnStub.callsFake(() => {
      const child = fakeChild();
      startedAt.push(Date.now());
      complete(child);
      return child;
    });

    await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 3,
      results: {},
    });

    assert.equal(startedAt.length, 3);
    assert.ok(startedAt[2] - startedAt[0] < 40, `gap was ${startedAt[2] - startedAt[0]}ms`);
  });
});
