# svk-kbok-enhancements

Userscripts för Kbok, Svenska kyrkans kyrkobokföringssystem. Samma
upplägg som [svk-kob-enhancements](https://github.com/armandur/svk-kob-enhancements).

Kbok är en webbklient som ersätter en desktopklient. En del moment som
satt i muskelminnet från den gamla klienten gör mer motstånd i webben, och
några av gränssnittets fällor kostar tid varje gång man går i dem. Det här
repot samlar små tillägg som jämnar ut det.

## Skript

| Fil | Vad det gör | Status |
| --- | --- | --- |
| `svk-kbok-enhancements.js` | Auto-hämtar personuppgifter när ett komplett personnummer skrivits i ett relationspersonfält | Otestat i Tampermonkey |

## Kartlagda fällor

Underlaget kommer från arbetet med användarmanualen 2026-07-25 till
2026-07-28, där hela systemet gicks igenom flöde för flöde i
Utbildningsmiljön. Fällorna nedan är alltså inte hypoteser - de kostade
tid på riktigt under kartläggningen.

### 1. Hämta-ikonen som måste klickas (åtgärdad i skriptet)

Relationspersonfälten har en egen, **namnlös** ikonknapp bredvid
personnummerfältet. Att bara skriva in personnumret hämtar ingenting -
namnet förblir tomt, och felet upptäcks först när något annat går fel
längre fram.

Bekräftade fält (id i DOM:en):

- `vardnadshavare1.persnr` och `vardnadshavare2.persnr` i Dop
- Relationsperson i Begravning (Make/maka eller Vårdnadshavare)
- Person 1 i det fristående pålysningsformuläret

Till skillnad från huvudsökningen, som har en tydlig knapp märkt
**Hämta**, och personuppgiftssektionen, som har **Hämta uppgifter igen**,
är relationspersonernas knapp bara en ikon.

Värst är pålysningsformuläret: saknas namnet ger **Spara ingen
återkoppling alls**. Knappen ser aktiv ut, klicket registreras, och
ingenting händer - ingen dialog, ingen fältmarkering, ingen notis.

### 2. Hämta grupper uppdaterar inte listan automatiskt

I Konfirmationsgrupper räcker det inte att välja församling i droplistan -
listan uppdateras först när man klickar **Hämta grupper**. Byter man
församling utan att klicka står de gamla grupperna kvar och ser ut som den
nya församlingens. Verifierat: efter byte från en församling med två
grupper till en utan visades fortfarande de två.

Kandidat för automatisering: klicka Hämta grupper automatiskt när
församlingsvalet ändras.

### 3. Adresskontroll bara i Dop

Verifikatet stoppas om adressen saknas i Dop, men går igenom i
Konfirmation, Vigsel, Välsignelse och Begravning - trots att postadress
och folkbokföringsadress ska registreras för varje kyrklig handling
enligt SvKB 2009:9, 3 kap.

Kandidat för automatisering: varna vid Spara när adressfältet är tomt,
oavsett handling. Notera att **Adress** och **Adress forts** ligger sida
vid sida och är lätta att förväxla - det är Adress som kontrolleras.

### 4. Snabbkommandon från desktopklienten

Den gamla klienten hade tangentbordsgenvägar som webben saknar. Vilka som
faktiskt användes i praktiken är inte kartlagt - det kräver att man frågar
dem som arbetat länge i desktopklienten.

## Ej utrett

- Vilka återkommande sökningar som är värda genvägar. Kräver att man ser
  hur arbetet faktiskt ser ut över en vecka, inte bara vilka funktioner
  som finns.
- Om samma fällor finns i desktopklienten. Adresskontrollens inkonsekvens
  gör det - den är alltså ett arv, inte något webben infört.

## Installation

Tampermonkey eller Greasemonkey, nytt skript, klistra in innehållet i
`svk-kbok-enhancements.js`. Skriptet är begränsat med `@match` till
Kbok-domänerna.
