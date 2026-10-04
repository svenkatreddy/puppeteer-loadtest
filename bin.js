#! /usr/bin/env node
'use strict';

const createDebug = require('debug');
const debug = createDebug('puppeteer-loadtest');
const argv = require('minimist')(process.argv.slice(2), {
  // Without this, --silent=false parses as the string "false" (truthy).
  boolean: ['silent', 'help', 'h'],
});
const fs = require('fs');
const startPuppeteerLoadTest = require('.');

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

function parsePositiveInt(value, name, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(`puppeteer-loadtest: invalid --${name} value "${value}", expected a positive integer`);
    process.exitCode = 1;
    return null;
  }
  return parsed;
}

function printHelp() {
  console.log(`puppeteer-loadtest: run a puppeteer script many times across concurrent headless Chrome instances

Usage: puppeteer-loadtest --file=script.js [options]

Options:
  --file           path to the puppeteer script to run (required)
  --s              number of samples to run (default: 1)
  --c              number of concurrent instances per sample (default: 1)
  --timeout, -t    kill an instance running longer than this many ms (default: 0 = no limit)
  --delay, -d      wait this many ms between spawning concurrent instances (default: 0)
  --silent         suppress the results JSON on stdout
  --outputFile     write the results JSON to this file
  --logs-dir       write each instance's stdout/stderr to sampleN-instanceM.log here
  --help, -h       show this help
  --version, -v    show the version number

An instance counts as failed when its script exits non-zero, writes to
stderr, or is killed by --timeout. Failures are logged, recorded in the
results JSON, and make the CLI exit non-zero.`);
}

if (argv.help || argv.h) {
  printHelp();
  return;
}

if (argv.version || argv.v) {
  console.log(require('./package.json').version);
  return;
}

const file = argv.file;
const samplesRequested = parsePositiveInt(argv.s, 's', 1);
const concurrencyRequested = parsePositiveInt(argv.c, 'c', 1);
const silent = argv.silent || false;
const outputFile = argv.outputFile;
const logsDir = argv['logs-dir'] !== undefined ? argv['logs-dir'] : (argv.logsDir || '');

// #82: --timeout (or -t): kill an instance running longer than this many ms. 0 = no limit.
const timeout = parseNonNegativeInt(argv.timeout !== undefined ? argv.timeout : argv.t, 'timeout');
// #86: --delay (or -d): wait this many ms between spawning concurrent instances.
const delay = parseNonNegativeInt(argv.delay !== undefined ? argv.delay : argv.d, 'delay');

if (samplesRequested === null || concurrencyRequested === null) {
  return;
}

if (!file) {
  console.error('cannot find --file option');
  process.exitCode = 1;
  return;
}

if (!silent) {
  createDebug.enable('puppeteer-loadtest');
}

debug('puppeteer-loadtest is loading...');


const start = async () => {
  const results = await startPuppeteerLoadTest({
    file,
    samplesRequested,
    concurrencyRequested,
    timeout,
    delay,
    logsDir,
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
