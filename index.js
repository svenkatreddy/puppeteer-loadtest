'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const execFile = require('child_process').execFile;
const perf = require('execution-time')();

const defaultOptions = {
  file: '',
  samplesRequested: 1,
  concurrencyRequested: 1,
  // #82: kill an instance if it runs longer than this (ms). 0 = no limit (backward compatible).
  timeout: 0,
  // #86: wait this many ms between spawning concurrent instances. 0 = spawn all at once.
  delay: 0,
  results: {},
  samplesCount: 0,
}

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
const executeTheCommand = function({ file, concurrencyCount, samplesCount, results, timeout }) {
  return new Promise((resolve) => {
    startConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
    // 10MB: puppeteer scripts can be chatty; the 1MB default turns verbose
    // logging into a spurious failure.
    const execOptions = { maxBuffer: 10 * 1024 * 1024 };
    if (timeout > 0) {
      execOptions.timeout = timeout;
      // A hung browser can shrug off SIGTERM; the kill switch must kill.
      execOptions.killSignal = 'SIGKILL';
    }
    // execFile without a shell: paths with spaces work, no quoting bugs.
    execFile(process.execPath, [file], execOptions, function(error, stdout, stderr) {
      const timing = stopConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
      // Note: stdout is intentionally not retained. Nothing consumes it
      // (results JSON and the module API never see it); keeping it would
      // hold up to maxBuffer per instance in memory and dump it all into
      // debug output at the end of every sample.
      const outcome = {};
      const stderrText = String(stderr || '').trim();
      if (error || stderrText) {
        outcome.error = error ? error.message : stderrText;
        // #82: child_process sets killed=true when the timeout fires.
        outcome.timedOut = Boolean(error && error.killed);
        outcome.exitCode = error && typeof error.code === 'number' ? error.code : null;
        Object.assign(timing, {
          error: outcome.error,
          timedOut: outcome.timedOut,
          exitCode: outcome.exitCode,
        });
        debug(`sample: ${samplesCount + 1}, concurrent: ${concurrencyCount + 1} failed: ${outcome.error}`);
      } else {
        debug(`sample: ${samplesCount + 1}, concurrent: ${concurrencyCount + 1} ok`);
      }
      resolve(outcome);
    });
  });
};

// #24/#82: failures are logged to stderr as they happen so a long run
// doesn't hide them until the end.
const logSampleFailures = (samplesCount, outcomes, timeout) => {
  outcomes.forEach((outcome, index) => {
    if (outcome && outcome.error) {
      const reason = outcome.timedOut
        ? `timed out after ${timeout}ms and was killed`
        : outcome.error;
      console.error(
        `puppeteer-loadtest sample ${samplesCount + 1}: instance ${index + 1} failed: ${reason}`
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
  } = options;

  if(samplesCount < samplesRequested) {
    startSampleLogPerformance(results, samplesCount);
    const outcomes = await doConcurrency({ results, samplesCount, concurrencyRequested, file, timeout, delay });
    stopSampleLogPerformance(results, samplesCount);
    const failedCount = outcomes.filter((outcome) => outcome && outcome.error).length;
    results[`sample${samplesCount + 1}`].failed = failedCount;
    results.failed += failedCount;
    if (failedCount > 0) {
      logSampleFailures(samplesCount, outcomes, timeout);
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

const doConcurrency = async ({ results, samplesCount, concurrencyRequested, file, timeout, delay }) => {
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
  return doAnotherSample(options);
}

module.exports = startPuppeteerLoadTest;
