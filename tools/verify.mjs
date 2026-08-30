/**
 * Regressionstest för banorna.
 *
 * Varje bana bär sin egen lösning i `solution`. Testet spelar upp den genom
 * det riktiga gränssnittet — inte bara i fysiksimulatorn — och kräver att
 * kulan hamnar i koppen med alla stjärnor tagna. Det kollar också att banan
 * inte går att klara med tom bricka, annars är den inget pussel.
 *
 * Kör: npm test        (CHROMIUM_PATH pekar ut en egen webbläsare om Playwrights
 *                       nedladdade saknas)
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const page_url =
  "file://" + path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1120, height: 940 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  // typsnitten hämtas utifrån och får saknas; allt annat är ett fel
  if (m.type() === "error" && !m.text().includes("ERR_")) errors.push(m.text());
});

await page.goto(page_url);
await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

const levels = await page.evaluate(() => window.__kulbanan.levels.map((l) => l.name));
let failed = 0;
let hands = 0;

// tom bricka får aldrig räcka
for (let i = 0; i < levels.length; i++) {
  const r = await page.evaluate((n) => window.__kulbanan.simulate(n, [], 900).result, i);
  if (r === "win") {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: klaras utan att man bygger något`);
    failed++;
  }
}

// den sparade lösningen ska klara banan hela vägen genom gränssnittet
for (let i = 0; i < levels.length; i++) {
  await page.evaluate((n) => {
    try {
      localStorage.setItem("kulbanan.progress", String(n));
    } catch (e) {
      /* privat läge — nivåväljaren låser då, så vi laddar om ändå */
    }
  }, i);
  await page.reload();
  await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });
  await page.click(`.lvl >> nth=${i}`);
  await page.evaluate(() => window.__kulbanan.applySolution());
  await page.click("#play");
  await page.waitForSelector('.veil[data-open="true"]', { timeout: 20000 });
  const title = await page.textContent("#veilTitle");
  if (title === "Klart!") {
    console.log(`✓ Bana ${i + 1} ${levels[i]}`);
  } else {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: "${title}"`);
    failed++;
  }
}

// Bakgrundsflikar får sin requestAnimationFrame strypt, och spelets fysik går i
// takt med den. Stäng den första sidan så att handtesterna kör i förgrunden.
await page.close();

// Bygg bana 1 för hand — dra ut plankan ur hyllan, vrid den med ratten och
// spela. Det är den vägen en spelare faktiskt tar, och den går sönder av annat
// än det som får simuleringen att gå sönder.
for (const [label, opts] of [
  ["mus 1120px", { viewport: { width: 1120, height: 940 } }],
  ["pek 1080px", { viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true }],
  ["pek 390px", { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true }]
]) {
  const ctx = await browser.newContext(opts);
  const hand = await ctx.newPage();
  await hand.bringToFront();
  hand.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await hand.goto(page_url);
  // banväljaren minns hur långt man kommit; testet ska börja på bana 1
  await hand.evaluate(() => {
    try { localStorage.removeItem("kulbanan.progress"); } catch (e) {}
  });
  await hand.reload();
  await hand.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

  const box = await (await hand.$("#board")).boundingBox();
  const k = box.width / 960;
  const at = (x, y) => ({ x: box.x + x * k, y: box.y + y * k });
  const slot = await (await hand.$(".slot")).boundingBox();

  const drop = at(219, 203);
  await hand.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await hand.mouse.down();
  await hand.mouse.move(drop.x, drop.y, { steps: 14 });
  await hand.mouse.up();

  const knob = at(219 + 127, 203);
  const swing = at(219 + 127 * Math.cos(Math.PI / 6), 203 + 127 * Math.sin(Math.PI / 6));
  await hand.mouse.move(knob.x, knob.y);
  await hand.mouse.down();
  await hand.mouse.move(swing.x, swing.y, { steps: 12 });
  await hand.mouse.up();

  await hand.click("#play");
  await hand.waitForSelector('.veil[data-open="true"]', { timeout: 20000 });
  const title = await hand.textContent("#veilTitle");
  if (title === "Klart!") {
    console.log(`✓ Bygg för hand (${label})`);
    hands++;
  } else {
    console.error(`✗ Bygg för hand (${label}): "${title}"`);
    failed++;
  }
  await ctx.close();
}

if (errors.length) {
  console.error("Fel i sidan:\n  " + errors.join("\n  "));
  failed += errors.length;
}

await browser.close();
console.log(failed ? `\n${failed} fel` : `\nAllt grönt: ${levels.length} banor och ${hands} handbyggen`);
process.exit(failed ? 1 : 0);
