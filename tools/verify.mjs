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

if (errors.length) {
  console.error("Fel i sidan:\n  " + errors.join("\n  "));
  failed += errors.length;
}

await browser.close();
console.log(failed ? `\n${failed} fel` : `\nAlla ${levels.length} banor klara`);
process.exit(failed ? 1 : 0);
