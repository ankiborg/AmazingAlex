/**
 * Letar lösningar till en bana genom att köra spelets egen fysik.
 *
 *   node tools/search.mjs            # alla banor
 *   node tools/search.mjs 2 4        # bara bana 3 och 5 (nollindexerat)
 *   node tools/search.mjs 2 --budget 40000
 *
 * Sökningen är en beam-sökning i lika många steg som banan har delar. Varje
 * steg provar placeringar av nästa del och behåller de som för kulan närmast
 * stegets delmål; delmålen ligger utspridda på linjen från lådan till rännans
 * övre ände, som är den grind varje bana leder igenom. Sista steget siktar på
 * en punkt som vilar på rännan — kommer kulan dit rullar den hem själv.
 *
 * Bara placeringar som spelet faktiskt tillåter räknas: en del som sitter inuti
 * fast plywood, koppen, lådan eller en annan del förkastas, och en lösning
 * räknas bara om kulan tar alla stjärnor. Träffarna avrundas till heltal och
 * verifieras om — det är heltal som hamnar i index.html, och avrundningen kan
 * ändra utfallet.
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const budgetFlag = args.indexOf("--budget");
const budget = budgetFlag >= 0 ? Number(args[budgetFlag + 1]) : 26000;
const wanted = args
  .filter((a, i) => /^\d+$/.test(a) && i !== budgetFlag + 1)
  .map(Number);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
await page.goto("file://" + path.join(root, "index.html"));
await page.waitForFunction(() => !!window.__kulbanan, null, { timeout: 15000 });

const found = await page.evaluate(
  ({ wanted, budget }) => {
    const K = window.__kulbanan;
    const levels = wanted.length ? wanted : K.levels.map((_, i) => i);
    let seed = 20260830;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = (a, b) => a + rnd() * (b - a);

    const out = [];
    for (const i of levels) {
      const lv = K.levels[i];
      const types = [];
      Object.keys(lv.tray).forEach((k) => {
        for (let n = 0; n < lv.tray[k]; n++) types.push(k);
      });

      const chute = lv.fixed[lv.fixed.length - 1];
      const rad = (chute.a * Math.PI) / 180;
      const gate = {
        x: chute.x - (chute.w / 2) * Math.cos(rad),
        y: chute.y - (chute.w / 2) * Math.sin(rad)
      };
      const tail = {
        x: chute.x + (chute.w / 2) * Math.cos(rad),
        y: chute.y + (chute.w / 2) * Math.sin(rad)
      };
      const landing = {
        x: gate.x + (tail.x - gate.x) * 0.4,
        y: gate.y + (tail.y - gate.y) * 0.4 - 24
      };
      const waypoint = (k) => ({
        x: lv.spawn.x + (gate.x - lv.spawn.x) * ((k + 1) / types.length),
        y: lv.spawn.y + (gate.y - lv.spawn.y) * ((k + 1) / types.length)
      });
      const closest = (path, w) =>
        Math.min(...path.map((q) => Math.hypot(q.x - w.x, q.y - w.y)));

      let beam = [{ parts: [] }];
      const wins = [];
      for (let stage = 0; stage < types.length; stage++) {
        const target = stage === types.length - 1 ? landing : waypoint(stage);
        const per = Math.ceil(budget / (beam.length * types.length));
        const cands = [];
        for (const node of beam) {
          for (let n = 0; n < per; n++) {
            const px = Math.round(pick(70, 890));
            const py = Math.round(pick(150, 600));
            const pa = Math.round(pick(-70, 70) / 5) * 5;
            const parts = node.parts.concat([{ type: types[stage], x: px, y: py, a: pa }]);
            if (K.isBlocked(i, parts).some(Boolean)) continue;
            const r = K.simulate(i, parts, 1500);
            if (r.result === "win") wins.push({ parts, steps: r.steps });
            else cands.push({ parts, score: -closest(r.path, target) });
          }
        }
        cands.sort((a, b) => b.score - a.score);
        const kept = [];
        for (const c of cands) {
          const last = c.parts[c.parts.length - 1];
          const spread = kept.every((k) => {
            const m = k.parts[k.parts.length - 1];
            return Math.hypot(m.x - last.x, m.y - last.y) > 40 || Math.abs(m.a - last.a) > 15;
          });
          if (spread) kept.push(c);
          if (kept.length >= 16) break;
        }
        beam = kept.length ? kept : cands.slice(0, 16);
        if (wins.length >= 40) break;
      }

      // en lösning duger bara om den fortfarande vinner som heltal
      const solid = wins.filter((w) => K.simulate(i, w.parts, 1500).result === "win");

      /**
       * Stjärnor hör hemma på den sträcka spelaren själv formar: efter att
       * kulan lämnat sin fallinje, före rännan som rullar den hem. En stjärna
       * på rännan tar varje lösning gratis, och en som ligger inom en delbredd
       * göms bakom plywooden.
       */
      const proposeStars = (parts, count) => {
        const keep = lv.stars;
        lv.stars = [];
        const run = K.simulate(i, parts, 1500);
        lv.stars = keep;
        const away = (q, pt, d) => Math.hypot(q.x - pt.x, q.y - pt.y) > d;
        const segToChute = (q) => {
          const dx = tail.x - gate.x, dy = tail.y - gate.y;
          const u = Math.max(0, Math.min(1, ((q.x - gate.x) * dx + (q.y - gate.y) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(q.x - (gate.x + dx * u), q.y - (gate.y + dy * u));
        };
        let from = run.path.findIndex((q) => Math.abs(q.x - lv.spawn.x) > 30);
        if (from < 0) from = 0;
        let to = run.path.findIndex((q, k) => k > from && segToChute(q) < 34);
        if (to < 0) to = run.path.length;
        const span = run.path
          .slice(from, to)
          .filter((q) =>
            parts.every((p) => away(q, p, 55)) &&
            away(q, lv.spawn, 120) && away(q, lv.cup, 130) &&
            q.y > 140 && q.y < 590 && q.x > 60 && q.x < 900);
        if (span.length < 6) return null;
        const at = (f) => ({ x: Math.round(span[Math.floor(span.length * f)].x),
                             y: Math.round(span[Math.floor(span.length * f)].y) });
        const stars = count === 1 ? [at(0.5)] : [at(0.25), at(0.7)];
        if (stars.length === 2 && Math.hypot(stars[0].x - stars[1].x, stars[0].y - stars[1].y) < 90) return null;
        lv.stars = stars;
        const ok = K.simulate(i, parts, 1500).result === "win";
        lv.stars = keep;
        return ok ? stars : null;
      };
      const empty = K.simulate(i, [], 900).result;
      const best = solid.length ? solid[Math.floor(solid.length / 2)].parts : null;
      out.push({
        level: i,
        name: lv.name,
        wins: solid.length,
        emptyTray: empty,
        best: best,
        stars: best && !lv.stars.length ? (proposeStars(best, 2) || proposeStars(best, 1)) : lv.stars,
        all: solid.slice(0, 12).map((w) => w.parts)
      });
    }
    return out;
  },
  { wanted, budget }
);

for (const r of found) {
  const flag = r.emptyTray === "win" ? "  ⚠ klaras med tom bricka" : "";
  console.log(`Bana ${r.level + 1} ${r.name}: ${r.wins} lösningar${flag}`);
  if (r.best) console.log("  delar:    " + JSON.stringify(r.best));
  if (r.stars) console.log("  stjärnor: " + JSON.stringify(r.stars));
}
fs.writeFileSync(path.join(root, "tools", "solutions.json"), JSON.stringify(found, null, 1));
console.log("\nSkrev tools/solutions.json");
await browser.close();
