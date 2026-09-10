# svk-kbok-enhancements

Userscript för Kbok, Svenska kyrkans kyrkobokföringssystem. Publicerat på
https://github.com/Armandur/svk-kbok-enhancements

## Formatet styr strukturen

Skriptet är **en fil**. Ett userscript måste vara det för att gå att
installera, så den globala riktlinjen om 400-500 rader per fil gäller inte
här. Föreslå inte moduluppdelning.

Kbok är en React-app byggd på MUI. Skriptet kör med `@grant none` och
`@run-at document-start`, och bygger på att en MutationObserver anropar
`uppdatera()` vid varje DOM-ändring - MUI:s DataGrid virtualiserar rader, så
allt injicerat försvinner annars.

## Versionsnumret

Höj `@version` **och** konstanten `VERSION` vid varje ändring som ska ut.
Tampermonkey jämför `@version` mot `@updateURL` och erbjuder uppdatering när
numret stigit. Glöms det bort får ingen uppdateringen.

## CHANGELOG.md skrivs för användaren, inte för utvecklaren

Filen visas i tilläggets egen uppdateringsruta, för församlingspersonal som
vill veta vad som ändrats för dem. Det tekniska hör hemma i
commit-meddelanden, där den som söker det hittar det.

Skriv vad man märker:

> Adresskontrollen missade när gatuadressen tagits bort men postnumret stod
> kvar.

Inte hur det är byggt:

> Adressboxen söktes fyra nivåer upp, men så djupt ligger den bara i
> begravning och dop.

Undvik funktionsnamn, DOM-detaljer, webb-API:er och interna begrepp som
`data-id`, `DecompressionStream` eller `MutationObserver`. En rad per ändring,
versionsrubrik som `## 0.37`, nyast först. Fetstil på det som är en ny
funktion, inte på rättningar.

## README för användaren, Dokumentation.md för utvecklaren

Samma uppdelning som changeloggen. `README.md` säger vad tillägget gör, hur
man installerar det och vad man får - den ska gå att läsa på en minut och
har skärmdumpar. Allt om hur något är byggt, varför en lösning ser ut som
den gör och vilka fällor i Kbok som kartlagts hör hemma i
`Dokumentation.md`.

Skärmdumparna i `skarmdumpar/` tas om med `verktyg/skarmdumpar.py`. Läs
bilderna innan de committas - ett skript som avslutas utan fel kan mycket
väl ha fotograferat en tom PDF-ram.

## GitHub raw cachar i fem minuter

`raw.githubusercontent.com` svarar med föregående innehåll i upp till fem
minuter efter en push. Uppmätt: push 20:53, ny version synlig 20:58.

Det gäller både Tampermonkeys uppdateringskontroll och tilläggets egen. En
nyss utgiven version kan alltså se ut att inte finnas. Dra inga slutsatser om
att något är trasigt förrän cachen hunnit gå ut.

## Testning

Verifiera i **Utbildningsmiljön** - dess personer är fiktiv övningsdata som
får publiceras i commit-meddelanden och skärmdumpar.

**Andra miljöer kan innehålla riktiga testpersoner.** Deras namn och
personnummer får inte committas eller publiceras. Använd en annan miljö bara
när något saknas i Utbildningsmiljön, exempelvis välsignelseposter och konfirmationsgrupper med
innehåll, och maskera i så fall utdata.

Utbildningsmiljön nollas varje natt, så irreversibla testhandlingar där är
inte permanenta.

Skriptet injiceras med Playwrights `add_init_script` för att motsvara
`document-start`. PDF-rendering kräver `channel="chromium"` - standard-headless
saknar visaren och ger en tom ram.

Inloggningsrutinerna finns i `kbok-web/manual/verktyg/testa_inloggning.py`.

## Granskningar

Kodgranskningar dokumenteras i `CODE-REVIEWS.md`, nyast först, med varje fynd
markerat åtgärdat eller avfärdat och en commit-ref.
