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
| Öppna i ny flik | Länkikon i varje rad i personlistorna. Vanligt klick, mittenklick och högerklickmenyns Öppna i ny flik fungerar alla, eftersom ikonen är en riktig länk. Mittenklick var som helst på raden gör samma sak. Se nedan om vilka listor som räknas. | På |
| Auto-hämta person | Klickar Hämta åt dig så fort ett komplett personnummer skrivits eller klistrats in i ett personnummerfält - relationspersoner och Inträde. Se nedan. | På |
| Hoppa över datumväljaren | Ger kalender- och klockknappen `tabindex="-1"`, så tabb går från datumfältet vidare i formuläret i stället för in i väljaren. | På |
| Markerbart personnummer | Gör PERSNR-cellen markerbar så numret går att dra över och kopiera. Griden fångar annars klicket och öppnar posten. | På |
| D för dagens datum | `D` i ett tomt datumfält fyller i dagens datum, som i desktopklienten. Formatet läses ur fältets placeholder - dödsdatum vill ha ÅÅÅÅMMDD, övriga ÅÅÅÅ-MM-DD. | På |
| Filnamn på blanketter | Döper nedladdade blanketter och bevis efter handlingsdatum, typ och namn i stället för bara typen. Se nedan. | På |
| Minns miljövalet | Fyller i senast valda miljön i Utbildningsmiljön, så den inte behöver väljas om i varje ny flik. Se nedan. | På |
| Visa blanketten i stället | Visar PDF:en i en ruta med Skriv ut och Ladda ner, i stället för att ladda ner den direkt. Se nedan. | **Av** |
| Adress krävs för verifikat | Stoppar **Skapa verifikat** när adressen saknas i konfirmation, vigsel, välsignelse eller begravning. Se nedan. | På |
| Tomt pålysningsdatum | Låter bli att förifylla nästa söndag, så datumet skrivs in själv. Desktopklienten lät en välja. Valideringsfelet döljs tills fältet rörts, se nedan. | **Av** |
| Tangentbordsgenvägar | Se nedan. Varje genväg går att spela in på nytt i inställningarna. | På |
| Fokus på Bekräfta verifikat | Sätter fokus på knappen när verifikatdialogen öppnas, så Enter bekräftar - som i desktopklienten. | **Av** |

Panelen grupperar inställningarna efter var de märks - Träfflistor,
Formulär, Blanketter och rapporter, Utbildningsmiljön - i stället för att
lägga dem i en enda lista. Genvägsbrytaren sitter vid genvägsrubriken där
den hör hemma, och fokusinställningen står sist under **Går inte att
ångra**. Panelen har egen scroll; med alla grupper utfällda blir den högre
än en mobilskärm.

Fokusinställningen är avstängd med flit: att bekräfta ett verifikat är
slutregistrering och går inte att ångra, så en fokuserad knapp plus ett
reflexmässigt Enter vore en obehaglig kombination. Att dialogen saknar
tangentfokus över huvud taget är fångat som en möjlig avvikelse i
kbok-web TASK-510.

### Om miljövalet i Utbildningsmiljön

Utbildningsmiljön låter en välja instans på `/utv_selectDb` efter
inloggningen. Valet ligger i serversessionen, inte i fliken, och att öppna
en länk i en ny flik nollställer det - för **båda** flikarna, eftersom
sessionen är gemensam. Det räcker alltså att klistra in en länk till en
personakt i en ny flik för att bli utsparkad till miljövalet på två
ställen.

Verifierat: en ny flik mot `/personakt/<id>` landar på miljövalet, och den
ursprungliga fliken gör det också vid nästa sidladdning. Sessionen bärs av
en enda cookie; `localStorage` och `sessionStorage` är tomma.

Värre än så: **varje full sidladdning** kräver nytt miljöval, inte bara
nya flikar. Valet överlever bara navigering inne i appen. En inklistrad
länk, en ny flik eller ett F5 kastar alltid ut en.

Skriptet kommer ihåg vad som valdes senast och fyller i det igen. Första
gången väljer man själv - då lär sig skriptet valet. Sidan finns bara i
Utbildningsmiljön, så inget av det här rör produktionen.

Adressen man var på väg till tas också med. Omdirigeringen görs av appen,
inte av servern - begäran om `/personakt/<id>` besvaras med `200` och
appen byter sedan sida - så den ursprungliga adressen ligger kvar i
navigeringsposten och går att läsa, även för en länk som klistrats in för
hand. Målet sparas i `sessionStorage` (per flik, så två flikar på väg till
olika personakter inte tar varandras) och nås efter miljövalet.

Den sista navigeringen måste gå via routern med `pushState` plus
`popstate`, inte via `location.href`: en full sidladdning hade nollställt
miljövalet igen och gett en rundgång mellan de två sidorna tills sessionen
dog. Spärren mot det bär målet och släpps först när navigeringen bevisligen
kommit fram - en spärr som låg kvar gällde hela fliken, och då landade ett
F5 på en undersida alltid på startsidan i stället för tillbaka.

Miljövalet självt går inte att kringgå. Valet görs av anropet
`UtbSelectDbServer/SwitchEnhetForUser?dataBaseName=Harnosand`, och det går
att anropa direkt - det svarar `200` - men nästa sidladdning kräver ändå
omval. Att i stället navigera vidare klientsidan från miljövalssidan
fungerar inte heller: den ligger utanför appens router. Kvar blir att fylla
i valet åt användaren, vilket är vad skriptet gör.

Detta är ett plåster, inte en lösning: orsaken sitter i Kbok och är
rapporterad som kbok-web TASK-520.

En detalj värd att minnas: MUI:s `Select` öppnar listan på `mousedown`,
inte på `click`. Ett vanligt `element.click()` gjorde ingenting alls och
listan förblev tom.

### Om vilka listor som får länkikonen

Alla träfflistor är samma sorts DataGrid och bär `data-id` på raden, men
id:t betyder olika saker. I personlistorna är det personaktens id, i
startsidans verifikatlistor verifikatets, och under Alla församlingar
församlingens. En länk byggd på fel id pekar på en personakt som inte
finns.

Uppdelningen ser ut så här:

| Lista | data-id | Betyder |
| --- | --- | --- |
| Sök personer | `21070` | personaktens id |
| Ministerialbok | `4318026` | blankettnumret |
| Verifikat | `27708792` | verifikatets id |
| Alla församlingar | `21` | församlingens id |

Kolumnernas `data-field` skiljer dem åt: Sök personer använder versaler
(`PERSNR`, `NAMN`), Ministerialboken och Pålysningsboken gemener
(`personnummer`, `namn`). `PERSNR` betyder att radens id går att länka
rakt av.

För Ministerialboken finns personaktens id ändå - bara inte i DOM:en.
Listans API-svar bär `personid` för varje post, sida vid sida med det
`kyrklighandlingsId` som blir radens `data-id`:

```json
{"namn": "Svensson, Roger", "personid": 21068, "kyrklighandlingsId": 4318026}
```

Skriptet fångar därför svaren när de passerar och parar ihop dem med
raderna. Appen hämtar med `XMLHttpRequest`, inte `fetch`, så patchen
sitter där, och bara på `SearchMinisterialbok` - andra sökanrop
(`FetchVerifikatBySearchlist`, `SearchKyrkoperson`) returnerar också
`paginatedResults` men med andra id-rymder.

Av samma skäl körs skriptet med `@run-at document-start`: kommer patchen
efter appens första anrop har svaret redan passerat, och raderna får ingen
ikon förrän användaren söker om. Verifierat - pålagt efter listladdningen
blev det 0 ikoner, och 12 först efter en ny sökning.

I Ministerialboken öppnar länken **ministerialboksposten**, inte bara
personakten - samma vy som appens eget dubbelklick. Handlingstypens kod
finns i samma API-svar och styr vilken:

| Kod | Handlingstyp | Vy |
| --- | --- | --- |
| `D` | Dop | `/personakt/<id>/dop` |
| `K` | Konfirmation | `/personakt/<id>/konf` |
| `B` | Begravning | `/personakt/<id>/begravning` |
| `V` | Vigsel och välsignelse | `/personakt/<id>/vigsel?kyrklighandlingsId=<handlingens id>` |

Välsignelse har också kod `V` och samma vy - den lagras som en vigsel.
Vigsel och välsignelse gäller två personer och delar vy, så handlingens id
måste med i frågesträngen för att rätt post ska öppnas.

Verifierat mot alla fem typerna, i Utbildningsmiljön och testmiljön (som är enda
miljön med en välsignelsepost). I Sök personer går länken fortfarande till
personakten - där finns ingen handling att öppna - och ikonens
hjälptext följer med.

Verifierat att länken pekar dit appens eget dubbelklick går, i både
Ministerialboken och Sök personer. Startsidans tre verifikatflikar får
ingen ikon alls - där finns inget personakt-id att bygga av.

### Om adresskravet

Kbok stoppar verifikatet om adressen saknas i **Dop**, men släpper igenom
Konfirmation, Vigsel, Välsignelse och Begravning - trots att postadress och
folkbokföringsadress ska registreras för varje kyrklig handling enligt
SvKB 2009:9, 3 kap.

Skriptet stoppar **Skapa verifikat** i de fyra övriga. Den preliminära
posten får skapas som vanligt; det är verifikatet som hålls tillbaka. Det
speglar hur dopet redan fungerar - att blockera Spara hade hindrat själva
registreringen, vilket är ett större ingrepp än Kbok själv gör.

Adressen visas som en sektion med rubriken `Adress vid <handling>` i ett
`h6`, följd av gatuadress och postort. Saknas adressen står rubriken ensam,
och det är hela signalen:

```
med adress:  ['Adress vid begravning', 'Bagarfruv 126', '46290 Hjortnäs']
utan:        ['Adress vid dop']
```

Postnumret och orten står kvar även när gatuadressen tagits bort, och det är
gatuadressen Kbok kontrollerar - fältet **Adress**. En sektion som bara
innehåller `['Adress vid vigsel', '46230 Hjortnäs']` saknar alltså adress,
trots att den har mer än rubriken.

Varningen visas som en ruta, inte som text vid fältet, så att de fyra
handlingarna beter sig som dopet: Kbok stoppar där med **"Kan inte skapa
verifikat - Adress måste anges"**. Vid vigsel och välsignelse säger rutan
"för båda personerna" när ingen av dem har adress.

Hur djupt adressen ligger under rubriken varierar: i vigsel sitter den i
rubrikens egen förälder, i begravning fyra nivåer upp. Sökningen går därför
uppåt tills den hittar mer än rubriken, men stannar så fort
personuppgifterna omkring börjar synas - annars skulle de räknas som adress,
vilket gjorde att vigseln aldrig spärrades i första versionen.

Dop undantas - där gör Kbok redan kontrollen, och två varningar om samma sak
vore bara förvirrande. Att kontrollen sitter på Skapa verifikat gör dessutom
att den aldrig kan träffa personakten, som inte har någon sådan knapp.

Går adressen av något skäl inte att fylla i får inställningen stängas av;
skriptet kan inte veta om det finns ett giltigt skäl att lämna den tom.

### Om fokus i datumfältet

In- och utträde är annars helt tangentbordsdrivna ända fram till datumet:
skriv personnumret, personen hämtas, och sedan måste man ta musen.

Skriptet flyttar därför fokus till datumfältet så fort det finns. Vid
utträde ligger fältet på plats redan när `/uttrade` laddat. Vid inträde
dyker `Inträdesdatum` upp först när personen hämtats - och det spelar ingen
roll om hämtningen skedde av sig själv eller för att man klickade **Hämta**;
det är fältets ankomst som räknas, inte vägen dit. Verifierat i båda lägen.

Fokus flyttas en gång per fält, och bara från lägen där det är fokus man
vill lämna: ingenting alls, Hämta-knappen, eller personnummerfältet som just
gjort sitt. Står markören redan i ett annat fält lämnas den i fred.

### Om auto-hämtningen

Gäller alla personnummerfält med en hämtningsknapp: relationspersonfälten
i handlingarna och personnummerfältet på Inträde. Hämtningen sker när
numret blir komplett, oavsett om det skrivits eller klistrats in.

Två knappar klickas aldrig automatiskt, trots att de sitter närmast
fältet i sina vyer: **Sök** på startsidan, som navigerar iväg, och
**Hämta uppgifter igen från folkbokföringen** på en öppnad handling, som
skriver över redigerade uppgifter.

Inte heller MUI:s kryssknapp, som läggs inuti fältet så fort det har ett
värde - alltså precis när hämtningen ska gå igång. Att den låg närmare
fältet än Hämta gjorde att den klickades i stället, vilket rensade
personnumret utan att hämta någon. Det syntes tydligast på Inträde, där
fältet tömdes och inget namn kom fram (rättat i 0.9).

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

Bekräftar man ett verifikat senare - via Aktuella på startsidan i stället
för direkt när det skapas - finns ingen personakt bakom att läsa namnet ur.
Verifikatet visar det självt, men sammanskrivet som `Per Persson` i stället
för uppdelat i fält, och då blir filnamnet
`Utträdesbevis - Per Persson.pdf`. Att dela strängen går inte att göra
rätt, och fallet är ett undantag.

Verifikatet bär också ett **Händelsedatum**, och det läggs först i
filnamnet när det finns - det är ju den händelse beviset gäller. Fältet
finns på in- och utträdesverifikat men inte på alla typer; saknas det utgår
datumdelen som förut.

Bevisen ligger i personaktens Rapporter-meny, som har 29 poster mot
handlingspostens fem. Bara de som står i listan ovan döps om - övriga
rapporter, som Medlemsbevis och Registerutdrag, lämnas som de är.

Bevisen finns i två varianter, med och utan adress. Varianten säger inget
om vad beviset gäller, bara hur det är utformat, så båda får grundnamnet:

```
Upptagandebevis             ->  Upptagandebevis - Persson, Emil.pdf
Upptagandebevis med adress  ->  Upptagandebevis - Persson, Emil.pdf
Utträdesbevis               ->  Utträdesbevis - Persson, Emil.pdf
Utträdesbevis med adress    ->  Utträdesbevis - Persson, Emil.pdf
```

Kboks egen term behålls - `Upptagandebevis`, inte Inträdesbevis.

Verifierat genom injektion: Dop, Konfirmation, Vigsel och Begravning samt
bevisen i Utbildningsmiljön, Välsignelse och gruppblanketten i testmiljön (som är
enda miljön med en välsignelsepost och en konfirmationsgrupp med
innehåll). Dopposten saknade personakt och hade tom topprad - namnet lästes
då ur sektionen, som avsett.

Snedstrecken är bekräftade i skarpt läge: en person utan förnamn har
`Förnamn` och `Tilltalsnamn` satta till `-` och `/Efternamn/` i
efternamnsfältet, och beviset fick namnet `Upptagandebevis -
-Efternamn-.pdf`. Ett efternamn utan förnamn men utan snedstreck
fungerar också - då blir det bara efternamnet, utan hängande komma.

Ett genomfört utträde visar först "Utträde är nu slutfört" och därefter
en modal med rubriken **Rapporter**, där Utträdesbevis ligger. Den vyn
visar namnet som löpande text - "Örjan Persson" följt av "Tilltalsnamn:
Örjan" - utan de fältetiketter resten av appen använder, och en sådan
sträng går inte att dela i förnamn och efternamn med säkerhet. Namnet tas
därför med från personakten, som är enda vägen in i utträdet, tillsammans
med personnumret så att en kvarglömd post inte kan sätta fel namn på
någon annans bevis.

### Om visningsrutan

Kbok laddar ner blanketten direkt när den väljs i Rapporter-menyn. Den
som bara vill läsa eller skriva ut får då en fil att städa bort efteråt.

Med inställningen på visas PDF:en i stället i en ruta ovanpå Kbok, med
tre val: **Skriv ut**, **Ladda ner** och **Stäng**. Escape och klick
utanför stänger också.

Att i stället öppna blob-URL:en i en ny flik hade varit mindre kod, men
webbläsarens Spara som föreslår då blob-URL:ens GUID som filnamn - alltså
precis det filnamnsbytet ovan finns till för att undvika. Av samma skäl
döljs webbläsarens egen verktygsrad i PDF-visaren med `#toolbar=0`; dess
nedladdningsknapp har samma problem. Zoom fungerar ändå med Ctrl och
scrollhjulet.

Rapporter-popupen har en växel högst upp mellan **PDF** och **kalkylblad**,
och den gäller alla rapporter i listan. Kalkylblad visas som en tabell i
samma ruta, med samma Skriv ut och Ladda ner.

Webbläsaren kan inte rendera xlsx i en iframe - den laddar ner filen i
stället, utan `download`-attribut, så den får blob-URL:ens GUID som namn.
Formatet är däremot en zip med XML och går att packa upp med
`DecompressionStream`, utan extern modul. Kboks kalkylblad är enkla:
strängarna ligger inline i cellerna, det finns ingen `sharedStrings.xml`,
och arket är ett - tolkningen behöver bara läsa
`xl/worksheets/sheet1.xml`.

Går kalkylbladet inte att läsa laddas det ner i stället, liksom allt annat
som varken är PDF eller xlsx.

Rutan hämtar en egen kopia av blobben med `fetch` innan den visas. Appen
tar bort länken direkt efter klicket och kan återkalla sin blob-URL, och
då hade ramen visat en tom sida. Går blobben inte att läsa laddas filen
ner som vanligt i stället - ett klick ska aldrig bara försvinna.

### Genvägar

| Tangent | Gör | I gamla Kbok |
| --- | --- | --- |
| `Ctrl + S` | Spara | `Ctrl + S` - blockerar webbläsarens Spara sidan |
| `Ctrl + Ö` | Skapa verifikat | `Ctrl + W`, som i webbläsaren stänger fliken |
| `Ctrl + U` | Utträde | `Ctrl + U` - blockerar webbläsarens Visa källkod |
| `F8` | Byt församling | `F8` |
| `F9` | Blankett för handlingen man står i | Fanns inte |
| `Ctrl + B` | **Bekräfta verifikat** - slutregistrering, går inte att ångra | Fanns inte |

`F9` hämtar blanketten för den handling man står i, utan att gå via
Rapporter-menyn. Den valda fliken bär handlingens namn med `bok` på slutet -
Dopbok, Vigselbok, Begravningsbok - och blanketten heter samma sak med
`blankett` i stället. Det gör att vigsel och välsignelse går att skilja åt
trots att de delar URL: fliken heter `Vigselbok` respektive
`Välsignelsebok`.

Blanketten hämtas genom att öppna menyn och klicka posten, alltså samma väg
som för hand - filnamnsbytet och visningsrutan gäller därför utan att
genvägen behöver känna till dem. Står man på Personakt-fliken händer
ingenting; den har ingen blankett.

`Ctrl + B` är den enda genvägen som gör något oåterkalleligt. De övriga går
att backa - ett verifikat kan avvisas, ett formulär stängas - men en
bekräftelse är slutregistrering. Den är därför markerad i panelen, på samma
sätt som fokusinställningen.

Den fungerar för alla verifikat som går att bekräfta, inte bara utträden:
knappen heter "Bekräfta verifikat" överallt där den finns. Verifierat på
dopregistrering och beslutsunderlag; verifikattyper som bara ska läsas
(dödsfall, anteckning pga relation, meddelande om närmast anhörig) har
ingen sådan knapp och påverkas därför inte.

Testat att alla går att fånga i webbläsaren, inklusive `Ctrl + U`.
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
