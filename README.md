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

Servern ligger i hemnätet och når bara den som är där. För att dela
skriptet vidare är GitHub den naturliga vägen: `@updateURL` och
`@downloadURL` pekar redan på repots raw-adress, som börjar fungera så
snart repot är publicerat. GitHub Pages kan dessutom hosta README:n som en
riktig installationssida - Jekyll renderar den automatiskt, och länken till
`.user.js` fungerar likadant därifrån.

## Uppdateringar

Tampermonkey hämtar `@updateURL` med jämna mellanrum, jämför `@version` och
erbjuder uppdatering när numret höjts. Det kräver bara att versionsnumret
faktiskt räknas upp vid varje ändring.

Panelen visar dessutom vilken version som körs och har en länk **Sök efter
uppdatering**, som öppnar skriptet direkt så att tillägget visar sin dialog
utan att man behöver vänta på nästa automatiska kontroll.

## Vad skriptet gör

| Funktion | Beskrivning | Standard |
| --- | --- | --- |
| Öppna i ny flik | Länkikon ↗ i varje rad i träfflistorna. Vanligt klick, mittenklick och högerklickmenyns Öppna i ny flik fungerar alla, eftersom ikonen är en riktig länk. Mittenklick var som helst på raden gör samma sak. | På |
| Auto-hämta relationsperson | Klickar den namnlösa Hämta-ikonen åt dig när ett komplett personnummer skrivits i ett relationspersonfält. | På |
| Hoppa över datumväljaren | Ger kalender- och klockknappen `tabindex="-1"`, så tabb går från datumfältet vidare i formuläret i stället för in i väljaren. | På |
| Markerbart personnummer | Gör PERSNR-cellen markerbar så numret går att dra över och kopiera. Griden fångar annars klicket och öppnar posten. | På |
| D för dagens datum | `D` i ett tomt datumfält fyller i dagens datum, som i desktopklienten. Formatet läses ur fältets placeholder - dödsdatum vill ha ÅÅÅÅMMDD, övriga ÅÅÅÅ-MM-DD. | På |
| Filnamn på blanketter | Döper nedladdade blanketter och bevis efter handlingsdatum, typ och namn i stället för bara typen. Se nedan. | På |
| Tomt pålysningsdatum | Låter bli att förifylla nästa söndag, så datumet skrivs in själv. Desktopklienten lät en välja. Valideringsfelet döljs tills fältet rörts, se nedan. | **Av** |
| Tangentbordsgenvägar | Se nedan. Varje genväg går att spela in på nytt i inställningarna. | På |
| Fokus på Bekräfta verifikat | Sätter fokus på knappen när verifikatdialogen öppnas, så Enter bekräftar - som i desktopklienten. | **Av** |

Fokusinställningen är avstängd med flit: att bekräfta ett verifikat är
slutregistrering och går inte att ångra, så en fokuserad knapp plus ett
reflexmässigt Enter vore en obehaglig kombination. Att dialogen saknar
tangentfokus över huvud taget är fångat som en möjlig avvikelse i
kbok-web TASK-510.

### Om filnamnen på blanketter

Kbok döper varje nedladdad blankett till handlingstypen rakt av -
`Dopblankett.pdf`, `Upptagandebevis.pdf`. Sparar man flera går de inte
att skilja åt, och webbläsaren räknar upp dem som `(1)`, `(2)`.

Skriptet döper i stället om dem:

```
2026-06-20 - Dopblankett - Ejtillhorig, Testfall.pdf
2024-09-01 - Vigselblankett - Larsson-Blomqvist.pdf
2026-05-24 - Konfirmationsblankett-gemensam - Torsdagsgruppen.pdf
Upptagandebevis - Ejtillhorig, Testfall.pdf
```

Vigsel och välsignelse gäller två personer, och där tas bara efternamnen
med. Bevisen får inget datum - de gäller en händelse som redan är
registrerad, till skillnad från blanketterna som är underlag inför en
handling.

Gruppblanketten heter `Konfirmationsblankett-gemensam` för att skilja den
från den enskilda: den listar hela urvalet med en avbockningskolumn, den
enskilda gäller en person. Den hämtas från **Skapa konfirmation**, en vy
som varken visar gruppnamnet eller har några personuppgifter att läsa -
URL:en bär bara ett GUID. Namnet plockas därför upp i gruppvyn på vägen
dit, som är enda sättet att nå formuläret, och sparas i `sessionStorage`
över sidbytet. Saknas det blir filnamnet bara datum och typ.

Namnet byggs av tilltalsnamn (annars förnamn) och efternamn, lästa ur
handlingspostens egna sektioner - inte ur personuppgiftsraden högst upp,
som är tom för poster utan personakt. Saknas handlingsdatum utgår den
delen. Ett barn utan förnamn får efternamnet skrivet som `/Efternamn/` i
Kbok, och snedstreck byts mot bindestreck eftersom de inte går att ha i
ett filnamn.

Går inget namn att bygga lämnas Kboks eget filnamn i fred.

PDF:en byggs i webbläsaren och laddas ner från en blob-URL: appen skapar
ett `<a download>`, klickar det och tar bort det direkt. Skriptet fångar
namnet genom att patcha `HTMLAnchorElement.prototype.click` och skriva om
attributet i klicket, innan originalanropet släpps igenom. Ingen
`Content-Disposition` och inget `GM_download` behövs.

### Genvägar

| Tangent | Gör | I gamla Kbok |
| --- | --- | --- |
| `Ctrl + S` | Spara | `Ctrl + S` - blockerar webbläsarens Spara sidan |
| `Ctrl + Ö` | Skapa verifikat | `Ctrl + W`, som i webbläsaren stänger fliken |
| `Ctrl + U` | Utträde | `Ctrl + U` - blockerar webbläsarens Visa källkod |
| `F8` | Byt församling | `F8` |

Testat att alla tre går att fånga i webbläsaren, inklusive `Ctrl + U`.
Klicka på en tangentkombination i inställningarna och tryck den nya du
vill ha - inspelningen läser nästa tangenttryck. Återställningspilen tar
tillbaka standardvärdet.

### Om valideringen vid tomt pålysningsdatum

Att tömma fältet utlöser "Pålysningsdatum måste anges" omedelbart, innan
användaren hunnit skriva något - formuläret ser trasigt ut från start.

Skriptet döljer därför felet **tills fältet rörts**. Så fort man skriver i
det eller lämnar det beter sig valideringen som vanligt igen, inklusive när
Spara vägrar. Tömningen görs med riktiga input- och change-händelser så att
appens eget tillstånd följer med - annars hade fältet sett tomt ut medan
det förifyllda datumet låg kvar internt och sparats i tysthet.

Verifierat i tre steg: vid öppning är fältet tomt och felet dolt, efter
egen inmatning finns inget fel alls, och rensar användaren själv fältet
visas felet som det ska.

### Ny flik fungerar inte i Utbildningsmiljön

`kbok-utbildning.svenskakyrkan.se` skickar varje ny flik till sin
miljöväljare, `/utv_selectDb`, i stället för till adressen som öppnades.
Det gäller både länkikonen och mittenklicket, och beror inte på skriptet -
miljön kräver ett databasval per flik.

Verifierat att det bara gäller den miljön: samma klick i testmiljön öppnar rätt
personakt direkt. Antagligen fungerar testmiljön och produktion som testmiljön, men det är
inte kontrollerat.

Inställningarna nås via **✚ Kbok Plus** i användarmenyn under avataren,
tillsammans med Byt församling och Inställningar. Posten klonas från Kboks
egen Inställningar-post, så den ärver appens formatering i stället för att
härma den. Menyn byggs om vid varje öppning, så posten läggs till på nytt
av samma MutationObserver som sköter resten.

Inställningarna sparas per webbläsare i `localStorage`. Varje funktion går
att stänga av var för sig.

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

Desktopklienten hade ett fyrtiotal kortkommandon. Webben har inga.

#### Hela listan som den stod i gamla Kbok-hjälpen

Avsnitt 12.7, återgiven ordagrant. Två genvägar stod **utanför** tabellen
och är märkta med fotnot - de hade missats vid en snabb genomläsning.
`Ctrl + F` och `Ctrl + pilarna` står två gånger i originalet, med olika
betydelser; det är inte ett fel i återgivningen här.

| Kommando | Funktion |
| --- | --- |
| `Ctrl + K` | Starta sökning |
| `Ctrl + N` | Ny |
| `Ctrl + Ä` | Ändra |
| `Ctrl + O` | OK (utför) |
| `Ctrl + S` | Spara |
| `Ctrl + P` | Skriv ut |
| `Ctrl + D` | Skriver ut skärmens innehåll direkt |
| `Ctrl + Delete` | Ta bort |
| `Ctrl + Home` | Första detaljbild |
| `Ctrl + Vänsterpil` | Föregående detaljbild |
| `Ctrl + Högerpil` | Nästa detaljbild |
| `Ctrl + End` | Sista detaljbild |
| `Ctrl + Vänsterpil` | Föregående resultat (stora sökresultat) |
| `Ctrl + Högerpil` | Nästa resultat (stora sökresultat) |
| `Ctrl + F` | Visa alla (stora sökresultat) |
| `Ctrl + W` | Visa verifikat |
| `Ctrl + B` | Bekräfta verifikat |
| `Ctrl + F` | Sök |
| `Ctrl + Ö` | Töm alla fält |
| `Ctrl + Y` | Pålysning |
| `Ctrl + I` | Inträde |
| `Ctrl + U` | Utträde |
| `Ctrl + C` | Kopiera |
| `Ctrl + V` | Klistra in |
| `Ctrl + M` | Ministerialboksperson |
| `Ctrl + A` | Markera alla rader i en lista |
| `Ctrl + T` | Byt funktionstyp |
| `Ctrl + L` | Låser Kbok och visar inloggningsbilden |
| `Ctrl + Tab`, `Ctrl + F6` | Bläddra mellan fönster i programmet |
| `Ctrl + R` | Skapa konfirmation |
| `Enter` | Utför olika händelser |
| `F1` | Hjälp, kontextberoende (Windowsklient) |
| `F5` | Uppdatera |
| `F8` | Byt församling |
| `F10` | Aktivera menyraden |
| `Alt + Nedåtpil` | Öppna rullgardinsmenyer och kalender |
| `Alt + F4` | Avsluta |
| `Ctrl + F4` | Stäng fönster |
| `Alt + Home` | Till Startsidan |
| (saknas) | Avancerad sökning |
| `D` eller `d` | Dagens datum när markören står i ett datumfält |
| (saknas) | Export av rapport |
| `F3` * | Senaste personer |
| `Ctrl + Z` * | Ångra i inmatningsfält |

\* Står inte i kortkommandotabellen. `F3` nämns i avsnittet om Senaste
personer, `Ctrl + Z` i avsnittet om kopiering mellan fält.

Hjälpen noterar också två undantag: kortkommandon fungerar inte i
textfältet för lokalt informationsverifikat, och `Ctrl + P` fungerar inte
när en rapport visas i förhandsgranskningsläge.

Och om Enter, som generellt kommando: *"ENTER kan användas i stället för
[OK] samt för att öppna markerad rad i en träfflista. Även i dialogrutor
kan ENTER ersätta OK-knappen eller annan funktion som är framhävd."*

#### Vad som går att återinföra i webben

**Lediga - ingen konflikt med webbläsaren**

`Ctrl + Ä`, `Ctrl + Ö`, `Ctrl + M`, `Ctrl + Y`, `Ctrl + B`, `F2`, `F3`,
`F8`, `F9`, samt `D` i datumfält och `Enter` på markerad rad.

**Kräver att webbläsarens egen funktion blockeras**

`Ctrl + S` är införd och tar över webbläsarens Spara sidan - det är den
mest använda genvägen i listan. `Ctrl + N` och `Ctrl + K` är tveksamma och
inte införda.

**Bör inte återinföras på sin gamla tangent**

`Ctrl + W` stänger fliken, `Ctrl + T` öppnar ny flik, `Ctrl + R` laddar om
sidan och `Ctrl + L` hoppar till adressfältet. `Ctrl + U`, `Ctrl + I` och
`Ctrl + D` krockar med källkod, utvecklarverktyg respektive bokmärken.
Funktionerna kan däremot flyttas till lediga tangenter - `Ctrl + W`
(skapa verifikat) ligger nu på `Ctrl + Ö`.

**Inte längre tillämpliga**

`F1` är märkt Windowsklient redan i gamla hjälpen. `F10` förutsätter en
menyrad webben inte har. `Ctrl + Home/End` och `Ctrl + pilarna` bläddrade
mellan detaljbilder, ett navigeringsmönster webben inte använder.
`Ctrl + C`, `Ctrl + V`, `Ctrl + Z`, `F5`, `Alt + F4` och `Ctrl + Tab` gör
redan rätt sak av sig själva.

Vad som faktiskt användes i praktiken är fortfarande okänt - listan säger
vad som fanns, inte vad folk tryckte på.

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
