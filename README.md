# puppeteer-loadtest

[![Build Status](https://travis-ci.org/svenkatreddy/puppeteer-loadtest.svg?branch=master)](https://travis-ci.org/svenkatreddy/puppeteer-loadtest)

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
`--silent` boolean to enable or disable logs
`--outputFile` send performance results to output file
`--addId` flag is to add a unique number as first argument to the puppeteer script

    $ puppeteer-loadtest --s=100 --c=25 --file=sample.js
    
This will run a total of 100 runs through the specified puppeteer script across 25 concurrent chrome headless instances.


### Examples

    $ puppeteer-loadtest --file=sample.js
    
    $ puppeteer-loadtest --file=./test/sample.js  --s=100 --c=25
    
    $ puppeteer-loadtest --file=./test/sample.js  --s=100 --c=25 --silent=true
	
	$ puppeteer-loadtest --file=./test/sample.js  --s=100 --c=25 --addId
    
    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25

    $ puppeteer-loadtest --file=./test/sample.js  -s 100 -c 25 --outputFile=performance.json


### use as node module 

    ```
    const startPuppeteerLoadTest = require('puppeteer-loadtest');
    const results = await startPuppeteerLoadTest({
        file, // path to file
        samplesRequested, // number of samples requested
        concurrencyRequested, // number of concurrency requested
    });
    console.log(results);
    ```
    
    
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
