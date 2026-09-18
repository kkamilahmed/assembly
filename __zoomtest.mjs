import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5176/', { waitUntil: 'networkidle' });
// wait past the full 10.5s cinematic intro so OrbitControls is active
await page.waitForTimeout(13000);
await page.screenshot({ path: '/private/tmp/claude-501/-Users-kkamil-Desktop-vault-demo-assembly/ea5266bd-e2a5-483a-8da5-69524c8ceb3e/scratchpad/zoom-0-before.png' });

// scroll-to-zoom out repeatedly at canvas center
const canvasBox = { x: 640, y: 500 };
for (let i = 0; i < 40; i++) {
  await page.mouse.move(canvasBox.x, canvasBox.y);
  await page.mouse.wheel(0, 120); // positive deltaY = zoom out in most OrbitControls setups
  await page.waitForTimeout(50);
}
await page.waitForTimeout(500);
await page.screenshot({ path: '/private/tmp/claude-501/-Users-kkamil-Desktop-vault-demo-assembly/ea5266bd-e2a5-483a-8da5-69524c8ceb3e/scratchpad/zoom-1-out.png' });

for (let i = 0; i < 40; i++) {
  await page.mouse.move(canvasBox.x, canvasBox.y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(50);
}
await page.waitForTimeout(500);
await page.screenshot({ path: '/private/tmp/claude-501/-Users-kkamil-Desktop-vault-demo-assembly/ea5266bd-e2a5-483a-8da5-69524c8ceb3e/scratchpad/zoom-2-maxout.png' });

await browser.close();
