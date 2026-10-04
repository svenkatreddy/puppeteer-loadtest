'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const spawn = require('child_process').spawn;
const fs = require('fs');
const path = require('path');
const perf = require('execution-time')();

const defaultOptions = {
  file: '',
  samplesRequested: 1,
  concurrencyRequested: 1,
  // #82: kill an instance if it runs longer than this (ms). 0 = no limit (backward compatible).
  timeout: 0,
  // #86: wait this many ms between spawning concurrent instances. 0 = spawn all at once.
  delay: 0,
  // Write each instance's stdout/stderr to sampleN-instanceM.log here. Empty = discard.
  logsDir: '',
  results: {},
  samplesCount: 0,
}

// In-memory stderr capture cap when --logs-dir is not set (only feeds the
// failure message).
const STDERR_CAPTURE_LIMIT = 8192;

debug('puppeteer-loadtest is loading...');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startSampleLogPerformance = (results, samplesCount) => {
  perf.start(`sampleCall${samplesCount + 1}`);
  results[`sample${samplesCount + 1}`] = {};
};

const stopSampleLogPerformance = (results, samplesCount) => {
  results[`sample${samplesCount + 1}`].sample = perf.stop(`sampleCall${samplesCount + 1}`);
};

const startConcurrencyLogPerformance = (results, concurrencyCount, samplesCount) => {
  perf.start(`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`);
  if (!results[`sample${samplesCount + 1}`].concurrency) {
    results[`sample${samplesCount + 1}`].concurrency = {};
  }
}

const stopConcurrencyLogPerformance = (results, concurrencyCount, samplesCount) => {
  if(results[`sample${samplesCount + 1}`]) {
    const timing = perf.stop((`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`));
    results[`sample${samplesCount + 1}`].concurrency[`${concurrencyCount + 1}`] = timing;
    return timing;
  }
  return {};
}

// #24: an instance outcome always resolves; failures are recorded on the
// timing entry and counted, never swallowed into debug-only output.
const executeTheCommand = function({ file, concurrencyCount, samplesCount, results, timeout, logsDir }) {
  return new Promise((resolve) => {
    startConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
    const sampleNo = samplesCount + 1;
    const instanceNo = concurrencyCount + 1;
    const outcome = {};
    let stderrHead = '';
    let stderrBytes = 0;
    let timedOut = false;
    let finished = false;

    let logStream = null;
    if (logsDir) {
      logStream = fs.createWriteStream(path.join(logsDir, `sample${sampleNo}-instance${instanceNo}.log`));
    }

    // spawn streams output instead of buffering it: no maxBuffer ceiling,
    // constant memory no matter how chatty the script is.
    const child = spawn(process.execPath, [file]);
    const killTimer = timeout > 0
      ? setTimeout(() => {
          timedOut = true;
          // A hung browser can shrug off SIGTERM; the kill switch must kill.
          // Note: this kills the script wrapper; a browser it launched may
          // linger as an orphan (see README).
          child.kill('SIGKILL');
        }, timeout)
      : null;

    child.stdout.on('data', (chunk) => {
      if (logStream) logStream.write(chunk);
      // Otherwise discard: nothing consumes instance stdout.
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (logStream) {
        logStream.write(chunk);
      } else if (stderrHead.length < STDERR_CAPTURE_LIMIT) {
        stderrHead += chunk.toString('utf8').slice(0, STDERR_CAPTURE_LIMIT - stderrHead.length);
      }
    });

    const finish = (spawnError, code, signal) => {
      if (finished) return;
      finished = true;
      if (killTimer) clearTimeout(killTimer);
      const timing = stopConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
      const stderrText = stderrHead.trim();
      if (spawnError || timedOut || signal || code !== 0 || stderrBytes > 0) {
        if (timedOut) {
          outcome.error = `timed out after ${timeout}ms and was killed`;
        } else if (spawnError) {
          outcome.error = spawnError.message;
        } else if (signal) {
          outcome.error = `killed by signal ${signal}`;
        } else if (code !== 0) {
          outcome.error = `exited with code ${code}${stderrText ? `: ${stderrText.split('\n')[0]}` : ''}`;
        } else {
          outcome.error = stderrText || 'wrote to stderr';
        }
        outcome.timedOut = timedOut;
        outcome.exitCode = typeof code === 'number' ? code : null;
        Object.assign(timing, {
          error: outcome.error,
          timedOut: outcome.timedOut,
          exitCode: outcome.exitCode,
        });
        debug(`sample: ${sampleNo}, concurrent: ${instanceNo} failed: ${outcome.error}`);
      } else {
        debug(`sample: ${sampleNo}, concurrent: ${instanceNo} ok`);
      }
      // Wait for the log file to flush so callers observe complete logs.
      // resolve() is idempotent, so the error path can't double-resolve.
      if (logStream) {
        logStream.on('error', () => resolve(outcome));
        logStream.end(() => resolve(outcome));
      } else {
        resolve(outcome);
      }
    };

    child.on('error', (error) => finish(error, null, null));
    child.on('close', (code, signal) => finish(null, code, signal));
  });
};

// #24/#82: failures are logged to stderr as they happen so a long run
// doesn't hide them until the end.
const logSampleFailures = (samplesCount, outcomes) => {
  outcomes.forEach((outcome, index) => {
    if (outcome && outcome.error) {
      console.error(
        `puppeteer-loadtest sample ${samplesCount + 1}: instance ${index + 1} failed: ${outcome.error}`
      );
    }
  });
};

const doAnotherSample = async (options) => {
  let {
    concurrencyRequested,
    file,
    samplesCount,
    samplesRequested,
    results,
    timeout,
    delay,
    logsDir,
  } = options;

  if(samplesCount < samplesRequested) {
    startSampleLogPerformance(results, samplesCount);
    const outcomes = await doConcurrency({ results, samplesCount, concurrencyRequested, file, timeout, delay, logsDir });
    stopSampleLogPerformance(results, samplesCount);
    const failedCount = outcomes.filter((outcome) => outcome && outcome.error).length;
    results[`sample${samplesCount + 1}`].failed = failedCount;
    results.failed += failedCount;
    if (failedCount > 0) {
      logSampleFailures(samplesCount, outcomes);
    }
    samplesCount += 1;
    return doAnotherSample({
      ...options,
      samplesCount,
      results,
    });
  }

  return results;
};

const doConcurrency = async ({ results, samplesCount, concurrencyRequested, file, timeout, delay, logsDir }) => {
  const promisesArray = [];

  for(let i=0; i < concurrencyRequested; i += 1) {
    // #86: stagger instance starts so N Chromium launches don't hit at once.
    if (i > 0 && delay > 0) {
      await sleep(delay);
    }
    promisesArray.push(
      executeTheCommand({
        file,
        concurrencyCount: i,
        results,
        samplesCount,
        timeout,
        logsDir,
      })
    );
  }

  const values = await Promise.all(promisesArray);
  const failed = values.filter((value) => value && value.error).length;
  debug(`sample ${samplesCount + 1}: ${values.length} finished, ${failed} failed`);
  return values;
};

function startPuppeteerLoadTest(paramOptions) {
  const options = Object.assign({}, defaultOptions, paramOptions);
  // Never share defaultOptions.results between runs: each call gets its own.
  if (!paramOptions || !paramOptions.results) {
    options.results = {};
  }
  options.samplesCount = 0;
  options.results.failed = 0;
  if (options.logsDir) {
    fs.mkdirSync(options.logsDir, { recursive: true });
  }
  return doAnotherSample(options);
}

module.exports = startPuppeteerLoadTest;
