# puppeteer-loadtest

puppeteer-loadtest provides a simple way to launch multiple puppeteer instances in parallel to run a simple load test on your site.

## Installation

Install via npm:

    $ npm install -g puppeteer-loadtest

## Usage

To run a basic load test, just supply the name of a CasperJS script to run:

    $ DEBUG=* puppeteer-loadtest --file=sample.js

This will run the specified CasperJS script once in PhantomJS instance.

### Parameters

`--s` flag is to mention sample size
`--c` flag is to mention number of concurrent executions per sample
`--silent` boolean to enable or disable logs

    $ puppeteer-loadtest --s=100 --c=25 --file=sample.js
    
This will run a total of 100 runs through the specified CasperJS script across 25 concurrent PhantomJS instances.
    

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
