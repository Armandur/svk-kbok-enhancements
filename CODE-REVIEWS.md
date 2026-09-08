# Kodgranskningar

Nyast först. Varje fynd markerat åtgärdat eller avfärdat med commit-ref.

## 2026-09-08 - avstämningsmodulen (v0.46, före release)

Två oberoende adversariella granskare med samma brief: en Claude-subagent
(Sonnet, efter att Opus slog i sessionsgränsen) och Codex (gpt-5.6,
read-only). Tyngdpunkt på fliken Avstämning av tacksägelser, rad 2614-3376.
Båda namngav lästa filer och commits först. Claude 6 fynd, Codex 13, tre
överlappande. Alla verifierade mot koden före åtgärd. Åtgärdade i `%SHA%`.

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
