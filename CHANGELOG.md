# Ändringar

Nyast först. Vad som ändrats för dig som använder tillägget - hur det är
byggt framgår av commit-historiken.

## 0.46

- **Avstämning av tacksägelser** i Pålysningsboken: en ny flik visar vilka
  avlidna som saknar pålysning för vald månad, förvalt den föregående.
  Dödsfallen gäller den församling du är inloggad i, medan tillägget söker
  pålysningarna i alla dina församlingar. Du ser om varje pålysning är
  knuten till en begravning eller fristående, och kan öppna verifikatet och
  personakten direkt från raden. Kryssa Hanterad för det som är omhändertaget
  på annat sätt. Klicka på månaden för att hoppa direkt till en annan
  månad och ett annat år. Listan går att skriva ut.
- **Platslistan är sökbar.** Skriv några bokstäver i Välj plats eller
  Pålyses i kyrka, så visar listan bara de kyrkor som matchar. Pil ned och
  Enter väljer, och ett eget namn står kvar som förut. Enter på ett eget
  namn stänger bara listan i stället för att spara posten.
- Ctrl+B träffar bara knappen i den öppna rutan, inte en som är på väg
  bort eller ligger bakom inställningarna.
- Ctrl+P på en vanlig Kbok-sida skriver ut sidan igen. Sedan 0.45 blev det
  tomt papper om inget verifikat var öppet.
- Tillägget glömmer namnet det döper blanketterna efter så snart filen
  fått sitt namn, och rensar allt sådant när du loggar ut.

## 0.45

- **Skriv ut-ikon på ett öppnat verifikat**, som i desktopklienten.
  Utskriften blir en sida med bara verifikatet - inga tomma ark efter, och
  inga knappar med på pappret. Det gäller även om du trycker Ctrl+P som
  vanligt.

## 0.44

- **Dopinbjudan får det datum du anger i rutan** i filnamnet, inte dagens:
  `2026-09-20 - Dopinbjudan - Andersson, Lena.pdf`.

## 0.43

- Inställningarna ryms nu i sin helhet på en vanlig skärm, utan att man
  behöver skrolla i rutan.

## 0.42

- **Upptagande- och utträdesbevis får datum även när du hämtar dem från
  personakten.** Tidigare fick de det bara direkt i in- eller utträdesflödet.
  Datumet är tillhörighetens, alltså samma dag som beviset gäller.

## 0.41

- Rapporter du tar ur ett verifikats rapportruta får händelsedatumet, inte
  dagens datum. Välkomstmeddelandet efter ett inträde hamnar därmed på
  samma datum som upptagandebeviset bredvid det.

## 0.40

- **Tillägget döper om fler rapporter från personakten** än bevisen:
  medlemsbevis, registerutdrag, anmälningar, förfrågningar och
  välkomstmeddelande. De får dagens datum, rapportens namn och personens
  namn: `2026-07-30 - Medlemsbevis - Andersson, Lena.pdf`.
- Namn- och adresslistorna behåller Kboks namn. De gäller ett urval, inte en
  person, och har inget namn att döpa dem efter.

## 0.39

- Tillägget hämtar nu personen automatiskt även i det fristående
  pålysningsformuläret. Där gjorde det inte det, trots att det är just den
  vyn där ett glömt namn gör att Spara inte säger något alls.

## 0.38

- **Inställningarna ligger nu på två flikar**, en för valen och en för
  genvägarna. Genvägsfliken får plats utan att du behöver skrolla, och
  inställningarna är kortare än förut.
- Länk till GitHub längst ned i panelen, där beskrivningen och alla
  ändringar finns samlade.

## 0.37

- Ändringslistan märker ut vad som är nytt sedan din version.

## 0.36

- Uppdateringsrutan står kvar tills du valt. Tidigare försvann den
  i ett dygn så fort du laddade om sidan, även om du inte hunnit läsa den.
- Panelen visar alltid det senaste versionsnumret.

## 0.35

- Stäng-knappen i panelen ligger inte längre i vägen för länken ovanför.

## 0.34

- Tillägget visar ändringarna i en egen ruta med rubriker och listor i
  stället för rå text.

## 0.33

- **Tillägget säger till när en ny version finns**, en gång per dag. Du kan
  uppdatera, läsa vad som ändrats, eller vänta.

## 0.32

- Panelen visar om det finns en nyare version än den du kör.

## 0.31

- Knapparna i blankettrutan reagerar på muspekaren, och Skriv ut är förvald
  så att Enter räcker.

## 0.30

- Knapparna i blankettrutan har fått Kboks färger och en tydlig kant.

## 0.29

- **F9 hämtar blanketten för den handling du står i**, utan att gå via
  Rapporter-menyn. Tillägget väljer blankett efter vilken flik du är på, så
  att vigsel och välsignelse inte blandas ihop.

## 0.28

- Rättningar efter en kodgranskning. Inget syns utåt.

## 0.27

- **Rutan visar kalkylblad som tabell**, precis som blanketterna. Rapporter
  går att växla mellan PDF och kalkylblad högst upp i menyn.

## 0.26

- Kalkylblad behåller sitt filnamn när du laddar ner dem.

## 0.25

- Adresskontrollen missade när någon tagit bort gatuadressen men postnumret
  stod kvar.

## 0.24

- Adresskontrollen gäller nu även vigsel och välsignelse.
- Varningen är en ruta med samma text som Kbok själv använder i dop.

## 0.23

- **Adressen måste vara ifylld innan du skapar verifikat** i konfirmation,
  vigsel, välsignelse och begravning. Kbok kräver det bara i dop, trots att
  regelverket kräver adress för varje kyrklig handling. Du kan spara den
  preliminära posten som vanligt.

## 0.22

- **Markören hamnar i datumfältet** vid in- och utträde, så du kan skriva
  datumet direkt.

## 0.21

- Bevisen med adress får samma filnamn som de utan.

## 0.20

- Bevis får rätt namn även när du bekräftar verifikatet senare, via Aktuella
  på startsidan.

## 0.19

- Inställningarna grupperade efter var de märks, med det som inte går att
  ångra för sig.

## 0.18

- **Ctrl+B bekräftar verifikat.** Den enda genvägen som gör något du inte kan
  ångra, och panelen märker ut den.

## 0.17

- Du landar rätt även när du laddar om en undersida.

## 0.16

- Länkikonen i Ministerialboken öppnar själva ministerialboksposten.
  Tidigare öppnade den personakten.

## 0.15

- Länkikonen fungerar direkt, utan att du behöver söka om först.

## 0.14

- Länkikonen i Ministerialboken pekade på fel sida och gör det inte längre.

## 0.13

- Efter miljövalet landar du på sidan du klickade, inte på startsidan.

## 0.12

- **Miljövalet i Utbildningsmiljön kommer ihåg sig.** Du behöver inte göra
  om det i varje ny flik.

## 0.11

- Länkikonen finns bara i listor där den leder någonstans. Startsidans
  verifikatlistor fick den i onödan.
- Ikonen är större och lättare att se.

## 0.10

- **Blanketten kan öppnas i en ruta** med Skriv ut och Ladda ner, i stället
  för att Kbok laddar ner den direkt.

## 0.9

- Auto-hämtningen rensade personnumret i stället för att hämta personen.
  Fungerar nu även på Inträde.

## 0.8

- **Nedladdade blanketter och bevis får datum, typ och namn i filnamnet** i
  stället för bara typen.

## 0.7 och tidigare

Länkikon och mittenklick som öppnar personakten i ny flik, auto-hämtning av
relationspersoner, tabb förbi kalenderknappen, markerbart personnummer, `D`
för dagens datum, tomt pålysningsdatum, tangentbordsgenvägar som går att
spela om, och inställningspanelen.
