import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:3000/analyze/AAPL', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(2000);
// click 1D button
await page.click('button:has-text("1D")');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/mp-1d.png' });
await browser.close();
