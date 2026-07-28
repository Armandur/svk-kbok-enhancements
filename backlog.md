# Backlog Export

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

