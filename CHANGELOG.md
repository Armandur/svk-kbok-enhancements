# Ändringar

Nyast först. Versionsnumret är det som står i `@version` och som Tampermonkey
jämför mot.

## 0.37

- Changeloggen märker ut vilka versioner som är nyare än den man kör, så det
  syns var ens egen slutar när man hoppat över flera.

## 0.36

- Uppdateringsrutan återkommer vid varje sidladdning tills man tagit
  ställning. Tidigare försvann den i ett dygn så fort sidan laddades om, även
  om man inte hunnit läsa den.
- Panelen frågar alltid GitHub på nytt i stället för att lita på dygnscachen.
  En nyss utgiven version kunde annars se ut att inte finnas.
- Versionskontrollen loggar vad den kom fram till. Utan det gick ett blockerat
  anrop inte att skilja från att ingen ny version fanns.

## 0.35

- Panelens Stäng-knapp ligger på egen rad, högerställd.

## 0.34

- **Ändringarna visas i en egen ruta** ovanpå den som öppnade den, med riktig
  markdown-rendering i stället för förformaterad text.

## 0.33

- **En ruta säger till när en ny version finns**, en gång per dygn, med val
  att uppdatera, läsa ändringarna eller vänta.

## 0.32

- Panelen visar när en nyare version finns och kan hämta changeloggen.
  Versionsnumret läses från GitHub, som skickar CORS-huvuden.

## 0.31

- Rutans knappar har fått hover och fokusring, och fokus börjar på **Skriv
  ut** när en blankett visas. Rutan är nu en riktig modal: fokus hålls kvar
  inne i den, i stället för att MUI tar tillbaka det till Rapporter-knappen.

## 0.30

- Knapparna i visningsrutan bygger på ett eget stilblad i stället för
  inline-stilar. Hover och fokusring går inte att uttrycka inline.

## 0.29

- **F9 hämtar blanketten för den handling man står i**, utan att gå via
  Rapporter-menyn. Vilken blankett det gäller läses ur den valda fliken, som
  bär handlingens namn med `bok` på slutet. Det skiljer också vigsel från
  välsignelse, som delar URL.

## 0.28

- Fyra fynd från kodgranskningen åtgärdade: spärr mot dubbel laddning av
  skriptet, felhantering runt varje steg i uppdateringscykeln, spärr mot
  onödig omläsning av personnamnet, och explicit uteslutning av
  huvudpersonens fält i auto-hämtningen. Se `CODE-REVIEWS.md`.

## 0.27

- **Kalkylblad visas som tabell i rutan.** Rapporter-popupen kan leverera
  samma rapport som xlsx i stället för PDF. Formatet packas upp med
  `DecompressionStream` - ingen extern modul.

## 0.26

- Kalkylblad laddas ner i stället för att visas i en iframe, som webbläsaren
  inte kan rendera. Utan det tappade filen sitt namn och fick blob-URL:ens
  GUID.

## 0.25

- Adresskontrollen räknar inte längre postnummerraden som adress. Tar man
  bort gatuadressen står postnummer och ort kvar, och sektionen såg ifylld ut.

## 0.24

- Vigseln spärras också när adressen saknas. Adressboxen söktes fyra nivåer
  upp, men så djupt ligger den bara i begravning och dop.
- Varningen visas som en ruta med Kboks egen ordalydelse, i stället för text
  vid fältet.

## 0.23

- **Adress krävs innan verifikat skapas** i konfirmation, vigsel, välsignelse
  och begravning. Kbok kontrollerar bara i dop, trots att adressen ska
  registreras för varje kyrklig handling enligt SvKB 2009:9, 3 kap. Den
  preliminära posten får skapas som vanligt.

## 0.22

- **Fokus hamnar i datumfältet** vid in- och utträde, så snart fältet finns.

## 0.21

- Adressvarianten av bevisen får samma filnamn som grundvarianten.

## 0.20

- Namn och händelsedatum läses ur verifikatet när personakten saknas, till
  exempel när ett verifikat bekräftas senare via Aktuella på startsidan.

## 0.19

- Inställningspanelen grupperad efter var inställningarna märks, med egen
  scroll och en egen sektion för det som inte går att ångra.

## 0.18

- **Ctrl+B bekräftar verifikat.** Den enda genvägen som gör något
  oåterkalleligt, och markerad som sådan i panelen.

## 0.17

- Man landar rätt även vid F5 på en undersida. Spärren mot rundgång låg kvar
  för hela fliken och gjorde att man alltid hamnade på startsidan.

## 0.16

- Länkikonen öppnar **ministerialboksposten**, inte bara personakten -
  samma vy som appens eget dubbelklick.

## 0.15

- Patcharna körs vid `document-start` och bara mot ministerialbokens sökning.
  Kom de efter appens första anrop var uppslaget tomt.

## 0.14

- Personaktens id slås upp ur API-svaret i Ministerialboken. Radens `data-id`
  är blankettnumret där, så länken pekade på en personakt som inte fanns.

## 0.13

- Efter miljövalet landar man på sidan man klickade, inte på startsidan.

## 0.12

- **Miljövalet i Utbildningsmiljön kommer ihåg.** Valet ligger i
  serversessionen och nollställs av varje sidladdning, för alla öppna flikar.

## 0.11

- Länkikonen läggs bara på listor som gäller personer. Startsidans
  verifikatlistor fick den trots att deras `data-id` inte är en personakt.
- Pilen ersatt med Material Designs `open_in_new`.

## 0.10

- **Blanketten kan visas i en ruta** med Skriv ut och Ladda ner, i stället
  för att laddas ner direkt.

## 0.9

- Auto-hämtningen rensade personnumret i stället för att hämta. MUI lägger en
  namnlös kryssknapp i fältet så fort det har ett värde, och den klickades i
  stället för Hämta. Fungerar nu även på Inträde.

## 0.8

- **Nedladdade blanketter och bevis döps om** till handlingsdatum, typ och
  namn, i stället för bara typen.

## 0.7 och tidigare

Första versionerna: länkikon och mittenklick som öppnar personakten i ny
flik, auto-hämtning av relationspersoner, tabb förbi datumväljaren,
markerbart personnummer, `D` för dagens datum, tomt pålysningsdatum,
tangentbordsgenvägar med inspelning, och inställningspanelen.
