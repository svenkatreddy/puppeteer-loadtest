#! /usr/bin/env node
'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const startPuppeteerLoadTest = require('.');

const file = argv.file;
const samplesRequested = argv.s || 1;
const concurrencyRequested = argv.c || 1;
const silent = argv.silent || false;
const outputFile = argv.outputFile;

// #82: --timeout (or -t): kill an instance running longer than this many ms. 0 = no limit.
const timeout = parseNonNegativeInt(argv.timeout !== undefined ? argv.timeout : argv.t, 'timeout');
// #86: --delay (or -d): wait this many ms between spawning concurrent instances.
const delay = parseNonNegativeInt(argv.delay !== undefined ? argv.delay : argv.d, 'delay');

function parseNonNegativeInt(value, name) {
  if (value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`puppeteer-loadtest: invalid --${name} value "${value}", using 0`);
    return 0;
  }
  return Math.floor(parsed);
}

if (!file) {
  console.error('cannot find --file option');
  process.exitCode = 1;
  return;
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
    timeout,
    delay,
  });

  if (results) {
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, "\t"));
    }
    if (!silent) {
      console.log(JSON.stringify(results, null, "\t"));
    }
    // #24: make failures visible to scripts and CI.
    if (results.failed > 0) {
      console.error(`puppeteer-loadtest: ${results.failed} instance(s) failed`);
      process.exitCode = 1;
    }
  }
}

start().catch((error) => {
  console.error('puppeteer-loadtest:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
