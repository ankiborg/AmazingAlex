# Kulbanan

Ett fysikpussel av Rube Goldberg-typ — samma genre som Rovios *Amazing Alex*,
*The Incredible Machine* och *Casey's Contraptions*. Du nålar fast plankor på en
pegboard, trycker på **Spela**, och fysiken avgör resten: kulan ska ta alla
stjärnor innan den landar i koppen.

Öppna `index.html` i en webbläsare. Det är hela installationen — filen är
fristående och kräver ingen server.

## Spelet

Fjorton banor i tre kapitel:

| Kapitel | Banor | Vad de handlar om |
| --- | --- | --- |
| Grunderna | 1–4 | Plankor: lutning, räckvidd, kedjor av hopp |
| Verktygen | 5–8 | Studsmatta, tratt, fläkt och vippa, ett i taget |
| Mästarbanorna | 9–14 | Flera verktyg samtidigt |

Varje bana ger dig en bricka med delar:

| Del | Vad den gör |
| --- | --- |
| Planka | 214 px lång ramp, låg friktion |
| Kort planka | 118 px — räcker till ett kort hopp |
| Studsmatta | Gummi, studstal 0,98: ger tillbaka nästan all fart |
| Tratt | Två armar i en V-form: fångar brett, släpper smalt — två ytor på en plats i brickan |
| Fläkt | Blåser längs sin egen uppåtriktning, 190 px långt. Kraften avtar med avståndet och verkar bara i en smal ström — utanför den märks den inte alls |
| Vippa | Planka på en tapp. Den söker sitt eget läge så fort kulan lägger sig på ena änden |

Dra en del från hyllan ut på brädan, tryck på den för att markera den, dra i den
orange ratten för att vrida (snäpper till 5°) och kryssen för att ta bort den.
Utplacerade delar sitter fast — de är nålade i väggen, inte lösa föremål.

En del får inte sitta inuti fast plywood, koppen, lådan eller en annan del. En
sådan lyser röd och **Spela** är avstängd tills den flyttats — annars hade
spelaren kunnat bygga lägen fysiken inte kan svara vettigt på.

Räknaren uppe till höger visar hur många av spelets stjärnor som är hämtade.
Klarade banor märks med en mässingsprick i banväljaren, och eftersom det är
*vilka* banor som är klarade som sparas — inte bara hur långt man kommit —
stämmer räkningen även när man hoppar tillbaka och spelar om en gammal bana.

Efter ett misslyckat försök ligger kulans bana kvar som en blek pricklinje, så
man ser var det gick fel. Efter tre misslyckade försök erbjuds en ledtråd som
ritar var lösningens *första* del ska sitta — resten får man klura ut själv.
Klarad bana låser upp nästa; framstegen sparas i `localStorage`.

### Tangentbord

Hela spelet går att klara utan pekdon, och `npm test` bevakar det.

| Tangent | Gör |
| --- | --- |
| <kbd>1</kbd>–<kbd>3</kbd> | Tar motsvarande del ur hyllan och lägger den mitt på brädan |
| Pilarna | Flyttar markerad del 6 px, med <kbd>Skift</kbd> 1 px |
| <kbd>,</kbd> <kbd>.</kbd> | Vrider 5° |
| <kbd>S</kbd> | Markerar nästa utplacerade del |
| <kbd>Delete</kbd> | Tar bort markerad del |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Ångrar senaste ändringen |
| <kbd>Enter</kbd> | Spelar · <kbd>R</kbd> börjar om · <kbd>M</kbd> ljud av/på |

### Ljud

Allt ljud är syntat med WebAudio — inga filer. Rullljudets volym följer kulans
fart, anslag låter olika hårt beroende på hur fort den slog i, och stjärnorna
klingar stigande för varje tagen i samma försök. Ljudkontexten skapas först vid
en riktig användargest, annars blockerar webbläsaren den ändå.

## På liten skärm

Brädan mäter själv hur mycket plats rubrik, uppgift och hylla tar och krymper
därefter, så att hyllan aldrig hamnar under skärmkanten — en hylla man inte ser
går inte att dra delar ifrån. Under 720 px flyttar banväljaren in i en
utfällbar knapp av samma skäl: fjorton knappar tar tre rader och halva brädan.

Filen sätter också sin egen `viewport`-meta om den saknas. Öppnad rakt av
utan den ritar en telefon sidan som om skärmen vore 980 px bred.

## Så är det byggt

Allt ligger i `index.html`: markup, stilar, banor och spellogik. Fysiken är
[Matter.js](https://brm.io/matter-js/) 0.20.0 (MIT), **inbakad i filen** istället
för hämtad från ett CDN — spelet ska fungera från en dubbelklickad fil och i
sammanhang där externa skript inte går att nå. Enda externa referensen som är
kvar är typsnitten från Google Fonts, och de har riktiga reservtypsnitt.

En del kan bestå av flera kroppar (tratten har två armar) och behöver inte
sitta fast (vippan hänger på en tapp). Byggläget kör alltid allt som fast
geometri så att lägeskontrollen blir meningsfull; först när man trycker
**Spela** byggs världen om med det som ska röra sig löst.

Tre detaljer i fysiken är värda att känna till innan man ändrar:

- **Fast tidssteg med två delsteg per bildruta, plus en fartspärr på kulan.**
  Utan spärren kan en snabb kula hoppa rakt igenom en 16 px tunn planka mellan
  två steg. Spärren är det som gör banorna reproducerbara.
- **Kulan når ungefär lika långt i sidled som den faller.** Ungefär 0,7 px
  sidled per px fall, efter friktion och fartspärr. En bana där kulan ska ta sig
  400 px åt höger utan att falla lika mycket är inte svår — den är omöjlig.
  Fläkten är undantaget: den bär kulan uppåt och i sidled utan att den tappar
  höjd, och är därför det enda som klarar ett långt språng åt sidan.
- **En ramp under ~8° håller inte kulan i rullning.** Friktionen tar den och
  försöket slutar med "Kulan stannade". Lutar man en hylla ska den luta ordentligt.

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

Testet kräver att

- alla fjorton banor slutar med "Klart!",
- ingen bricka innehåller en del som lösningen inte använder,
- ingen bana går att klara med tom bricka,
- ingen sparad lösning lägger en del i vägen för fast geometri,
- bana 1 går att bygga **för hand** med mus, på surfplatta och på mobil, och
- bana 1 går att bygga **enbart från tangentbordet**.

Har du ingen webbläsare via Playwright, peka ut en egen med
`CHROMIUM_PATH=/sökväg/till/chrome npm test`.

En fallgrop värd att känna till: handtesterna måste köra i förgrunden.
Bakgrundsflikar får sin `requestAnimationFrame` strypt, och spelets fysik går i
takt med den — testet hänger annars i väntan på en kula som knappt rör sig.

### Mäta banorna

```
node tools/audit.mjs
```

Ställer tre frågor per bana: behövs varje del i lösningen, hur stor andel av
slumpmässiga bygg som vinner (lösningsutrymmets storlek), och går banan att
klara utan att bygga något. Siffrorna är inte betyg — en svår bana får vara
trång — men de visar när en bana är trång *av misstag*.

Granskningen är också vad som avslöjade att tre brickor delade ut delar ingen
lösning rörde, och att fyra lösningar bar på en del de inte behövde.

En sak den lärde ut som är värd att ha med sig: **i en deterministisk
simulering kan ett sikthjälpmedel aldrig bli nödvändigt.** Tratten gör det
lättare för en människa att träffa en smal springa, men en tillräckligt exakt
plankvinkel gör samma sak. Trattens verkliga värde är att den är två ytor på
en plats i brickan. Banor byggs därför inte på att tratten ska vara *tvingande*
— det går inte — utan på att den ska vara det självklara valet.

### Lägga till en bana

1. Skriv geometrin (`spawn`, `fixed`, `cup`, `tray`) i `LEVELS`. Sista posten i
   `fixed` ska vara rännan.
2. Låt sökningen leta en lösning:

   ```
   node tools/search.mjs 5              # bana 6, nollindexerat
   node tools/search.mjs 5 --budget 40000
   ```

   Den skriver träffarna till `tools/solutions.json` och godtar bara
   placeringar spelet självt tillåter.
3. Lägg stjärnorna på den funna banan. Två regler gör skillnaden mellan en
   stjärna som betyder något och en som är gratis: den ska ligga **efter** att
   kulan lämnat sin fallinje och **före** rännan, och minst ~50 px från
   lösningens egna delar — annars göms den bakom en planka.
4. Sätt in lösningen som `solution` och kör `npm test`.

`window.__kulbanan.applySolution()` bygger den sparade lösningen åt dig i
gränssnittet — bekvämt vid felsökning, och det är så testet spelar banorna.
