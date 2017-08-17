const puppeteer = require('puppeteer');

(async() => {

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('http://example.com');
await page.screenshot({path: 'example.png'});
console.log("success");
browser.close();

})();