'use strict';

// Unit tests for index.js with child_process.exec mocked out.
// No real browser or script is launched here; bin.js is covered in bin-test.js.

const assert = require('node:assert/strict');
const sinon = require('sinon');
const mock = require('mock-require');

describe('startPuppeteerLoadTest', () => {
  let execStub;
  let startPuppeteerLoadTest;

  beforeEach(() => {
    execStub = sinon.stub();
    mock('child_process', { exec: execStub });
    startPuppeteerLoadTest = mock.reRequire('../index');
  });

  afterEach(() => {
    mock.stopAll();
  });

  it('runs `node <file>` once per concurrency slot', async () => {
    execStub.callsFake((cmd, options, callback) => callback(null, 'ok\n', ''));

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 3,
      results: {},
    });

    assert.equal(execStub.callCount, 3);
    assert.ok(execStub.alwaysCalledWith('node ./test/basic.js', {}, sinon.match.func));
    assert.equal(results.failed, 0);
    assert.equal(results.sample1.failed, 0);
    assert.deepEqual(Object.keys(results.sample1.concurrency).sort(), ['1', '2', '3']);
    assert.equal(results.sample1.concurrency['1'].error, undefined);
  });

  it('passes the timeout through to exec (#82)', async () => {
    execStub.callsFake((cmd, options, callback) => callback(null, 'ok\n', ''));

    await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      timeout: 5000,
      results: {},
    });

    assert.ok(execStub.calledOnceWith('node ./test/basic.js', { timeout: 5000 }, sinon.match.func));
  });

  it('marks a killed instance as timed out and counts the failure (#82, #24)', async () => {
    const timeoutError = new Error('Command timed out');
    timeoutError.killed = true;
    timeoutError.signal = 'SIGTERM';
    timeoutError.code = null;
    execStub.callsFake((cmd, options, callback) => callback(timeoutError, '', ''));

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 2,
      timeout: 1000,
      results: {},
    });

    assert.equal(results.failed, 2);
    assert.equal(results.sample1.failed, 2);
    const entry = results.sample1.concurrency['1'];
    assert.equal(entry.timedOut, true);
    assert.match(entry.error, /timed out/);
  });

  it('records stderr output as a failure (#24)', async () => {
    execStub.callsFake((cmd, options, callback) => callback(null, '', 'something broke\n'));

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
    const error = new Error('Command failed: node ./test/basic.js\nboom');
    error.code = 1;
    error.killed = false;
    execStub.callsFake((cmd, options, callback) => callback(error, '', 'boom'));

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      results: {},
    });

    assert.equal(results.failed, 1);
    assert.equal(results.sample1.concurrency['1'].exitCode, 1);
    assert.equal(results.sample1.concurrency['1'].timedOut, false);
  });

  it('staggers concurrent instance starts by the delay (#86)', async () => {
    const startedAt = [];
    execStub.callsFake((cmd, options, callback) => {
      startedAt.push(Date.now());
      callback(null, 'ok\n', '');
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

  it('does not set a timeout on exec when timeout is 0 (default)', async () => {
    execStub.callsFake((cmd, options, callback) => callback(null, 'ok\n', ''));

    await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 1,
      concurrencyRequested: 1,
      results: {},
    });

    assert.ok(execStub.calledOnceWith('node ./test/basic.js', {}, sinon.match.func));
  });

  it('counts mixed success and failure within one sample', async () => {
    const error = new Error('Command failed');
    error.code = 1;
    error.killed = false;
    let calls = 0;
    execStub.callsFake((cmd, options, callback) => {
      calls += 1;
      if (calls === 2) {
        callback(error, '', 'boom');
      } else {
        callback(null, 'ok\n', '');
      }
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
    assert.match(results.sample1.concurrency['2'].error, /Command failed/);
    assert.equal(results.sample1.concurrency['3'].error, undefined);
  });

  it('accumulates failures across samples in results.failed', async () => {
    execStub.callsFake((cmd, options, callback) => callback(null, '', 'nope'));

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
    // Synchronous callback => each start runs after the previous stop.
    // Entries must not be wiped by later starts (regression test).
    execStub.callsFake((cmd, options, callback) => callback(null, 'ok\n', ''));

    const results = await startPuppeteerLoadTest({
      file: './test/basic.js',
      samplesRequested: 2,
      concurrencyRequested: 2,
      results: {},
    });

    for (const sample of ['sample1', 'sample2']) {
      assert.deepEqual(Object.keys(results[sample].concurrency).sort(), ['1', '2']);
      assert.ok(typeof results[sample].concurrency['1'].time === 'number');
      assert.ok(typeof results[sample].sample.time === 'number');
    }
  });
});
