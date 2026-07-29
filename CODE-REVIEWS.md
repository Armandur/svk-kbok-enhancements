# Kodgranskningar

Nyast först. Varje fynd markerat åtgärdat eller avfärdat med commit-ref.

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
