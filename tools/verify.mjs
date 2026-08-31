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

// en sparad lösning får inte lägga en del inuti fast plywood, koppen eller
// lådan — spelet vägrar spela ett sånt bygge, så testet skulle hänga
for (let i = 0; i < levels.length; i++) {
  const jam = await page.evaluate(
    (n) => window.__kulbanan.isBlocked(n, window.__kulbanan.levels[n].solution),
    i
  );
  if (jam.some(Boolean)) {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: lösningen sitter i vägen (${JSON.stringify(jam)})`);
    failed++;
  }
}

// Ingen bana får ha utfyllnad i brickan: det som ligger där ska lösningen
// använda. En del man aldrig behöver är en gåta utan svar.
for (let i = 0; i < levels.length; i++) {
  const fill = await page.evaluate((n) => {
    const lv = window.__kulbanan.levels[n];
    const used = {};
    lv.solution.forEach((p) => { used[p.type] = (used[p.type] || 0) + 1; });
    const extra = Object.keys(lv.tray).filter((k) => (used[k] || 0) < lv.tray[k]);
    return { extra, missing: Object.keys(used).filter((k) => (lv.tray[k] || 0) < used[k]) };
  }, i);
  if (fill.extra.length) {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: brickan har ${fill.extra.join(", ")} som lösningen inte använder`);
    failed++;
  }
  if (fill.missing.length) {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: lösningen använder ${fill.missing.join(", ")} som inte finns i brickan`);
    failed++;
  }
}

// En sparad lösning ska ligga innanför brädan. En del som hänger utanför
// kanten fungerar, men den ser trasig ut och lär ut fel sak.
for (let i = 0; i < levels.length; i++) {
  const outside = await page.evaluate((n) => {
    const K = window.__kulbanan;
    return K.levels[n].solution.filter((s) =>
      K.partBodiesOf(s).some((body) =>
        body.vertices.some((v) => v.x < 0 || v.x > 960 || v.y < 0 || v.y > 640))
    ).map((s) => s.type);
  }, i);
  if (outside.length) {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: ${outside.join(", ")} hänger utanför brädan`);
    failed++;
  }
}

// tom bricka får aldrig räcka
for (let i = 0; i < levels.length; i++) {
  const r = await page.evaluate((n) => window.__kulbanan.simulate(n, [], 900).result, i);
  if (r === "win") {
    console.error(`✗ Bana ${i + 1} ${levels[i]}: klaras utan att man bygger något`);
    failed++;
  }
}

// Den sparade lösningen ska klara banan hela vägen genom gränssnittet. Alla
// banor låses upp en gång i stället för att sidan laddas om per bana — arton
// omladdningar tog längre tid än alla arton fysikkörningar tillsammans.
await page.evaluate((n) => {
  try {
    localStorage.setItem("kulbanan.progress", String(n));
    localStorage.setItem("kulbanan.taught", "1");
  } catch (e) {
    /* privat läge — då låser väljaren, och testet nedan säger till */
  }
}, levels.length - 1);
await page.reload();
await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

for (let i = 0; i < levels.length; i++) {
  await page.click(`.lvl >> nth=${i}`);
  await page.evaluate(() => window.__kulbanan.applySolution());
  await page.click("#play");
  // spola fram i stället för att vänta på bildrutorna — samma fysik, samma
  // utfall, men arton banor i realtid tar minuter
  await page.evaluate(() => window.__kulbanan.runToEnd());
  await page.waitForSelector('.veil[data-open="true"]', { timeout: 20000 });
  const title = await page.getAttribute(".veil", "data-result");
  if (title === "win") {
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
  const title = await hand.getAttribute(".veil", "data-result");
  if (title === "win") {
    console.log(`✓ Bygg för hand (${label})`);
    hands++;
  } else {
    console.error(`✗ Bygg för hand (${label}): "${title}"`);
    failed++;
  }
  await ctx.close();
}

// Bygg bana 1 från tangentbordet: ta plankan med 1, flytta med pilarna, vrid
// med punkt, spela med Enter. Hela spelet ska gå att klara utan pekdon.
{
  const ctx = await browser.newContext({ viewport: { width: 1120, height: 940 } });
  const kb = await ctx.newPage();
  await kb.bringToFront();
  kb.on("pageerror", (e) => errors.push("tangentbord: " + e.message));
  await kb.goto(page_url);
  await kb.evaluate(() => {
    try { localStorage.removeItem("kulbanan.progress"); } catch (e) {}
  });
  await kb.reload();
  await kb.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

  await kb.keyboard.press("1");
  const press = async (key, times) => {
    for (let n = 0; n < times; n++) await kb.keyboard.press(key);
  };
  // delen läggs mitt på brädan; därifrån till lösningens läge
  await press("ArrowLeft", Math.round((480 - 219) / 6));
  await press("ArrowUp", Math.round((320 - 203) / 6));
  await press(".", 6);
  await kb.keyboard.press("Enter");
  await kb.waitForSelector('.veil[data-open="true"]', { timeout: 20000 });
  const title = await kb.getAttribute(".veil", "data-result");
  if (title === "win") {
    console.log("✓ Bygg med tangentbord");
  } else {
    console.error(`✗ Bygg med tangentbord: "${title}"`);
    failed++;
  }
  await ctx.close();
}

// Kantfall: saker en spelare gör som inte står i instruktionerna.
{
  const ctx = await browser.newContext({ viewport: { width: 1120, height: 940 } });
  const edge = await ctx.newPage();
  await edge.bringToFront();
  edge.on("pageerror", (e) => errors.push("kantfall: " + e.message));

  // localStorage som kastar ska inte hindra spelet från att starta
  await edge.addInitScript(() => {
    const boom = () => { throw new Error("lagring nekad"); };
    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => ({ getItem: boom, setItem: boom, removeItem: boom })
      });
    } catch (e) { /* vissa byggen tillåter inte det här — då testas resten ändå */ }
  });
  await edge.goto(page_url);
  await edge.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });
  const started = await edge.$eval("#play", (el) => !el.disabled);
  console.log(started ? "✓ Startar även när lagringen nekas" : "✗ Startar inte när lagringen nekas");
  if (!started) failed++;

  // byta bana mitt i ett försök
  await edge.evaluate(() => window.__kulbanan.applySolution());
  await edge.click("#play");
  await edge.waitForTimeout(250);
  await edge.click(".lvl >> nth=0");
  await edge.waitForTimeout(150);
  const stopped = await edge.evaluate(() => document.getElementById("play").textContent === "Spela");
  console.log(stopped ? "✓ Byta bana mitt i ett försök" : "✗ Försöket rullar vidare efter banbyte");
  if (!stopped) failed++;

  // en del ovanpå lådan ska vägras
  const jam = await edge.evaluate(() => {
    const lv = window.__kulbanan.levels[0];
    return window.__kulbanan.isBlocked(0, [{ type: "plank", x: lv.spawn.x, y: lv.spawn.y, a: 0 }])[0];
  });
  console.log(jam ? "✓ Del ovanpå kulans födelseplats vägras" : "✗ Del får sitta där kulan föds");
  if (!jam) failed++;

  // fönstret ändrar storlek mitt i ett försök
  await edge.evaluate(() => window.__kulbanan.applySolution());
  await edge.click("#play");
  await edge.waitForTimeout(200);
  await edge.setViewportSize({ width: 780, height: 700 });
  await edge.waitForTimeout(200);
  await edge.waitForSelector('.veil[data-open="true"]', { timeout: 20000 });
  const survived = await edge.getAttribute(".veil", "data-result");
  console.log(survived === "win" ? "✓ Storleksändring mitt i ett försök" : `✗ Storleksändring bröt försöket: "${survived}"`);
  if (survived !== "win") failed++;

  await ctx.close();
}

if (errors.length) {
  console.error("Fel i sidan:\n  " + errors.join("\n  "));
  failed += errors.length;
}

await browser.close();
console.log(failed ? `\n${failed} fel` : `\nAllt grönt: ${levels.length} banor, ${hands} handbyggen, tangentbord och kantfall`);
process.exit(failed ? 1 : 0);
