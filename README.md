# Kulbanan

Ett fysikpussel av Rube Goldberg-typ — samma genre som Rovios *Amazing Alex*,
*The Incredible Machine* och *Casey's Contraptions*. Du nålar fast plankor på en
pegboard, trycker på **Spela**, och fysiken avgör resten: kulan ska ta alla
stjärnor innan den landar i koppen.

Öppna `index.html` i en webbläsare. Det är hela installationen — filen är
fristående och kräver ingen server.

## Spelet

Fem banor. Varje bana ger dig en bricka med delar:

| Del | Vad den gör |
| --- | --- |
| Planka | 214 px lång ramp, låg friktion |
| Kort planka | 118 px — räcker till ett kort hopp |
| Studsmatta | Gummi, studstal 0,98: ger tillbaka nästan all fart |

Dra en del från hyllan ut på brädan, tryck på den för att markera den, dra i den
orange ratten för att vrida (snäpper till 5°) och kryssen för att ta bort den.
Utplacerade delar sitter fast — de är nålade i väggen, inte lösa föremål.

Efter ett misslyckat försök ligger kulans bana kvar som en blek pricklinje, så
man ser var det gick fel. Klarad bana låser upp nästa; framstegen sparas i
`localStorage`.

## Så är det byggt

Allt ligger i `index.html`: markup, stilar, banor och spellogik. Fysiken är
[Matter.js](https://brm.io/matter-js/) 0.20.0 (MIT), **inbakad i filen** istället
för hämtad från ett CDN — spelet ska fungera från en dubbelklickad fil och i
sammanhang där externa skript inte går att nå. Enda externa referensen som är
kvar är typsnitten från Google Fonts, och de har riktiga reservtypsnitt.

Två detaljer i fysiken är värda att känna till innan man ändrar:

- **Fast tidssteg med två delsteg per bildruta, plus en fartspärr på kulan.**
  Utan spärren kan en snabb kula hoppa rakt igenom en 16 px tunn planka mellan
  två steg. Spärren är det som gör banorna reproducerbara.
- **Kulan når ungefär lika långt i sidled som den faller.** Ungefär 0,7 px
  sidled per px fall, efter friktion och fartspärr. En bana där kulan ska ta sig
  400 px åt höger utan att falla lika mycket är inte svår — den är omöjlig.

### Banformatet

```js
{
  name, hint,
  spawn: { x, y },        // där lådan släpper kulan
  fixed: [ { x, y, w, h, a } ],   // plywood som redan sitter på väggen
  cup:   { x, y },        // koppens mitt vid basen; basketplanket ritas med den
  stars: [ { x, y } ],
  tray:  { plank: 1 },    // vad spelaren får bygga med
  solution: [ { type, x, y, a } ]  // en bekräftat fungerande lösning
}
```

Sista fältet i `fixed` är banans **ränna**: den sluttande plankan som fångar upp
kulan och rullar den in i koppen. Rännans övre ände är i praktiken banans
grind — pusslet är att få kulan dit.

## Banorna är verifierade, inte gissade

Varje `solution` är hittad genom att köra fysiken headless: en beam-sökning som
provar placeringar steg för steg och styr mot rännan. Bara lösningar som faktiskt
vinner sparas — och de sparas avrundade till heltal, eftersom det är heltal som
hamnar i filen (avrundningen ändrade utfallet på en av banorna, så det spelar
roll). Stjärnorna läggs sedan på den del av banan spelaren själv formar: efter
att kulan lämnat sin fallinje, före rännan. En stjärna på rännan hade varje
lösning tagit gratis.

```
npm install
npm test          # spelar upp varje bana genom gränssnittet
```

Testet kräver att alla fem banor slutar med "Klart!" och att ingen av dem går att
klara med tom bricka. Har du ingen webbläsare via Playwright, peka ut en egen med
`CHROMIUM_PATH=/sökväg/till/chrome npm test`.

### Lägga till en bana

1. Skriv geometrin (`spawn`, `fixed`, `cup`, `tray`) i `LEVELS`.
2. Hitta en lösning. `window.__kulbanan.simulate(banIndex, delar)` kör en bana
   headless och svarar `win`, `fell`, `stall`, `cup-missing-stars` eller
   `timeout` — samma funktion som sökningen använde.
3. Lägg stjärnorna på den funna banan, sätt in lösningen som `solution` och kör
   `npm test`.

`window.__kulbanan.applySolution()` bygger den sparade lösningen åt dig i
gränssnittet — bekvämt vid felsökning, och det är så testet spelar banorna.
