#! /usr/bin/env node
'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const exec = require('child_process').exec;
const argv = require('minimist')(process.argv.slice(2));
const perf = require('execution-time')();
const fs = require('fs');

const file = argv.file;
const samplesRequested = argv.s || 1;
const concurrencyRequested = argv.c || 1;
const silent = argv.silent || false;
const outputFile = argv.outputFile;

if (!file) {
  return console.error('cannot find --file option');
}

if (!silent) {
  createDebug.enable('puppeteer-loadtest');
}

if (!samplesRequested) {
  debug('no sample is specified, using 1 as default')
}

if (!concurrencyRequested) {
  debug('no concurrency is specified, using 1 as default')
}

debug('puppeteer-loadtest is loading...');

const cmdToExecute = `node ${file}`;
const results = {};
let samplesCount = 0;

const startSampleLogPerformance = () => {
  perf.start(`sampleCall${samplesCount + 1}`);
  results[`sample${samplesCount + 1}`] = {};
};

const stopSampleLogPerformance = () => {
  results[`sample${samplesCount + 1}`].sample = perf.stop(`sampleCall${samplesCount + 1}`);
};

const startConcurrencyLogPerformance = (concurrencyCount) => {
  perf.start(`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`);
  results[`sample${samplesCount + 1}`].concurrency = {};
}

const stopConcurrencyLogPerformance = (concurrencyCount) => {
  results[`sample${samplesCount + 1}`].concurrency[`${concurrencyCount + 1}`] = perf.stop((`sample${samplesCount + 1}concurrencyCount${concurrencyCount + 1}`));
}


const executeTheCommand = function(cmd, concurrencyCount) {
  return new Promise((resolve, reject) => {
    startConcurrencyLogPerformance(concurrencyCount);
    exec(cmd, function(error, stdout, stderr) {
      debug(`sample: ${samplesCount}, concurrent: ${concurrencyCount}`);
      stopConcurrencyLogPerformance(concurrencyCount);
      if(stderr) reject(stderr);
      if(error) reject(error);
      resolve(stdout);
    });
  });   
};

const doAnotherSample = async () => { 
  if(samplesCount < samplesRequested) {
    startSampleLogPerformance();
    await doConcurrency(results);
    stopSampleLogPerformance();
    samplesCount += 1;
    return doAnotherSample();
  }
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, "\t"));
  }
  if (!silent) {
    console.log(JSON.stringify(results, null, "\t"));
  }
};

const doConcurrency = async (results) => {
  const promisesArray = [];

  for(let i=0; i < concurrencyRequested; i += 1) {
    promisesArray.push(
      executeTheCommand(cmdToExecute, i, results)
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

doAnotherSample();
