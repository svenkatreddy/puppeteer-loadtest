'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const exec = require('child_process').exec;
const perf = require('execution-time')();

const defaultOptions = {
  file: '',
  samplesRequested: '',
  concurrencyRequested: 1,
  results: {},
  samplesCount: 0,
}

debug('puppeteer-loadtest is loading...');


const startSampleLogPerformance = (results, samplesCount) => {
  perf.start(`sampleCall${samplesCount + 1}`);
  results[`sample${samplesCount + 1}`] = {};
};

const stopSampleLogPerformance = (results, samplesCount) => {
  results[`sample${samplesCount + 1}`].sample = perf.stop(`sampleCall${samplesCount + 1}`);
};

const startConcurrencyLogPerformance = (results, concurrencyCount, samplesCount) => {
  perf.start(`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`);
  results[`sample${samplesCount + 1}`].concurrency = {};
}

const stopConcurrencyLogPerformance = (results, concurrencyCount, samplesCount) => {
  if(results[`sample${samplesCount + 1}`]) {
    results[`sample${samplesCount + 1}`].concurrency[`${concurrencyCount + 1}`] = perf.stop((`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`));
  }
}


const executeTheCommand = function({ cmd, concurrencyCount, samplesCount, results }) {
  return new Promise((resolve, reject) => {
    startConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
    exec(cmd, function(error, stdout, stderr) {
      debug(`sample: ${samplesCount}, concurrent: ${concurrencyCount}`);
      stopConcurrencyLogPerformance(results, concurrencyCount, samplesCount);
      if(stderr) reject(stderr);
      if(error) reject(error);
      resolve(stdout);
    });
  });   
};

const doAnotherSample = async (options) => { 
  let {
    concurrencyRequested,
    file,
    samplesCount,
    samplesRequested,
    results,
  } = options;

  if(samplesCount < samplesRequested) {
    startSampleLogPerformance(results, samplesCount);
    await doConcurrency({ results,  samplesCount, concurrencyRequested, file });
    stopSampleLogPerformance(results, samplesCount);
    samplesCount += 1;
    return doAnotherSample({
      concurrencyRequested,
      file,
      samplesCount,
      samplesRequested,
      results,
    });
  }

  return results;
};

const doConcurrency = async ({ results,  samplesCount, concurrencyRequested, file}) => {
  const promisesArray = [];

  for(let i=0; i < concurrencyRequested; i += 1) {
    promisesArray.push(
      executeTheCommand({ 
        cmd: `node ${file}`,
        concurrencyCount: i,
        results,
        samplesCount,
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
