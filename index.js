'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const exec = require('child_process').exec;
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
const executeTheCommand = function({ cmd, concurrencyCount, samplesCount, results, timeout }) {
  return new Promise((resolve) => {
    startConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
    const execOptions = {};
    if (timeout > 0) {
      execOptions.timeout = timeout;
    }
    exec(cmd, execOptions, function(error, stdout, stderr) {
      const timing = stopConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
      const outcome = { stdout: stdout || '' };
      if (error || stderr) {
        outcome.error = error ? error.message : String(stderr).trim();
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

  if (typeof results.failed !== 'number') {
    results.failed = 0;
  }

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
        cmd: `node ${file}`,
        concurrencyCount: i,
        results,
        samplesCount,
        timeout,
      })
    );
  }

  let values;
  try {
    perf.start('concurrencyCall');
    values = await Promise.all(promisesArray);
    debug(values);
  } catch(error) {
    debug(error);
  }
  return values;
};

function startPuppeteerLoadTest(paramOptions) {
  const options = Object.assign({}, defaultOptions, paramOptions);
  return doAnotherSample(options);
}

module.exports = startPuppeteerLoadTest;
