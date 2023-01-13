#! /usr/bin/env node
'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const exec = require('child_process').exec;
const argv = require('minimist')(process.argv.slice(2));
const perf = require('execution-time')();
const fs = require('fs');
const startPuppeteerLoadTest = require('.');

const file = argv.file;
const samplesRequested = argv.s || 1;
const concurrencyRequested = argv.c || 1;
const silent = argv.silent || false;
const addIdArgument = argv.addId || false;
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


const start = async () => {
  const results = await startPuppeteerLoadTest({
    file,
    samplesRequested,
    concurrencyRequested,
    addIdArgument
  });

  if (results) {
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, "\t"));
    }
    if (!silent) {
      console.log(JSON.stringify(results, null, "\t"));
    }
  }
}

start();