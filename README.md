# puppeteer-loadtest

[![CI](https://github.com/svenkatreddy/puppeteer-loadtest/actions/workflows/ci.yml/badge.svg)](https://github.com/svenkatreddy/puppeteer-loadtest/actions/workflows/ci.yml)

[![NPM](https://nodei.co/npm/puppeteer-loadtest.png?stars=true)](https://nodei.co/npm/puppeteer-loadtest/)

puppeteer-loadtest provides a simple way to launch multiple puppeteer instances in parallel to run a simple load test on your site.

## Installation

Install via npm:

    $ npm install -g puppeteer-loadtest

## Usage

To run a basic load test, just supply the name of a puppeteer script to run:

    $ puppeteer-loadtest --file=sample.js

This will run the specified puppeteer script once in chrome headless instance.

### Parameters

`--s` flag is to mention sample size
`--c` flag is to mention number of concurrent executions per sample
`--timeout` (`-t`) flag kills an instance if it runs longer than the given milliseconds (0 = no limit, the default)
`--delay` (`-d`) flag waits the given milliseconds between spawning concurrent instances, so N Chromium launches don't all hit at once (0 = spawn all at once, the default)
`--silent` boolean to enable or disable logs
`--outputFile` send performance results to output file

    $ puppeteer-loadtest --s=100 --c=25 --file=sample.js
    
This will run a total of 100 runs through the specified puppeteer script across 25 concurrent chrome headless instances.

### Failure reporting

If a script instance exits non-zero, writes to stderr, or is killed by `--timeout`, the failure is logged with its sample and instance number, recorded in the results JSON (`failed` counts plus per-instance `error`, `timedOut`, and `exitCode`), and the CLI exits with a non-zero status so scripts and CI can detect it:

    $ puppeteer-loadtest --file=sample.js --timeout=30000
    puppeteer-loadtest sample 1: instance 2 failed: timed out after 30000ms and was killed
    puppeteer-loadtest: 1 instance(s) failed
    $ echo $?
    1


### Examples

    $ puppeteer-loadtest --file=sample.js
    
    $ puppeteer-loadtest --file=./test/sample.js  --s=100 --c=25
    
    $ puppeteer-loadtest --file=./test/sample.js  --s=100 --c=25 --silent=true
    
    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25

    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25 --outputFile=performance.json

    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25 --delay=2000

    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25 --timeout=60000


### use as node module 

    ```
    const startPuppeteerLoadTest = require('puppeteer-loadtest');
    const results = await startPuppeteerLoadTest({
        file, // path to file
        samplesRequested, // number of samples requested
        concurrencyRequested, // number of concurrency requested
        timeout, // kill an instance running longer than this many ms (0 = no limit)
        delay, // wait this many ms between spawning concurrent instances
    });
    console.log(results);
    ```
    
`results.failed` holds the total number of failed instances across all samples; each sample has its own `failed` count, and each failed instance entry carries `error`, `timedOut`, and `exitCode`.
    
    
## Contributors

[David Madden](https://github.com/moose56)

[yuji38kwmt](https://github.com/yuji38kwmt)
    
   
## Feedback   

please provide feedback or feature requests using issues link
    

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
