#! /usr/bin/env node
'use strict';

process.env.DEBUG = "puppeteer-loadtest";
const exec = require('child_process').exec;
const argv = require('minimist')(process.argv.slice(2));
const debug = require('debug')('puppeteer-loadtest');
const perf = require('execution-time')();

const file = argv.file;
const samplesRequested = argv.s || 1;
const concurrencyRequested = argv.c || 1;

if(!file) {
  return console.error('cannot find --file option');
}

if(!samplesRequested) {
  debug('no sample is specified, using 1 as default')
}

if(!concurrencyRequested) {
  debug('no concurrency is specified, using 1 as default')
}

debug('puppeteer-loadtest is loading...');

const cmdToExecute = `node ${file}`;
const results = {};
let samplesCount = 0;
let concurrencyCount = 0;

const executeTheCommand = function(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, function(error, stdout, stderr) {
      concurrencyCount += 1;
      debug(`sample: ${samplesCount}`);
      debug(`concurrent: ${concurrencyCount}`);
      if(stderr) reject(stderr);
      if(error) reject(error);
      resolve(stdout);
    });
  });   
};

const doAnotherSample = () => { 
  if(samplesCount < samplesRequested) {
    doConcurrency();
    samplesCount += 1;
  }
};

const doConcurrency = () => {
  const promisesArray = [];

  for(let i=0; i<concurrencyRequested; i += 1) {
    promisesArray.push(
      executeTheCommand(cmdToExecute)
    );
  }

  concurrencyCount = 0;
  Promise.all(promisesArray)
  .then(values => { 
    debug(values);
    doAnotherSample();
  })
  .catch(error => {
    debug(error);
    doAnotherSample();
  });
};

doAnotherSample();