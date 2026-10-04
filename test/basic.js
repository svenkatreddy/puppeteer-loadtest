const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://example.com');
    await page.screenshot({ path: 'example.png' });
    console.log('success');
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
  }
})();
