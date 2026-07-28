# svk-kbok-enhancements

Userscripts för Kbok, Svenska kyrkans kyrkobokföringssystem. Samma
upplägg som [svk-kob-enhancements](https://github.com/armandur/svk-kob-enhancements).

Kbok är en webbklient som ersätter en desktopklient. En del moment som
satt i muskelminnet från den gamla klienten gör mer motstånd i webben, och
några av gränssnittets fällor kostar tid varje gång man går i dem. Det här
repot samlar små tillägg som jämnar ut det.

## Installera

Installationssidan kör på **http://ubuntu-ai:8003/** och har en knapp som
öppnar skriptet. Tampermonkey och Greasemonkey fångar automatiskt upp
filer som slutar på `.user.js` och visar sin egen installationsdialog.

## Vad skriptet gör

| Funktion | Beskrivning |
| --- | --- |
| Öppna i ny flik | Länkikon ↗ i varje rad i träfflistorna. Vanligt klick, mittenklick och högerklickmenyns Öppna i ny flik fungerar alla, eftersom ikonen är en riktig länk. Mittenklick var som helst på raden gör samma sak. |
| Auto-hämta relationsperson | Klickar den namnlösa Hämta-ikonen åt dig när ett komplett personnummer skrivits i ett relationspersonfält. |
| Hoppa över datumväljaren | Ger kalender- och klockknappen `tabindex="-1"`, så tabb går från datumfältet vidare i formuläret i stället för in i väljaren. |

Inställningarna nås via **kugghjulet i sidhuvudet** och sparas per
webbläsare i `localStorage`. Varje funktion går att stänga av var för sig.

Avataremenyn hade varit en naturligare plats för kugghjulet, men Kbok
bygger om den menyn varje gång den öppnas och en injicerad post försvinner
då direkt.

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

### 4. Kalenderknappen fångar tabb (åtgärdad i skriptet)

Datumfältens kalenderknapp har `tabindex="0"` och ligger mellan
datumfältet och nästa fält i tabbordningen. Den som skriver datum för hand
tabbar därför in i kalenderväljaren i stället för vidare i formuläret.
Samma sak gäller klockikonen vid tidsfälten.

### 5. Snabbkommandon från desktopklienten

Desktopklienten hade ett fyrtiotal kortkommandon, listade i gamla
Kbok-hjälpen avsnitt 12.7. Webben har inga. Nedan är de genomgångna mot
vad webbläsaren själv använder - det avgör vilka som går att återinföra.

**Lediga - ingen konflikt med webbläsaren**

| Kommando | Funktion i gamla Kbok |
| --- | --- |
| `Ctrl + Ä` | Ändra (öppna posten för redigering) |
| `Ctrl + Ö` | Töm alla fält |
| `Ctrl + M` | Ministerialboksperson |
| `Ctrl + Y` | Pålysning |
| `Ctrl + B` | Bekräfta verifikat |
| `F8` | Byt församling |
| `D` i ett datumfält | Fyller i dagens datum |
| `Enter` | Öppnar markerad rad i träfflista |

`D` i datumfält och `Enter` på markerad rad är de billigaste att införa
och de som sannolikt används oftast. `Ctrl + Ä` och `Ctrl + Ö` ligger på
svenska tangenter som ingen webbläsare rör.

**Kräver att webbläsarens egen funktion blockeras**

| Kommando | Funktion | Webbläsaren gör annars |
| --- | --- | --- |
| `Ctrl + S` | Spara | Spara sidan |
| `Ctrl + N` | Ny | Nytt fönster |
| `Ctrl + K` | Starta sökning | Fokus till sökfältet |

`Ctrl + S` är det mest värdefulla i hela listan och det enda där det är
värt att ta över tangenten. Övriga två är tveksamma.

**Bör inte återinföras**

`Ctrl + W` (visa verifikat) stänger fliken, `Ctrl + T` (byt funktionstyp)
öppnar ny flik, `Ctrl + R` (skapa konfirmation) laddar om sidan och
`Ctrl + L` (lås applikationen) hoppar till adressfältet. Att kapa dem
skulle ge en användare som tror sig göra något annat en obehaglig
överraskning. `Ctrl + U`, `Ctrl + I` och `Ctrl + D` krockar med källkod,
utvecklarverktyg respektive bokmärken.

**Inte längre tillämpliga**

`F1` (hjälp) är märkt Windowsklient redan i gamla hjälpen. `F10`
(aktivera menyraden) förutsätter en menyrad som webben inte har.
`Ctrl + Home/End` och `Ctrl + pilar` bläddrade mellan detaljbilder, ett
navigeringsmönster webben inte använder. `Ctrl + C`, `Ctrl + V`, `F5`,
`Alt + F4` och `Ctrl + Tab` gör redan rätt sak av sig själva.

Vad som faktiskt användes i praktiken är fortfarande okänt - listan säger
vad som fanns, inte vad folk tryckte på. Värt att fråga någon som arbetat
länge i desktopklienten innan något byggs.

## Ej utrett

- Vilka återkommande sökningar som är värda genvägar. Kräver att man ser
  hur arbetet faktiskt ser ut över en vecka, inte bara vilka funktioner
  som finns.
- Om samma fällor finns i desktopklienten. Adresskontrollens inkonsekvens
  gör det - den är alltså ett arv, inte något webben infört.

## Servern

`serve.py` renderar README och serverar skriptet med rätt Content-Type.
Ren stdlib, ingen pip. Startas med `python3 serve.py [port]` och är
registrerad i portalen som `svk-kbok-enhancements`.

Skriptet är begränsat med `@match` till Kbok-domänerna. Produktionsadressen
`kbok.svenskakyrkan.se` är en gissning efter mönstret från
`kob.svenskakyrkan.se` och behöver bekräftas.
