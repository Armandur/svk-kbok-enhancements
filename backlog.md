# Backlog Export

## [P2][done] [svk-kbok-enhancements] Auto-hämta utlöses inte när personnumret skrivs för hand

Rasmus 2026-07-29, efter att kryssknappsbuggen rättats i 0.9.

SYMPTOM

Auto-hämtningen går igång vid inklistring men inte när numret skrivs in tecken för tecken.

VAD SOM ÄR VERIFIERAT

Inklistring fungerar - mätt i Utbildningsmiljön på Inträde: fältet behåller numret och personen hämtas. Testerna använde Playwrights fill(), som sätter hela värdet på en gång, alltså samma sak som en inklistring. Handskrivning testades med type(delay=25) FÖRE kryssknappsfixen och kördes aldrig om efteråt - den vägen är alltså obevisad, och Rasmus rapport pekar på att den inte fungerar.

TROLIGA ORSAKER ATT UNDERSÖKA

1. Fördröjningen. Klicket ligger i en setTimeout på 250 ms med kontrollen att faltets värde fortfarande är detsamma. Den som skriver klart och fortsätter röra fältet - eller vars sista tangenttryck kommer strax efter - får värdet ändrat innan timern löper ut, och klicket avbryts med flit. Vid inklistring uppstår aldrig den kapplöpningen.

2. Mellanlägen i regexen. KOMPLETT_PNR är /^(\\d{8}|\\d{6})-?\\d{4}$/. Skrivs numret utan bindestreck passerar 12 siffror som en träff, men om fältet formaterar om värdet medan man skriver kan matchningen ske i ett läge där appens eget tillstånd ännu inte hunnit med.

3. svkKbokHamtat-spärren. Den lagrar det senast hämtade värdet och hindrar en ny hämtning för samma nummer. Träffar regexen ett mellanläge som sedan blir det slutliga numret, är spärren redan satt och den riktiga hämtningen uteblir.

Punkt 3 är den troligaste: den är helt osynlig utåt och ger precis det här symptomet.

ATT GÖRA

Kör diagnostiken i Utbildningsmiljön med type(delay=...) mot Inträde och ett relationsfält, logga varje input-event med värde, regexträff, spärrvärde och om klicket faktiskt utfördes. Det avgör mellan de tre.

Klart när: hämtningen går igång både vid inklistring och vid handskrivning, verifierat på Inträde och ett vårdnadshavarefält.

- ID: `01KYPB61EN3WZ4Y3TN7FKBEHGZ`
- Type: bug
- Actor: ai:claude-code

---

## [P2][done] [svk-kbok-enhancements] Gör adressen obligatorisk även i övriga kyrkliga handlingar, som stop-gap

Rasmus 2026-07-29. Kandidaten som redan står som Kartlagd fälla 3 i README, nu uttryckligen önskad som funktion i skriptet.

PROBLEMET

Kbok stoppar verifikatet om adressen saknas i Dop, men släpper igenom Konfirmation, Vigsel, Välsignelse och Begravning - trots att postadress och folkbokföringsadress ska registreras för varje kyrklig handling enligt SvKB 2009:9, 3 kap.

VAD SKRIPTET SKA GÖRA

Utvidga samma kontroll till de övriga fyra handlingarna. Stop-gap tills Kbok eventuellt får det inbyggt - avstämningsfrågan till Kyrkokansliet ligger som kbok-web TASK-491, och blir svaret att kontrollen ska finnas överallt kan skriptets version tas bort igen.

ATT TÄNKA PÅ

Adress och Adress forts ligger sida vid sida och är lätta att förväxla. Det är Adress som kontrolleras.

Vigsel och Välsignelse har två personer med var sin adress under Person 1 och Person 2 - båda måste kontrolleras. Sektionsläsaren från TASK-514 (sektionMed/sektionsfalt) hanterar redan den uppdelningen och går att återanvända.

Öppen fråga för utformningen: ska skriptet blockera Spara eller bara varna? Att blockera är effektivast men bråkar mest med appen, och en felaktig blockering vore värre än en missad adress. En varning som går att klicka förbi är troligen rätt avvägning - avgörs vid bygget.

Inställning i panelen, och rimligen på som standard eftersom regelverket kräver adressen.

Klart när: en saknad adress uppmärksammas vid Spara i alla fem handlingarna, inställningen finns, och beteendet är verifierat i Utbildningsmiljön.

- ID: `01KYNE9002D5Q0EAHPGNARX6TA`
- Type: feature
- Actor: ai:claude-code

---

## [P2][done] [svk-kbok-enhancements] Publicera repot på GitHub och testa skriptet i riktig Tampermonkey

Två saker som återstår innan skriptet kan sägas fungera på riktigt. Dokumenterat 2026-07-29 inför sessionsslut.

ALDRIG TESTAT I TAMPERMONKEY

Allt är verifierat genom att injicera skriptet med Playwright mot Utbildningsmiljön - kugghjul, panel, genvägar, kolumn, datumfält, allt. Men det är inte samma sak som en riktig installation: Tampermonkey kör i en isolerad sandlåda med egen kontext, och @grant none innebär att skriptet delar sidans window. Sådant som fungerar vid injektion kan bete sig annorlunda där.

Installera från http://ubuntu-ai:8003/ och gå igenom funktionerna.

INGEN GITHUB-REMOTE

Repot är bara lokalt. @updateURL och @downloadURL pekar redan på
https://raw.githubusercontent.com/armandur/svk-kbok-enhancements/main/svk-kbok-enhancements.user.js
men den adressen svarar inte förrän repot är publicerat. Fram till dess installeras skriptet från den lokala servern, och uppdateringar måste installeras om för hand.

Rasmus idé om GitHub Pages: Jekyll renderar README automatiskt, så installationssidan kan flytta dit i stället för att bo på ubuntu-ai - som ändå bara nås inifrån hemnätet.

STATUS I ÖVRIGT

Version 0.7, nio inställningar, fyra genvägar med inspelning. Installationsservern kör på port 8003, registrerad i portalen.

Klart när: repot ligger på GitHub, raw-adressen svarar, och skriptet är genomgånget i en riktig Tampermonkey-installation.

- ID: `01KYNCHTA80GCT91Z0JGH6VJEY`
- Type: task
- Actor: ai:claude-code

---

## [P3][todo] [svk-kbok-enhancements] Auto-hämta täcker inte pålysningsformulärets Person 1 - dokumentationen säger att den gör det

Upptäckt 2026-07-30 under utredningen av TASK-530.

MÄTT I UTBILDNINGSMILJÖN

Fristående pålysning, /palysning/new, fältet Person 1 > Personnummer (id huvudperson1.persnr). Personnumret skrivet tecken för tecken med tangentbordet, 60 ms mellan tangenterna:

  namn hämtat: nej
  fältvärde:   19550307-1796

Fältet har en namnlös förstoringsglas-ikon 22 px till höger, alltså precis det mönster auto-hämta finns till för. Ett klick på den knappen hämtar personen direkt.

ORSAKEN

arRelationsfalt() sållar bort alla fält vars id börjar med huvudperson:

  if (/^huvudperson/.test(id)) return false;

Avsikten är god - på en kyrklig handling är huvudpersonens knapp 'Hämta uppgifter igen från folkbokföringen', som skriver över redigerade uppgifter och aldrig ska klickas automatiskt. Men pålysningsformulärets Person 1 heter också huvudperson1.persnr, och där är knappen en vanlig hämtning. Samma id-prefix betyder olika saker i två vyer.

VARFÖR DET SPELAR ROLL

Dokumentation.md påstår motsatsen. Kartlagd fälla nr 1 listar 'Person 1 i det fristående pålysningsformuläret' bland de bekräftade fälten och rubriken säger '(åtgärdad i skriptet)'. Avsnittet 'Om auto-hämtningen' säger 'Gäller alla personnummerfält med en hämtningsknapp'. Båda är fel om just det här fältet.

Värst är att pålysningsformuläret är det fält där fällan kostar mest: saknas namnet ger Spara ingen återkoppling alls.

MÖJLIG LÖSNING, inte utredd

Byt prefix-regeln mot att titta på knappen i stället - det är ju knappens etikett som avgör om den är destruktiv, och arHamtaKnapp() sållar redan bort 'Hämta uppgifter igen'. Alternativt undanta huvudperson bara när vyn är en kyrklig handling, inte på /palysning/new.

Klart när: personnumret i pålysningsformulärets Person 1 hämtar personen av sig själv, huvudpersonens fält på dop/vigsel/begravning/konfirmation fortfarande INTE klickas automatiskt (verifiera båda), och Dokumentation.md stämmer med vad skriptet gör.

- ID: `01KYQZYDMDP2BJ8WKKWG64R83N`
- Type: bug
- Actor: ai:claude-code

---

## [P3][todo] [svk-kbok-enhancements] Döp om fler rapporter än bevisen - börja med Medlemsbevis

Rasmus 2026-07-30, förslag 5 i genomgången.

LÄGET I DAG

Personaktens Rapporter-meny har 29 poster. Bara blanketterna och de fyra bevisen (Upptagandebevis, Utträdesbevis, med och utan adress) döps om. Övriga, som Medlemsbevis och Registerutdrag, laddas ner med Kboks eget namn - alltså Medlemsbevis.pdf, och nästa blir Medlemsbevis (1).pdf.

RASMUS FÖRSLAG TILL NAMNFORM

  2026-07-30 - Medlemsbevis - Efternamn, Förnamn.pdf

Datumet är dagen beviset togs ut, inte ett handlingsdatum - ett medlemsbevis gäller läget just då. Det skiljer det från blanketterna, som får handlingsdatum, och från in- och utträdesbevisen, som får händelsedatum när det finns.

OMFATTNING

Börja med Medlemsbevis. Vilka av de övriga 29 rapporterna som är värda samma behandling får undersökas senare - några är listor och urval utan en enskild person att namnge, och de ska lämnas i fred.

Klart när: Medlemsbevis laddas ner med uttagsdatum, typ och namn, verifierat i Utbildningsmiljön, och Dokumentation.md säger vilka rapporter som döps om och varför datumet betyder olika saker för olika typer.

- ID: `01KYQYF3V7XR5GTH3B409213AW`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Kolla om pålysningar kan öppnas i ny flik som personakter och ministerialböcker

Rasmus 2026-07-30, förslag 3 i genomgången av vad mer tillägget kan göra.

LÄGET I DAG

Länkikonen läggs på där griden har kolumnen PERSNR (Sök personer) eller där Ministerialbokens API-svar SearchMinisterialbok ger ett personid per rad. Pålysningsboken använder gemena data-field som Ministerialboken men har ingen sådan ihopparning, så dess rader får ingen ikon.

DOMÄNFÖRUTSÄTTNING FRÅN RASMUS

Pålysningar registreras INTE på en personakt - de är en egen listning. Länkmålet kan alltså inte byggas som en personakt-URL med en handlingsvy på slutet, som Ministerialbokens gör. Vad en pålysning öppnas som måste tas reda på först.

ATT UTREDA

1. Vad appens eget dubbelklick på en pålysningsrad öppnar - vilken adress, och bär den ett id som går att bygga en länk av.
2. Vad Pålysningsbokens sökanrop returnerar per rad, och om det finns ett id där som räcker.
3. Om det fristående pålysningsformuläret och pålysningar knutna till en handling beter sig olika.

Klart när: det är avgjort om en länkikon i Pålysningsboken går att bygga, och i så fall vad den ska peka på. Går det inte, skriv in varför i Dokumentation.md bland de listor som inte får ikon.

- ID: `01KYQYEMG6WP9XPZMZ4YM2PAFZ`
- Type: spike
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Länk till GitHub-repot någonstans i Kbok Plus-panelen

Rasmus 2026-07-29: panelen visar version och Sök efter uppdatering längst ned, men ingenstans var tillägget kommer ifrån. Den som vill läsa vad det gör, se changeloggen i sin helhet eller anmäla något har ingen väg dit.

Idé: en länk till https://github.com/Armandur/svk-kbok-enhancements i panelen, rimligen på versionsraden längst ned där Sök efter uppdatering redan sitter.

Inte utrett: om länken ska öppnas i ny flik (troligen ja) och om den ska heta repots namn eller något som säger vad man hittar där.

- ID: `01KYQN930WRZASTE9YM0SJSEMR`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Dela upp inställningspanelen i två flikar: inställningar och genvägar

Rasmus 2026-07-29: panelen är en enda lång kolumn - fyra grupper med kryssrutor, och därunder genvägslistan med inspelningsknappar. Med alla grupper synliga blir den högre än en mobilskärm och har fått egen scroll som plåster.

Idé: två flikar i stället. En för inställningsvalen (Träfflistor, Formulär, Blanketter och rapporter, Utbildningsmiljön) och en för tangentbordsgenvägarna som går att sätta om. Genvägsbrytaren följer med till genvägsfliken.

Inte utrett: om flikarna gör det svårare att hitta genvägarna för den som inte vet att de finns, och hur Går inte att ångra-markeringen ska synas när dess två poster hamnar i olika flikar.

- ID: `01KYQMRWHGXZ56Z2MRAPCR3Q14`
- Type: improvement
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Korta ned README och flytta detaljerna till en egen dokumentationsfil

Rasmus 2026-07-29: README på GitHub är alldeles för invecklad och inte målgruppsanpassad.

PROBLEMET

README har vuxit med varje funktion och är nu en blandning av två saker: vad tillägget gör för den som ska använda det, och hur det är byggt och varför lösningarna ser ut som de gör. Det andra är värdefullt men hör inte hemma först.

Den som hittar repot vill veta vad tillägget gör, hur man installerar det, och vad man får. Inte att MUI:s Select öppnar listan på mousedown, att adressboxen ligger olika djupt i olika handlingar, eller hur zip-uppackningen fungerar.

FÖRSLAG

README behåller: kort beskrivning, installation, funktionstabellen, genvägstabellen, länk till changelog och vidare läsning.

En Dokumentation.md tar över: kartlagda fällor, de tekniska motiveringarna bakom varje lösning, gamla Kboks kortkommandolista, avsnitten om hur filnamn, miljöval, adresskrav och kalkylblad är byggda.

Behåll allt innehåll - det är dokumentation av verkliga fynd i Kbok och värt att spara. Det är placeringen som är fel, inte texten.

Skärmdumparna i TASK-526 hör till README och gör den mer begriplig; de två uppgifterna hänger ihop.

Klart när: README går att läsa på en minut och säger vad tillägget gör, och detaljerna finns kvar i en egen fil som är länkad.

- ID: `01KYQJGP2N584BHG0RR0Z2K1MN`
- Type: improvement
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Skärmdumpar i README som visar vad tillägget gör

Rasmus 2026-07-29, efter att repot publicerats.

VARFÖR

README beskriver funktionerna i text och tabell, men repot har ingen bild alls. Den som hittar dit ser inte vad tillägget faktiskt gör förrän hen installerat det. Ett par skärmdumpar från Utbildningsmiljön skulle visa det på en gång.

VAD SOM ÄR VÄRT ATT VISA

  inställningspanelen med grupperna och genvägarna
  visningsrutan med en blankett, Skriv ut och Ladda ner
  kalkylbladsrutan med tabellen
  länkikonen i en träfflista, med den omdöpta filen bredvid
  adressvarningen vid Skapa verifikat
  versionsraden när en ny version finns

Sex bilder är troligen för många för en README. Två eller tre som visar det som märks mest - panelen, visningsrutan och länkikonen - räcker sannolikt.

FÖRUTSÄTTNINGAR

Bilderna ska tas i Utbildningsmiljön, vars personer Rasmus bekräftat är fiktiv övningsdata som får publiceras. testmiljön får INTE användas - där finns riktiga testpersoner.

Verktyget finns: manual/verktyg i kbok-web har inloggning och skärmdumpsrutiner för samma miljö, och skriptet injiceras med add_init_script som i sessionens övriga tester. PDF-rendering kräver channel='chromium', inte Playwrights standard-headless.

Bilderna läggs i en egen mapp i repot och länkas från README med relativa sökvägar, så de fungerar både på GitHub och i en lokal klon.

Klart när: README visar vad tillägget gör med ett par bilder, tagna i Utbildningsmiljön, och de syns korrekt på GitHub.

- ID: `01KYQHZVWWG45BFX5AK1800TN3`
- Type: improvement
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Visa när en ny version finns, och versionshistoriken i panelen

Rasmus 2026-07-29, efter att repot publicerats.

TVÅ DELAR, SAMMA MEKANISM

1. Indikera att en ny version finns. Hämta @version ur raw-filen, jämför med den körande, och visa det i panelen och på menyposten när de skiljer sig.

2. Visa versionshistoriken. CHANGELOG.md ligger på samma raw-adress och kan hämtas och visas i panelen.

FÖRUTSÄTTNINGEN ÄR PÅ PLATS

GitHub raw skickar access-control-allow-origin: *, verifierat 2026-07-29. Skriptet kan alltså hämta båda filerna med fetch utan @grant, vilket var den öppna frågan i TASK-513.

  https://raw.githubusercontent.com/armandur/svk-kbok-enhancements/main/svk-kbok-enhancements.user.js
  https://raw.githubusercontent.com/armandur/svk-kbok-enhancements/main/CHANGELOG.md

ATT TÄNKA PÅ

Frekvens. Ett anrop per sidladdning är för ofta. Spara tidsstämpel i localStorage och kolla högst en gång per dygn.

Versionsjämförelse måste ske per siffergrupp, inte som sträng - '0.9' är inte nyare än '0.31'.

Integritet. Anropet går till GitHub från en flik som visar personuppgifter. Ingen data skickas, det är en GET efter en publik fil, men det är ett utgående anrop till tredjepart från ett kyrkobokföringssystem. Egen inställning, så att den som inte vill ha det slipper.

Kompletterar Tampermonkeys egen kontroll snarare än ersätter den: Tampermonkey kollar på sitt eget intervall, det här ger besked när panelen öppnas.

Klart när: panelen visar körande version, säger till när en nyare finns, och kan visa changeloggen. Inställningen finns. Beteendet verifierat mot den publicerade raw-adressen.

- ID: `01KYQHSEKT23TMKWP7296X90KW`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Sätt fokus i datumfältet när in- eller utträdesformuläret är klart

Rasmus 2026-07-29.

ÖNSKEMÅLET

Inträde: när personen hämtats via personnumret ska fokus hamna direkt i Inträdesdatum.
Utträde: så fort /uttrade laddat klart ska fokus hamna i Utträdesdatum.

Båda sparar ett musklick eller några tabbtryck i ett flöde som annars är helt tangentbordsdrivet, och passar ihop med auto-hämtningen som redan gör hämtningen åt en.

SKILLNADEN MELLAN DE TVÅ

Utträde är enkelt: vyn har URL:en /personakt/<id>/uttrade och innehåller bara personuppgifterna och fältet Utträdesdatum. Fokus kan sättas så fort fältet finns.

Inträde är svårare. Vyn /in-och-uttraden visar personnummerfältet från start, och Inträdesdatum dyker upp först när personen hämtats. Fokus får därför inte sättas för tidigt - och inte heller stjälas medan användaren fortfarande skriver personnumret. Kopplingen till auto-hämtningen (TASK-521) är att fokus rimligen ska flyttas när hämtningen är klar, alltså när namnet dykt upp på sidan.

ATT TÄNKA PÅ

Fokus får sättas EN gång per formulär, inte vid varje DOM-ändring - uppdatera() körs vid varje mutation, och ett fält som tar tillbaka fokus medan man skriver någon annanstans är värre än inget fokus alls. Samma mönster som fokuseraBekrafta använder: markera elementet med ett dataset-attribut när det är gjort.

Fokus ska inte heller stjälas om användaren redan står i ett annat fält. Kontrollera document.activeElement innan.

Fältet hittas via faltForEtikett('Inträdesdatum') respektive faltForEtikett('Utträdesdatum'), som redan finns i skriptet.

Inställning i panelen under Formulär, rimligen på som standard - det flyttar bara fokus och förstör ingenting.

Klart när: fokus hamnar i datumfältet i båda flödena, bara en gång per formulär, aldrig medan användaren skriver någon annanstans, och beteendet är verifierat i Utbildningsmiljön.

- ID: `01KYPJD7DYSQZH48HQKAZJ4GND`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Inställning: fyll ut tiosiffrigt personnummer till tolv siffror automatiskt

Rasmus 2026-07-29: skriver man bara tio siffror ska tillägget kunna fylla ut numret automatiskt.

ÖNSKEMÅLET

9007092399 -> 199007092399. Sparar fyra tangenttryck per personnummer, och tio siffror är det man har i huvudet.

FRÅGA SOM MÅSTE AVGÖRAS FÖRST

Rasmus skrev '19', men det stämmer inte generellt. Kbok registrerar dop av barn födda på 2000-talet varje dag - 0501012389 ska bli 200501012389, inte 190501012389. Ett hårdkodat 19 skulle alltså slå fel på precis den grupp som är vanligast i dopboken.

Tre vägar:

1. Härled seklet ur årtalet: är YY större än innevarande tvåsiffriga år blir det 19, annars 20. Rätt i normalfallet men fel för den som fyllt hundra - och hundraåringar förekommer i begravningsboken.

2. Låt plustecknet avgöra. Folkbokföringen skriver + i stället för bindestreck när personen fyllt 100. Finns det tecknet är seklet entydigt; saknas det gäller regel 1. Kontrollera om Kboks fält alls tar emot plustecken.

3. Fråga alltid när det är tvetydigt. Säkrast men äter upp vinsten med funktionen.

Rasmus avgör vilken. Väg 2 är den som är både korrekt och tyst i normalfallet.

ATT TÄNKA PÅ VID BYGGET

Utfyllnaden måste ske innan auto-hämtningen (TASK-521) läser fältet, annars hämtas fel person eller ingen alls. Värdet ska skrivas på Reacts sätt - prototypens value-setter plus input-händelse - samma mönster som skrivDagensDatum använder, annars ser fältet ifyllt ut medan appens tillstånd är tomt.

Fältet kan formatera om värdet självt. Kontrollera vad som händer när tolv siffror skrivs in i ett fält vars placeholder är ÅÅÅÅMMDD-NNNN.

Inställning i panelen, rimligen på som standard om seklet kan härledas säkert - annars av.

Klart när: tio siffror blir tolv med rätt sekel, beslutet om sekelregeln är nedskrivet med motivering, och beteendet är verifierat i Utbildningsmiljön för en person född på 1900-talet och en född på 2000-talet.

- ID: `01KYPB70QDFSYFQS42VFAMQA5M`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Ctrl+B som genväg för Bekräfta verifikat

Rasmus 2026-07-29.

VAD SOM SKA BYGGAS

En femte post i KOMMANDON, med samma mönster som de befintliga: kor: () => klickaKnappMedText('Bekräfta verifikat'), standard Ctrl+B. Genvägen blir därmed ominspelningsbar i panelen som de andra.

Ctrl+B är ledigt i webbläsaren i praktiken - Chrome använder det inte, Firefox öppnar bokmärkesfältet men släpper igenom preventDefault. Kontrollera vid bygget att fångsten fungerar, som gjordes för Ctrl+U.

VIKTIGT: DEN HÄR ÄR INTE SOM DE ANDRA

Att bekräfta ett verifikat är slutregistrering och går inte att ångra. De befintliga genvägarna gör saker som går att backa - spara, öppna ett formulär, byta församling. Den här gör det inte.

Av samma skäl är inställningen fokusBekraftaVerifikat av som standard: en fokuserad knapp plus ett reflexmässigt Enter bedömdes som en obehaglig kombination. En genväg har samma karaktär, fast med en tangentkombination som är svårare att trycka av misstag.

Att väga vid bygget: ska genvägen vara på som standard, eller följa fokusinställningen och vara medvetet påslagen? Ska den kräva en bekräftelse, eller vore det att bygga bort själva poängen? Rasmus avgör - men beslutet ska skrivas ned med motiveringen, som för fokusinställningen.

Klart när: genvägen finns, går att spela om, står i README:s genvägstabell med samma varning som fokusinställningen har, och beteendet är verifierat i Utbildningsmiljön.

- ID: `01KYPACJXMW85QW9CHNW86VH67`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Visa xlsx-rapporter inline i samma ruta som PDF-blanketterna

Rasmus 2026-07-29, följdfråga till TASK-516: går det att visa xlsx-filer i rutan på samma sätt som PDF:erna?

VARFÖR DET ÄR SVÅRARE ÄN PDF

PDF fungerar för att webbläsaren har en inbyggd visare - en iframe med blob-URL:en räcker. Något motsvarande finns inte för xlsx. En iframe mot en xlsx-blob laddar ner filen i stället för att visa den, så innehållet måste tolkas av skriptet självt och renderas som HTML.

RAPPORTEN DET GÄLLER

Personaktens Rapporter-meny har 'Namn- och adresslista passande Excel'. Kontrollera först om den ens levereras som en a[download]-blob - Registerutdrag utan familj gör det INTE (verifierat 2026-07-29: inget click på en download-länk, ingen nedladdning, ingen ny flik), utan går troligen via Beställda rapporter-ikonen i sidhuvudet. Är Excel-rapporten av samma sort når patchen den aldrig, och frågan faller.

TVÅ VÄGAR OM DEN GÅR ATT NÅ

1. SheetJS via @require från CDN. Minst arbete, hanterar alla varianter av formatet. Men: skriptet kör i dag med @grant none och utan externa beroenden, och en CDN-hämtad tredjepartsmodul i ett system med personuppgifter är en supply chain-risk värd att väga. Data lämnar visserligen inte webbläsaren.

2. Egen minimal tolkning. xlsx är en zip med XML. DecompressionStream finns i moderna webbläsare, så xl/worksheets/sheet1.xml plus xl/sharedStrings.xml går att läsa utan bibliotek - fast zip-katalogen måste tolkas för hand. Räcker för enkla listrapporter, går sönder på formler, flera blad och formatering. Ingen extern kod.

Väg 2 är rimlig om rapporten är en enkel lista, vilket namnet antyder. Kontrollera hur filen faktiskt ser ut innan valet.

ATT ÅTERANVÄNDA

Rutan är redan generell: patchen gäller varje a[download], inte bara blanketter, och rapportens eget filnamn används när inget kan byggas (verifierat med Medlemsbevis.pdf). Det som behövs är en gren i byggBlankettruta som renderar en tabell i stället för en iframe när filen är xlsx, plus att Ladda ner behåller rätt filändelse. Skriv ut blir en utskrift av tabellen.

Klart när: en xlsx-rapport går att läsa i rutan utan att laddas ner, eller så är frågan avfärdad med motiveringen - t.ex. att rapporten inte går via download-länken alls.

- ID: `01KYP9KHE6BMEJNSYV5NWXDTC4`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Inställning: visa blanketten i webbläsaren i stället för att ladda ner den direkt

Rasmus 2026-07-29, under arbetet med TASK-514.

ÖNSKEMÅLET

Kbok laddar ner blanketten direkt när man väljer den i Rapporter-menyn. Ett alternativ vore att öppna PDF:en i webbläsarens egen visare i stället, så att man kan läsa den först och sedan välja - skriva ut, eller spara med valfri plats.

DET GÅR TROLIGEN, MEN MED EN AVVÄGNING

PDF:en byggs klientsidan och ligger på en blob-URL i länkens href. Skriptet patchar redan HTMLAnchorElement.prototype.click (TASK-514), så samma krok kan i stället öppna href i en ny flik och avbryta nedladdningen.

Haken: filnamnet. Ett download-attribut är det enda som styr namnet. Öppnar man blob-URL:en direkt visar Chrome PDF:en, men Spara som från visaren föreslår blob-URL:ens GUID - alltså går hela filnamnsarbetet i TASK-514 förlorat i just den vägen. Utskrift påverkas inte.

Vägar att undersöka:
1. Öppna blob-URL:en i ny flik. Enklast, men GUID-namn vid Spara som.
2. Bygga en egen visningssida som bäddar in PDF:en och erbjuder en nedladdningslänk med rätt download-attribut. Behåller filnamnet men är betydligt mer kod, och en injicerad vy mitt i Kbok är påträngande.
3. Kontrollera om webbläsarens inställning Fråga var varje fil ska sparas räcker för Rasmus behov av att välja plats - då behövs ingen kod alls för den delen.

Att kontrollera först: vad Chrome faktiskt föreslår som filnamn när en blob-URL öppnas i visaren och man klickar Spara. Om namnet ärvs från något annat än GUID:et faller haken bort.

Klart när: antingen finns inställningen och filnamnet överlever, eller så är frågan avfärdad med motiveringen.

- ID: `01KYNDJHZNF6XDMZSYR9VWMX3E`
- Type: feature
- Actor: ai:claude-code

---

## [P3][done] [svk-kbok-enhancements] Byt namn på utskrivna blanketter till datum, handlingstyp och namn

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

## [P3][done] [svk-kbok-enhancements] RASMUS: fråga någon vad Ctrl+M Ministerialboksperson faktiskt gjorde i gamla Kbok

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

## [P4][todo] [svk-kbok-enhancements] Få inställningsfliken att sluta skrolla på en laptopskärm

Rasmus 2026-07-30, förslag 6 i genomgången.

LÄGET EFTER FLIKUPPDELNINGEN (0.38)

Mätt i Utbildningsmiljön vid tre viewporthöjder:

  inställningsfliken  1044 px innehåll - skrollar under cirka 1100 px skärmhöjd
  genvägsfliken        598 px innehåll - skrollar aldrig

Flikuppdelningen tog panelen från cirka 1500 till 1044, men inställningsfliken skrollar alltså fortfarande på en vanlig laptopskärm.

IDÉ

Hopfällbara grupper (Träfflistor, Formulär, Blanketter och rapporter, Utbildningsmiljön, Tillägget, Går inte att ångra). Fällda som standard, eller alla utom den man senast rörde.

AVVÄGNINGEN SOM AVGÖR

Det gömmer inställningar bakom ett klick. Panelen öppnas sällan, och den som öppnar den letar oftast efter en specifik brytare - då är en rubriklista snabbare att överblicka än en skrollad kolumn. Men den som öppnar den för att se VAD som finns får svårare.

Alternativ som inte gömmer något: korta etiketterna så raderna slutar radbrytas (två av dem tar två rader i dag), eller minska radavståndet mellan kryssrutorna.

Klart när: inställningsfliken går att se i sin helhet på 900 px skärmhöjd utan att någon inställning blivit svårare att hitta. Verifiera med mätning av scrollHeight mot clientHeight vid 900 px, inte bara på syn.

- ID: `01KYQYFNNXVJBWMZ52GZ7J95ZC`
- Type: improvement
- Actor: ai:claude-code

---

