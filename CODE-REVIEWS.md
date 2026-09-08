# Kodgranskningar

Nyast först. Varje fynd markerat åtgärdat eller avfärdat med commit-ref.

## 2026-09-08 - hela svk-kbok-enhancements.user.js (v0.46, före release)

Uppföljning av modulgranskningen samma dag, nu på hela filen med tyngdpunkt
på de äldre delarna. Samma två granskare (Claude Sonnet-subagent, Codex
gpt-5.6 read-only), samma brief. Claude 8 fynd, Codex 13, sex överlappande.
Alla verifierade mot koden före åtgärd. Åtgärdade i `%SHA%`.

| # | Fynd | Källa | Status |
| --- | --- | --- | --- |
| 1 | Ctrl+B valde första matchande knapp i hela dokumentet, utan synlighetskoll. Kunde träffa en knapp på väg ut i en stängningsanimation eller bakom Kbok Plus-panelen. Nu bara synliga knappar, helst i den sist öppnade dialogen, och aldrig när panelen är öppen. | Claude 3, Codex 1 | Åtgärdat |
| 2 | Xlsx-tolkningen hade inga gränser: en manipulerad cellreferens eller ett stort arkiv kunde frysa fliken. Tak på arkivstorlek, antal filer, rader och kolumner; överskrids de laddas filen ner i stället. | Claude 5, Codex 2 | Åtgärdat |
| 3 | Namn och personnummer i klartext i sessionStorage för blankettnamnet. Personnumret ersatt med ett kontrollvärde som bara duger till att känna igen rätt person. Namnet behövs för filnamnet och står kvar. | Claude 2, Codex 5 | Åtgärdat |
| 4 | Changeloggens markdownlänkar satte href utan schemakontroll; ett javascript:-schema i en komprometterad changelog hade kört i Kboks kontext. Bara http och https blir länkar. | Claude 4, Codex 6 | Åtgärdat |
| 5 | Id:n ur data-id och API-svar användes i adresser utan validering. Bara heltal accepteras nu, i länkikonen, HANDLING-kartan och avstämningens personaktslänk. | Codex 8 | Åtgärdat |
| 6 | Gruppnamnet till Konfirmationsblankett-gemensam lästes utan att kontrollera att formuläret hör till den grupp namnet kom från. Adressen måste nu börja med gruppvyns. | Codex 9 | Åtgärdat |
| 7 | En pågående genvägsinspelning lämnade sin keydown-lyssnare på document om panelen stängdes mitt i. Panelen städar nu alla inspelningar vid stängning. Verifierat i webbläsare. | Codex 10 | Åtgärdat |
| 8 | Blob-URL:er för kalkylblad och reservnedladdningar återkallades aldrig. Släpps en minut efter klicket. | Codex 12 | Åtgärdat |
| 9 | HANDLING-kartan växte obegränsat under en arbetsdag. Töms vid 5000 poster. | Claude 7 | Åtgärdat |
| 10 | API-basen godtog vilken absolut adress som helst. Kräver nu https. En tillåtelselista per miljö avfärdad: produktionens värd är okänd, och den som styr appens XHR-adresser har redan kört kod i sidan. | Codex 7 | Åtgärdat delvis |
| 11 | Adresskravet avgör med fri text och kan släppa igenom när boxen har en okänd extra rad. | Claude 1, Codex 4 | Avfärdat: kontrollen är verifierad mot alla fem handlingstyperna, och en positiv gatuadress-regex hade varit bräckligare än uteslutningen. Känd begränsning, dokumenterad i avsnittet Om adresskravet. |
| 12 | Auto-hämtningen godtar varje namnlös knapp utan ClearIcon inom fem föräldranivåer. | Claude 6, Codex 3 | Avfärdat: samma notering som i granskningen 2026-07-29, ingen konkret instans. Hämta-igen-knappen på huvudpersonen har text och stoppas av arHamtaKnapp oavsett sidkontext. |
| 13 | MutationObserver-loopen gör helsidesskanningar vid varje mutation. | Codex 11 | Avfärdat: rAF-debounce, per-steg spärrar och cache finns; ingen mätt fördröjning. Inkrementell bearbetning är en omskrivning utan påvisat behov. |
| 14 | Miljövalet i Utbildningsmiljön delas mellan användare på samma webbläsare. | Codex 13 | Avfärdat: gäller bara övningsmiljön och är avsikten med inställningen. |
| 15 | fokuseraBekraftas per-nod-spärr uteblir om MUI återanvänder dialognoden. | Claude 8 | Avfärdat: felriktningen är för lite fokus, inte fel knapp, och ingen sådan återanvändning har observerats. |

Inga fynd i: XSS via API-data (allt går via textContent), miljöredirect till
annan origin, XHR-patchen i sig, personuppgifter i konsolen, död kod.
TASK-1670 (utskriftsstilbladet) bekräftades av båda men ligger kvar som egen
task.

## 2026-09-08 - avstämningsmodulen (v0.46, före release)

Två oberoende adversariella granskare med samma brief: en Claude-subagent
(Sonnet, efter att Opus slog i sessionsgränsen) och Codex (gpt-5.6,
read-only). Tyngdpunkt på fliken Avstämning av tacksägelser, rad 2614-3376.
Båda namngav lästa filer och commits först. Claude 6 fynd, Codex 13, tre
överlappande. Alla verifierade mot koden före åtgärd. Åtgärdade i `ce82806`.

| # | Fynd | Källa | Status |
| --- | --- | --- | --- |
| 1 | Pålysningsfönstret började vid periodens start. En tacksägelse söndagen efter dödsfallet ligger ofta före aviseringsdagen och missades, raden visade Saknas. Fönstret går nu sex månader bakåt. | Codex 6 | Åtgärdat |
| 2 | Månadsbyte under pågående hämtning ritade det gamla resultatet under den nya rubriken. Körningarna har nu löpnummer, låst period och omkörning. | Codex 2, Claude 4 | Åtgärdat |
| 3 | Verifikat utan personnummer visades som Saknas. Visas nu som "kan inte stämmas av här" och räknas separat. | Codex 3 | Åtgärdat |
| 4 | Ett enda misslyckat detaljanrop fällde hela månaden. Fångas nu per rad. | Claude 2 | Åtgärdat |
| 5 | Sidningen litade blint på `totalt`. Fortsätter nu vid full sida. | Claude 3 | Åtgärdat |
| 6 | Klicklyssnaren satt på flikraden, som React byter ut. Ligger nu på `document`. | Codex 8 | Åtgärdat |
| 7 | Saknad flikrad nollställde tillståndet men lämnade panelen, och en pågående hämtning kunde skriva i den. Panelen tas bort och körningen märks som borttagen. | Codex 9, Claude 6 | Åtgärdat |
| 8 | Saknat `palysningsId` hade skickat tom kropp till `FetchOrCreatePalysning`. Rader utan id hoppas över. | Codex 1 | Åtgärdat |
| 9 | Ingen timeout på anropen. 30 sekunder. | Codex 7 | Åtgärdat |
| 10 | Verifikatlänken loggade inget när fiberklättringen misslyckades, och fångade inte synkrona fel. Loggar nu, faller tillbaka på startsidevägen. | Claude 5, Codex 10 | Åtgärdat |
| 11 | Dokumentationen påstod normalisering till tolv siffror som koden inte gjorde. Koden kräver nu tolv siffror för en nyckel, annat blir "kan inte stämmas av". Kbok levererar tolv i båda listorna (mätt). | Claude 1, Codex 4 | Åtgärdat |
| 12 | Hanterad-markeringarna delas mellan användare på samma webbläsarprofil. | Codex 5 | Avfärdat: avsiktligt och dokumenterat i README, markeringen är per webbläsare och innehåller bara verifikatets id. |
| 13 | pushState-reserven bygger routertillstånd från ett odokumenterat format. | Codex 11 | Avfärdat: det är en reserv som bara tas när kontexten saknas, och den loggar nu i konsolen när det sker. |
| 14 | Ändrade API-svar blir tyst tomma resultat. | Codex 12 | Avfärdat delvis: saknade `rows` ger nu "uppgift saknas" per rad (fynd 3 och 4). Fullständig schemavalidering mot ett API utan kontrakt bedöms inte värd sin egen bräcklighet. |
| 15 | Blankettnamnsfunktionen sparar namn och personnummer i `sessionStorage`. Utanför modulen. | Codex 13 | Kvar: TASK-1714, helhetsgranskningen. |

Kontrollerat samma dag efter nattens nollställning: detaljhämtningen av ett
verifikat ändrar inte dess status från Nytt.

## 2026-07-29 - hela svk-kbok-enhancements.user.js (v0.27)

Granskad av en Claude-subagent med eget kontext, efter att filen vuxit från
790 till 1958 rader under en session utan att någon läst den i sin helhet.
Frågelista: korrekthet, robusthet, prestanda, prototyppatcharna, läsbarhet.

Alla fyra fynd verifierade i koden före åtgärd. Åtgärdade i `34c527d` (v0.28).

| # | Fynd | Status |
| --- | --- | --- |
| 1 | Ingen spärr mot dubbel laddning. Två instanser ger två keydown-lyssnare på samma tangenttryckning; Ctrl+B bekräftar verifikat och är oåterkallelig. | Åtgärdat `34c527d` |
| 2 | `uppdatera()` saknade felhantering. Ett undantag avbröt alla efterföljande funktioner, permanent eftersom den körs vid varje DOM-ändring. | Åtgärdat `34c527d` |
| 3 | `kommIhagPersonnamn` saknade spärren som `kommIhagGruppnamn` har - tre fulla `main`-genomsökningar plus reflow vid varje mutation. | Åtgärdat `34c527d` |
| 4 | Kommentaren sa att `huvudperson.*` lämnas ifred, men `arRelationsfalt` uteslöt bara `searchpersonnummer`. Skyddet fanns i `arHamtaKnapp`, alltså i fel lager mot vad koden påstod. | Åtgärdat `34c527d` |

Granskaren fann inget bevisat fel som skulle skicka en länk eller ett filnamn
till fel person. Filnamnslogiken och länkbygget bedömdes stämma med det
README beskriver som testat.

Kvar som noterat men inte åtgärdat: `hittaHamtaKnapp` klättrar upp till fem
föräldranivåer och söker hela subträdet vid varje nivå, vilket i teorin kan
fånga en orelaterad namnlös ikonknapp i ett okänt formulär. Ingen konkret
instans hittad - de fyra dokumenterat testade fälten fungerar.
