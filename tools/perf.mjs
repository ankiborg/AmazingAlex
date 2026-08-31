/**
 * Mäter rittiden per bildruta, i byggläge och mitt i ett försök.
 *
 *   node tools/perf.mjs
 *
 * Vad siffran faktiskt mäter: **JavaScript-kostnaden för att utfärda
 * ritkommandona**, inte GPU:ns rastrering — canvas 2D i Chromium kör
 * asynkront, så klockan hinner stanna innan pixlarna finns. Det är ändå rätt
 * sak att mäta här: det var sexhundra arc()-anrop per bildruta för
 * pegboardens hål som kostade, och det är den kostnaden en långsam telefon
 * känner av. Budgeten för 60 bilder i sekunden är 16,7 ms, delad med fysiken,
 * och en telefon är tre till fem gånger långsammare än en bärbar dator.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1120, height: 940 } });
await page.goto("file://" + path.join(root, "index.html"));
await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

const result = await page.evaluate(async () => {
  const time = (n) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) window.__kulbanan.render();
    return (performance.now() - t0) / n;
  };
  const idle = time(300);

  window.__kulbanan.applySolution();
  document.getElementById("play").click();
  await new Promise((r) => setTimeout(r, 400));
  const busy = time(300);

  let frames = 0;
  const start = performance.now();
  await new Promise((res) => {
    (function tick() {
      frames++;
      if (performance.now() - start > 2000) return res();
      requestAnimationFrame(tick);
    })();
  });
  return { idle, busy, fps: frames / 2 };
});

console.log(`byggläge:      ${result.idle.toFixed(2)} ms/bildruta`);
console.log(`under försök:  ${result.busy.toFixed(2)} ms/bildruta`);
console.log(`uppmätt:       ${result.fps.toFixed(0)} bilder/s`);
console.log(`budget:        16,7 ms för 60 bilder/s, delad med fysiken`);
await browser.close();
