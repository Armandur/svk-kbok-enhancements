# Backlog Export

## [P3][todo] [svk-kbok-enhancements] Byt namn på utskrivna blanketter till datum, handlingstyp och namn

Rasmus 2026-07-28. Gäller blanketterna för dop, konfirmation, vigsel, välsignelse och begravning som skrivs ut eller sparas.

ÖNSKAT FILNAMN

  Handlingsdatum - Dopblankett - Efternamn, Förnamn.pdf

Handlingstypen varierar: Dopblankett, Konfirmationsblankett, Vigselblankett, Välsignelseblankett, Begravningsblankett.

Vid vigsel och välsignelse gäller två personer, och då ska bägge efternamnen med: Efternamn-Efternamn.

SPECIALFALL SOM MÅSTE HANTERAS

1. Handlingsdatum saknas. Filnamnet ska fungera ändå - antagligen genom att hoppa över den delen och börja med handlingstypen.

2. Barn utan förnamn vid dop. Kbok skriver då efternamnet inom snedstreck, /Efternamn/. Snedstreck går inte att ha i ett filnamn på något operativsystem, så det måste bytas - Rasmus förslag är -Efternamn- i stället.

Värt att kontrollera om samma notation dyker upp i andra fall än dop.

ATT UNDERSÖKA FÖRST

Hur blanketten faktiskt levereras. Konfirmationsblanketten för en grupp laddades ner som Konfirmationsblankett_for_verksamhetsgrupp.pdf via en blob-URL, vilket betyder att filnamnet sätts av appen i ett download-attribut eller via Content-Disposition. Är det ett download-attribut på en länk går namnet att skriva om i DOM:en innan klicket. Kommer namnet från servern via Content-Disposition krävs i stället att skriptet fångar nedladdningen och sparar om den, vilket är betydligt mer omständligt och kan kräva @grant GM_download.

De enskilda handlingarnas blanketter kan levereras på ett annat sätt än gruppblanketten - kontrollera båda.

Klart när: blanketterna får det önskade namnet, med båda specialfallen hanterade.

- ID: `01KYNBRQ16KEAG34MQA2WMWC8X`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Tomt pålysningsdatum triggar valideringsfel - går det att undvika?

Rasmus 2026-07-28. Följdproblem till TASK-511.

PROBLEMET

Inställningen tomPalysningsdatum tömmer fältet Pålysningsdatum, som Kbok annars förifyller med nästa söndag. Men formuläret validerar fältet som obligatoriskt, så ett tomt fält markeras som fel - antagligen direkt vid tömningen, innan användaren hunnit skriva något.

Resultatet blir ett formulär som ser trasigt ut från början, vilket är sämre än det förifyllda datumet man ville bli av med.

ATT UNDERSÖKA

Sker valideringen vid blur, vid submit eller direkt när värdet ändras? Det avgör vad som går att göra.

Möjliga vägar, i ordning efter hur mycket de bråkar med appen:

1. Töm fältet utan att skicka de events som utlöser validering. Nuvarande kod skickar input och change via prototypens value-setter, vilket React uppfattar som en användarändring. Kanske räcker det att sätta value direkt utan events - men då kan Reacts interna state fortfarande innehålla det gamla datumet, och det förifyllda värdet sparas ändå.

2. Töm fältet och rensa felmarkeringen efteråt. MUI visar fel via klasserna Mui-error på fältet och en FormHelperText under. Att ta bort dem döljer symptomet men rör inte formulärets interna giltighet - Spara kan fortfarande vägra.

3. Låt fältet vara ifyllt men markera texten, så att första tangenttryckningen skriver över. Det ger samma praktiska effekt - man skriver sitt datum direkt - utan att formuläret hamnar i felläge. Troligen den minst bråkiga lösningen, men ändrar inställningens innebörd från 'töm' till 'markera'.

Om ingen väg fungerar rent är alternativet att ta bort inställningen igen och notera varför.

Klart när: antingen fungerar tömningen utan valideringsfel, eller så är inställningen ersatt av något som ger samma nytta, eller borttagen med motivering.

- ID: `01KYNBFCFM70VE0TSJT46HEVKC`
- Type: task
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Automatisk uppdateringskontroll av userscriptet

Rasmus 2026-07-28: skriptet borde hålla koll på nya versioner och helst kunna uppdateras med en knapp.

DET MESTA FINNS INBYGGT

Tampermonkey och Greasemonkey har egen versionshantering, styrd av metadata i skriptets huvud:

  // @version      0.4
  // @updateURL    http://ubuntu-ai:8003/svk-kbok-enhancements.user.js
  // @downloadURL  http://ubuntu-ai:8003/svk-kbok-enhancements.user.js

Tampermonkey hämtar då updateURL med jämna mellanrum, jämför @version, och erbjuder uppdatering när numret höjts. Ingen egen kod behövs för själva kontrollen - det räcker att versionsnumret faktiskt räknas upp vid varje ändring, vilket är en disciplinfråga.

Att tänka på: servern kör på ubuntu-ai i hemnätet. Ska skriptet användas av någon utanför det nätet måste URL:erna peka någon annanstans - GitHub raw-länk till repot är det vanliga.

EGEN KNAPP I PANELEN

Utöver det inbyggda kan Kbok Plus-panelen visa vilken version som körs och en länk som öppnar installations-URL:en, vilket får Tampermonkey att visa sin uppdateringsdialog direkt. Det är främst för den som inte vill vänta på nästa automatiska kontroll.

En variant är att hämta serverns fil och jämföra @version mot den som körs, och visa en notis när de skiljer sig. Kräver att servern skickar CORS-huvuden, eller att skriptet får @grant GM_xmlhttpRequest - vilket i sin tur gör det mindre transparent. Väg nyttan mot det.

Klart när: versionsnumret räknas upp konsekvent, updateURL och downloadURL pekar rätt, och panelen visar körande version.

- ID: `01KYNAK92DVY8QDG53V51RG3YP`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Inställning: fyll inte i nästa söndag som pålysningsdatum automatiskt

Rasmus 2026-07-28: fanns som en faktisk funktion i desktopklienten - man kunde stänga av att datumet förifylldes.

NULÄGE I KBOK

Pålysningsformuläret förifyller Pålysningsdatum med nästa söndag. Manualen beskriver det under Pålysningsbok: 'Pålysningsdatum - förifyllt med nästa söndag.'

Det är rimligt i normalfallet men fel så fort pålysningen gäller en annan dag, och då måste värdet rensas eller skrivas över varje gång.

ATT BYGGA

En inställning i Kbok Plus som tömmer fältet när pålysningsformuläret öppnas, så att man skriver datumet själv. Av som standard - förifyllningen är Kboks avsedda beteende, och den som vill ha desktopklientens valmöjlighet slår på det.

Att tänka på: fältet fylls i av appen efter att formuläret renderats, så tömningen måste ske efter det - troligen via MutationObserver som redan finns i skriptet. Värdet måste dessutom rensas på Reacts sätt (prototypens value-setter plus input-händelse), samma mönster som skrivDagensDatum använder.

Kombinationen med D-för-dagens-datum är värd att kontrollera: tömmer man fältet ska D kunna fylla i dagens datum direkt.

Klart när: inställningen finns, är av som standard, och fältet är tomt när den är på.

- ID: `01KYNAECYD4VFZBG0NS0GZMRS6`
- Type: feature
- Actor: ai:claude-code

---

## [P3][todo] [svk-kbok-enhancements] RASMUS: fråga någon vad Ctrl+M Ministerialboksperson faktiskt gjorde i gamla Kbok

Rasmus 2026-07-28: fråga någon som arbetat i desktopklienten.

VAD KÄLLAN SÄGER

Gamla Kbok-hjälpen avsnitt 12.7 listar 'Ctrl + M  Ministerialboksperson' i kortkommandotabellen. Det är den ENDA förekomsten av ordet i hela hjälpen (3868 rader) - ingen förklaring någonstans.

MIN TOLKNING, obekräftad

Desktopklientens startsida hade ett personnummerfält med fyra knappar bredvid (hjälpen rad 215): Personsökning, Ministerialbok, Pålysning och Visa grupp från Kyrksam.

Tre kortkommandon matchar tre av knapparna:
- Ctrl + K = Starta sökning -> Personsökning
- Ctrl + M = Ministerialboksperson -> Ministerialbok
- Ctrl + Y = Pålysning -> Pålysning

Tolkningen blir att man skrev ett personnummer i fältet och tryckte Ctrl+M för att gå direkt till DEN personens ministerialboksposter, i stället för till personakten som Ctrl+K gav. 'Ministerialboksperson' skulle då betyda 'ministerialboken för den här personen', inte någon slags personkategori.

Stöds av hjälpen rad 340, som beskriver samma tudelning i listan Senaste personer: 'För att öppna ministerialbok eller personakt för en person på startsidan...'

VARFÖR DET SPELAR ROLL

Kommandot står med i README:s lista över lediga tangenter (ingen konflikt med webbläsaren). Ska det återinföras i userscriptet måste vi veta vad det ska göra. Är tolkningen rätt är motsvarigheten i Kbok att öppna personens poster i Ministerialbok direkt från ett personnummer.

Klart när: någon som arbetat i desktopklienten har sagt vad kommandot gjorde, och raden i README antingen förklarats eller strukits.

- ID: `01KYN8RA579S8PKK3MMJ9N6XYC`
- Type: task
- Actor: ai:claude-code

---

