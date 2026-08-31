/**
 * Mäter banorna i stället för att gissa på dem.
 *
 *   node tools/audit.mjs
 *
 * Tre frågor per bana:
 *
 * 1. **Behövs varje del?** Om lösningen fortfarande vinner när en av dess
 *    delar plockas bort är den delen utfyllnad — antingen ska den bort ur
 *    brickan eller så ska banan kräva den.
 * 2. **Hur trång är banan?** Andelen slumpmässiga bygg som vinner säger hur
 *    stort lösningsutrymmet är. Ett par procent är en rimlig utmaning; noll
 *    komma noll betyder att banan bara har ett enda pixelperfekt svar.
 * 3. **Går den att klara utan att bygga något?** Då är den inget pussel.
 *
 * Siffrorna är inte betyg i sig — en svår bana får vara trång. De visar när en
 * bana är trång *av misstag*, och när svårighetskurvan går åt fel håll.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
await page.goto("file://" + path.join(root, "index.html"));
await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

const rows = await page.evaluate((samples) => {
  const K = window.__kulbanan;
  let seed = 13579;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (a, b) => a + rnd() * (b - a);

  return K.levels.map((lv, i) => {
    const trayList = [];
    Object.keys(lv.tray).forEach((k) => {
      for (let n = 0; n < lv.tray[k]; n++) trayList.push(k);
    });

    // vilka av lösningens delar går att plocka bort utan att den slutar vinna?
    const spare = [];
    lv.solution.forEach((_, k) => {
      const without = lv.solution.filter((__, m) => m !== k);
      if (K.simulate(i, without, 1500).result === "win") spare.push(lv.solution[k].type);
    });

    // hur ofta vinner ett slumpmässigt bygge med hela brickan?
    let hits = 0, tried = 0;
    for (let n = 0; n < samples; n++) {
      const parts = trayList.map((t) => ({
        type: t,
        x: Math.round(pick(70, 890)),
        y: Math.round(pick(150, 600)),
        a: Math.round(pick(-70, 70) / 5) * 5
      }));
      if (K.isBlocked(i, parts).some(Boolean)) continue;
      tried++;
      if (K.simulate(i, parts, 1200).result === "win") hits++;
    }

    return {
      n: i + 1,
      name: lv.name,
      tray: trayList,
      used: lv.solution.map((p) => p.type),
      spare,
      stars: lv.stars.length,
      hitRate: tried ? hits / tried : 0,
      tried,
      empty: K.simulate(i, [], 900).result
    };
  });
}, 2200);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("Bana", 24) + pad("bricka", 26) + pad("lösning", 22) + pad("stjärnor", 9) + pad("träff%", 8) + "utan delar");
console.log("-".repeat(100));
for (const r of rows) {
  console.log(
    pad(`${r.n} ${r.name}`, 24) +
    pad(r.tray.join(","), 26) +
    pad(r.used.join(","), 22) +
    pad(r.stars, 9) +
    pad((r.hitRate * 100).toFixed(2), 8) +
    r.empty
  );
}
const flagged = rows.filter((r) => r.spare.length || r.empty === "win" || r.tray.length > r.used.length);
if (flagged.length) {
  console.log("\nAtt titta på:");
  for (const r of flagged) {
    if (r.empty === "win") console.log(`  ${r.n} ${r.name}: klaras utan att man bygger något`);
    if (r.spare.length) console.log(`  ${r.n} ${r.name}: lösningen vinner även utan ${r.spare.join(", ")}`);
    else if (r.tray.length > r.used.length)
      console.log(`  ${r.n} ${r.name}: brickan har ${r.tray.length} delar, lösningen använder ${r.used.length}`);
  }
}
await browser.close();
