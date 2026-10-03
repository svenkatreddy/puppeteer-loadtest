// Simulates a hung puppeteer script; the --timeout flag should kill it.
setTimeout(() => console.log('done'), 30000);
