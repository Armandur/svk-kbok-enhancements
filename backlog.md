# Backlog Export

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

