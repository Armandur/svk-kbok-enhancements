// ==UserScript==
// @name         Kbok-tillägg
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.46
// @description  Öppna posten i ny flik, auto-hämta personen, tabb förbi datumväljaren, döpta blanketter, adresskrav på verifikat, avstämning av tacksägelser och tangentbordsgenvägar. Inställningar via Kbok Plus i menyn under avataren.
// @match        https://kbok.svenskakyrkan.se/*
// @match        https://kbok-utbildning.svenskakyrkan.se/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/armandur/svk-kbok-enhancements/main/svk-kbok-enhancements.user.js
// @downloadURL  https://raw.githubusercontent.com/armandur/svk-kbok-enhancements/main/svk-kbok-enhancements.user.js
// ==/UserScript==

/* Kbok är en MUI-app. Tre saker styr hur skriptet är byggt:
 *
 * 1. Träfflistorna är MUI DataGrid, som virtualiserar raderna - de skapas
 *    och förstörs vid scroll. Allt som injiceras måste därför läggas på
 *    igen via MutationObserver, inte en gång vid sidladdning.
 *
 * 2. Varje rad bär personaktens id i attributet data-id. Verifierat mot
 *    Sök personer: raden med data-id="21071" öppnar /personakt/21071 vid
 *    dubbelklick. Det gör att en riktig <a href> går att bygga - och en
 *    riktig länk ger vänsterklick, mittenklick och högerklickmenyns
 *    "Öppna i ny flik" utan att skriptet behöver hantera något av dem.
 *
 * 3. Datumfältens kalenderknapp har tabindex="0" och ligger mellan
 *    datumfältet och nästa fält i tabbordningen. Den som skriver datum för
 *    hand tabbar därför in i kalendern i stället för vidare i formuläret.
 */

(function () {
    'use strict';

    /* Kör bara en gång per sida. Tampermonkey och Greasemonkey plockar båda
     * upp .user.js-filer, så skriptet kan vara aktivt i två tillägg samtidigt.
     * Prototyppatcharna tål det - de är idempotenta - men lyssnarna på
     * document gör det inte: två instanser ger två keydown-lyssnare på samma
     * tangenttryckning. Ctrl+B är den enda genvägen som gör något
     * oåterkalleligt, och ett dubbelt klick på Bekräfta verifikat är den
     * värsta tänkbara följden av en dubblering. */
    if (window.__svkKbokEnhancements) return;
    window.__svkKbokEnhancements = true;

    const NYCKEL = 'svk-kbok-enhancements';
    const LANK_KLASS = 'svk-kbok-nyflik';
    const RAD = '[role="row"][data-id]';
    const KOLUMNBREDD = 34;
    const MENY_KLASS = 'svk-kbok-menypost';
    const PRODUKTNAMN = 'Kbok Plus';
    const VERSION = '0.46';
    // Tampermonkey hämtar den här adressen med jämna mellanrum, jämför
    // @version och erbjuder uppdatering när numret höjts.
    const INSTALLATIONSURL = 'https://raw.githubusercontent.com/armandur/'
        + 'svk-kbok-enhancements/main/svk-kbok-enhancements.user.js';
    const REPOURL = 'https://github.com/Armandur/svk-kbok-enhancements';
    // Kboks egna färger, avlästa ur computed style i appen.
    const ACCENT = '#7d0037';
    const ACCENT_HOVER = '#570026';

    const STANDARD = {
        nyflikLank: true,
        mittenklick: true,
        autoHamta: true,
        hoppaOverDatumvaljare: true,
        markerbartPersonnummer: true,
        dagensDatum: true,
        fokusDatum: true,
        kravAdress: true,
        blankettnamn: true,
        minnsMiljo: true,
        // Av som standard: Kbok laddar ner direkt, och den som vill ha
        // desktopklientens läge-först slår på det medvetet.
        visaBlankett: false,
        // Av som standard: förifyllningen är Kboks avsedda beteende, och
        // nästa söndag är rätt gissning i de flesta fall.
        tomPalysningsdatum: false,
        // Av som standard: att bekräfta ett verifikat är slutregistrering
        // och går inte att ångra. En fokuserad knapp plus ett reflexmässigt
        // Enter är en obehaglig kombination, så den som vill ha tillbaka
        // desktopklientens flöde slår på det medvetet.
        fokusBekraftaVerifikat: false,
        skrivUtVerifikat: true,
        sokbarPlats: true,
        avstamningTacksagelser: true,
        genvagarPa: true,
        kollaUppdatering: true,
    };

    const ETIKETTER = {
        nyflikLank: 'Länkikon som öppnar posten i ny flik',
        mittenklick: 'Mittenklick på en rad öppnar den i ny flik',
        autoHamta: 'Hämta personen automatiskt så fort personnumret är komplett',
        hoppaOverDatumvaljare: 'Tabba förbi kalenderknappen till nästa fält',
        markerbartPersonnummer: 'Personnumret går att markera utan att posten öppnas',
        dagensDatum: 'D i ett tomt datumfält fyller i dagens datum',
        fokusDatum: 'Sätt fokus i datumfältet vid in- och utträde',
        kravAdress: 'Stoppa Skapa verifikat när adressen saknas - Kbok kräver den bara i dop',
        blankettnamn: 'Döp om till handlingsdatum, typ och namn',
        minnsMiljo: 'Kom ihåg miljövalet, så det inte behöver göras om i varje ny flik',
        visaBlankett: 'Visa i en ruta i stället för att ladda ner direkt',
        tomPalysningsdatum: 'Förifyll inte nästa söndag som pålysningsdatum - lämna fältet tomt',
        fokusBekraftaVerifikat: 'Sätt fokus på Bekräfta verifikat när dialogen öppnas, så Enter bekräftar',
        skrivUtVerifikat: 'Skriv ut-ikon på öppnade verifikat, och utskrift på en sida',
        sokbarPlats: 'Platslistan visar bara de kyrkor som matchar det du skriver',
        avstamningTacksagelser: 'Fliken Avstämning i Pålysningsboken - dödsfall som saknar pålysning',
        genvagarPa: 'Genvägarna är på',
        kollaUppdatering: 'Säg till när en ny version finns - frågar GitHub en gång per dygn',
    };

    /* Inställningarna grupperas efter var de märks, i stället för att ligga
     * i en enda lista. Genvägsbrytaren hör till genvägsrubriken och ligger
     * där; fokusinställningen står sist, ensam, eftersom den gör Enter till
     * en slutregistrering. */
    const GRUPPER = [
        { rubrik: 'Träfflistor',
          nycklar: ['nyflikLank', 'mittenklick', 'markerbartPersonnummer'] },
        { rubrik: 'Formulär',
          nycklar: ['autoHamta', 'hoppaOverDatumvaljare', 'dagensDatum',
              'fokusDatum', 'kravAdress', 'tomPalysningsdatum', 'sokbarPlats'] },
        { rubrik: 'Blanketter och rapporter',
          nycklar: ['blankettnamn', 'visaBlankett', 'skrivUtVerifikat'] },
        { rubrik: 'Pålysningsbok',
          nycklar: ['avstamningTacksagelser'] },
        { rubrik: 'Utbildningsmiljön',
          nycklar: ['minnsMiljo'] },
        { rubrik: 'Tillägget',
          nycklar: ['kollaUppdatering'] },
    ];

    /* ---------- Tangentbordsgenvägar ----------
     *
     * Desktopklientens kortkommandon, flyttade till tangenter som
     * webbläsaren inte redan använder. Ctrl+W (skapa verifikat) hade
     * stängt fliken; funktionen ligger därför på Ctrl+Ö, som i gamla Kbok
     * var "Töm alla fält".
     */

    const KOMMANDON = {
        skapaVerifikat: {
            etikett: 'Skapa verifikat',
            standard: 'Ctrl+Ö',
            gammal: 'Ctrl+W i gamla Kbok - kan inte användas, stänger fliken',
            kor: () => klickaKnappMedText('Skapa verifikat'),
        },
        bytForsamling: {
            etikett: 'Byt församling',
            standard: 'F8',
            gammal: 'F8 i gamla Kbok',
            kor: bytForsamling,
        },
        spara: {
            etikett: 'Spara',
            standard: 'Ctrl+S',
            gammal: 'Ctrl+S i gamla Kbok - blockerar webbläsarens Spara sidan',
            kor: klickaSpara,
        },
        uttrade: {
            etikett: 'Utträde',
            standard: 'Ctrl+U',
            gammal: 'Ctrl+U i gamla Kbok - blockerar webbläsarens Visa källkod',
            kor: () => klickaKnappMedText('Utträde'),
        },
        blankett: {
            etikett: 'Blankett för handlingen',
            standard: 'F9',
            gammal: 'Fanns inte i gamla Kbok',
            kor: hamtaAktuellBlankett,
        },
        // Den enda genvägen som gör något oåterkalleligt. De övriga går att
        // backa - ett verifikat kan avvisas, ett formulär stängas - men en
        // bekräftelse är slutregistrering. Markeras därför i panelen.
        bekraftaVerifikat: {
            etikett: 'Bekräfta verifikat',
            standard: 'Ctrl+B',
            gammal: 'Fanns inte i gamla Kbok',
            varning: true,
            kor: () => klickaKnappMedText('Bekräfta verifikat'),
        },
    };

    /* Blanketten för den handling man står i.
     *
     * Den valda fliken bär handlingens namn med "bok" på slutet - Dopbok,
     * Vigselbok, Begravningsbok - och blanketten heter samma sak med
     * "blankett" i stället. Det gör att vigsel och välsignelse går att skilja
     * åt, trots att de delar URL: fliken heter Vigselbok respektive
     * Välsignelsebok.
     *
     * Blanketten hämtas genom att öppna Rapporter-menyn och klicka posten,
     * alltså samma väg som för hand. Filnamnsbytet och visningsrutan gäller
     * därför utan att den här funktionen behöver veta om dem.
     */

    function aktuellBlankett() {
        const vald = [...document.querySelectorAll('[role="tab"]')].find(
            (t) => t.getAttribute('aria-selected') === 'true');
        const namn = vald ? (vald.innerText || '').trim() : '';
        // Personakt-fliken slutar inte på "bok" och har ingen blankett.
        return /bok$/.test(namn) ? `${namn.replace(/bok$/, '')}blankett` : null;
    }

    function hamtaAktuellBlankett() {
        const blankett = aktuellBlankett();
        if (!blankett) return false;
        if (!klickaKnappMedText('Rapporter')) return false;
        vantaPa(() => [...document.querySelectorAll('[role="menuitem"]')].find(
            (m) => (m.innerText || '').trim() === blankett))
            .then((post) => post.click())
            .catch(() => {
                // Blanketten finns inte i menyn - stäng den i stället för att
                // lämna den öppen över sidan.
                document.dispatchEvent(new KeyboardEvent('keydown',
                    { key: 'Escape', bubbles: true }));
                console.warn(`svk-kbok-enhancements: hittade inte ${blankett}`);
            });
        return true;
    }

    function beskrivTangent(e) {
        const delar = [];
        if (e.ctrlKey) delar.push('Ctrl');
        if (e.altKey) delar.push('Alt');
        if (e.shiftKey) delar.push('Shift');
        if (e.metaKey) delar.push('Meta');
        let tangent = e.key;
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(tangent)) return null;
        if (tangent === ' ') tangent = 'Space';
        if (tangent.length === 1) tangent = tangent.toUpperCase();
        delar.push(tangent);
        return delar.join('+');
    }

    /* Bara synliga knappar räknas, och ligger någon i en öppen dialog tas
     * den sist öppnade. Utan det hade Ctrl+B kunnat träffa en knapp som är på
     * väg ut i en stängningsanimation, eller en som ligger bakom Kbok Plus-
     * panelen - och Bekräfta verifikat går inte att ångra. */
    function klickaKnappMedText(text) {
        if (document.getElementById('svk-kbok-panel')) return false;
        const synliga = [...document.querySelectorAll('button')].filter(
            (b) => (b.innerText || '').trim() === text && !b.disabled
                && b.offsetParent !== null && !b.closest('[aria-hidden="true"]'));
        const iDialog = synliga.filter((b) => b.closest('[role="dialog"]'));
        const knapp = iDialog.length ? iDialog[iDialog.length - 1] : synliga[0];
        if (knapp) {
            knapp.click();
            return true;
        }
        return false;
    }

    /* Spara-knappen heter olika beroende på formulär: "Spara" i de kyrkliga
     * handlingarna, "Spara inträde" och "Spara anteckning" under Inträden,
     * "Spara preliminära" i konfirmationsgrupper. Exakt träff först, annars
     * den som börjar med Spara - men aldrig "Spara preliminära", som skapar
     * poster för en hel grupp och inte bör gå att utlösa av misstag.
     */
    function klickaSpara() {
        if (klickaKnappMedText('Spara')) return true;
        const knapp = [...document.querySelectorAll('button')].find((b) => {
            const txt = (b.innerText || '').trim();
            return /^Spara /.test(txt) && txt !== 'Spara preliminära' && !b.disabled;
        });
        if (knapp) {
            knapp.click();
            return true;
        }
        return false;
    }

    function bytForsamling() {
        // Ligger i menyn under avataren längst till höger i sidhuvudet.
        const banner = document.querySelector('header, [role="banner"]');
        if (!banner) return false;
        const knappar = [...banner.querySelectorAll('button')];
        const avatar = knappar[knappar.length - 1];
        if (!avatar) return false;
        avatar.click();
        setTimeout(() => {
            const post = [...document.querySelectorAll('span, li, div')].find(
                (el) => (el.textContent || '').trim() === 'Byt församling');
            if (post) post.click();
        }, 350);
        return true;
    }

    function hanteraGenvag(e) {
        if (!installningar.genvagarPa) return;
        // Låt formulärfält vara i fred, utom vid kombinationer med Ctrl/Alt.
        const mal = e.target;
        const iFalt = mal && /^(INPUT|TEXTAREA|SELECT)$/.test(mal.tagName);
        if (iFalt && !e.ctrlKey && !e.altKey && !e.metaKey) return;

        const tryckt = beskrivTangent(e);
        if (!tryckt) return;
        for (const [nyckel, kmd] of Object.entries(KOMMANDON)) {
            const bunden = (installningar.genvagar || {})[nyckel] || kmd.standard;
            if (bunden && bunden === tryckt) {
                if (kmd.kor()) e.preventDefault();
                return;
            }
        }
    }

    function lasInstallningar() {
        try {
            return { ...STANDARD, ...JSON.parse(localStorage.getItem(NYCKEL) || '{}') };
        } catch (e) {
            return { ...STANDARD };
        }
    }

    let installningar = lasInstallningar();

    function sparaInstallningar() {
        localStorage.setItem(NYCKEL, JSON.stringify(installningar));
    }

    // Id:n kommer ur data-id och API-svar. Bara heltal får bli en del av
    // en adress - annat hade kunnat styra länken någon annanstans.
    function arId(v) {
        return /^\d+$/.test(String(v ?? ''));
    }

    function personaktUrl(id) {
        return arId(id) ? `${location.origin}/personakt/${id}` : null;
    }

    /* ---------- Länkikon per rad ----------
     *
     * Alla träfflistor är samma sorts DataGrid och bär data-id på raden, men
     * id:t betyder olika saker:
     *
     *   Sök personer     data-id 21070    personaktens id
     *   Ministerialbok   data-id 4318026  blankettnumret
     *   Verifikat        data-id 27708792 verifikatets id
     *   Alla församlingar                 församlingens id
     *
     * En länk byggd på fel id pekar på en personakt som inte finns. Att bara
     * kräva en personnummerkolumn räckte inte - Ministerialboken har en, men
     * dess data-id är blankettnumret, och personaktens id finns inte någon-
     * stans i raden. Där går länken alltså inte att bygga alls.
     *
     * Kolumnernas data-field skiljer listorna åt. Sök personer använder
     * versaler (PERSNR, NAMN, ADRESS), Ministerialboken och Pålysningsboken
     * gemener (personnummer, namn). PERSNR betyder alltså att radens data-id
     * är personaktens id och går att länka rakt av.
     *
     * För de övriga finns id:t ändå - bara inte i DOM:en. Listans API-svar
     * (SearchMinisterialbokPrel) bär personid för varje post, sida vid sida
     * med kyrklighandlingsId som blir radens data-id:
     *
     *   {"namn": "Svensson, Roger", "personid": 21068,
     *    "kyrklighandlingsId": 4318026, ...}
     *
     * Svaren fångas därför när de passerar och paras ihop med raderna. Appen
     * hämtar med XMLHttpRequest, inte fetch, så patchen sitter där.
     */

    // kyrklighandlingsId (radens data-id) -> {personid, kod}
    const HANDLING = new Map();

    /* Handlingstypens kod ur API-svaret styr vilken vy appen öppnar. Mätt
     * genom att dubbelklicka en rad av varje typ och läsa URL:en:
     *
     *   D  ->  /personakt/<id>/dop
     *   K  ->  /personakt/<id>/konf
     *   B  ->  /personakt/<id>/begravning
     *   V  ->  /personakt/<id>/vigsel?kyrklighandlingsId=<handlingens id>
     *
     * Välsignelse har också kod V och samma vy - den lagras som en vigsel.
     * Vigsel och välsignelse gäller två personer och delar vy, så handlingens
     * id måste med i frågesträngen för att rätt post ska öppnas.
     */
    const HANDLINGSVY = { D: 'dop', K: 'konf', B: 'begravning', V: 'vigsel' };

    function fangaPersonid() {
        const original = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (metod, url, ...resten) {
            kommIhagApiBas(url);
            // Bara ministerialbokens sökning. Andra sökanrop returnerar också
            // paginatedResults - FetchVerifikatBySearchlist och
            // SearchKyrkoperson - men med andra id-rymder, och en träff där
            // hade kunnat para ihop en rad med fel person.
            if (/SearchMinisterialbok/i.test(String(url))) {
                this.addEventListener('load', () => {
                    let poster;
                    try {
                        poster = JSON.parse(this.responseText).paginatedResults;
                    } catch (e) {
                        // Svaret är inte den JSON vi väntade oss. Patchen ligger
                        // på varje sökanrop, så andra svarsformer är väntade och
                        // inte värda ett larm - länkikonen uteblir bara.
                        return;
                    }
                    if (!Array.isArray(poster)) return;
                    // Kartan växer med varje sökning under en arbetsdag. Ett
                    // tak håller den liten; raderna söks om ändå.
                    if (HANDLING.size > 5000) HANDLING.clear();
                    poster.forEach((post) => {
                        if (post && arId(post.kyrklighandlingsId) && arId(post.personid)) {
                            HANDLING.set(String(post.kyrklighandlingsId), {
                                personid: String(post.personid),
                                kod: (post.handlingstyp || {}).kod,
                            });
                        }
                    });
                });
            }
            return original.call(this, metod, url, ...resten);
        };
    }

    function lankmalFor(rad) {
        const id = rad.getAttribute('data-id');
        if (!arId(id)) return null;
        // Sök personer: radens id ÄR personaktens, och där finns ingen
        // handling att öppna.
        if (arPersonlista(rad)) return personaktUrl(id);
        const post = HANDLING.get(id);
        if (!post) return null;
        const vy = HANDLINGSVY[post.kod];
        // Okänd handlingstyp: personakten är bättre än ingen länk alls.
        const bas = personaktUrl(post.personid);
        if (!bas || !vy) return bas;
        const fraga = post.kod === 'V' ? `?kyrklighandlingsId=${id}` : '';
        return `${bas}/${vy}${fraga}`;
    }

    function gridArPersonlista(grid) {
        // Griden byggs om vid filtrering och sidbyte, men rubrikerna är
        // desamma - svaret cachas så det inte räknas ut per rad.
        if (grid.dataset.svkKbokPersonlista === undefined) {
            const har = [...grid.querySelectorAll('[role="columnheader"]')].some(
                (h) => h.getAttribute('data-field') === 'PERSNR');
            grid.dataset.svkKbokPersonlista = har ? '1' : '0';
        }
        return grid.dataset.svkKbokPersonlista === '1';
    }

    function arPersonlista(rad) {
        let el = rad;
        for (let i = 0; i < 12 && el.parentElement; i++) {
            el = el.parentElement;
            if (el.getAttribute && el.getAttribute('role') === 'grid') {
                return gridArPersonlista(el);
            }
        }
        return false;
    }

    // Material Designs open_in_new, samma formspråk som Kboks egna ikoner.
    const NYFLIK_IKON = '<svg viewBox="0 0 24 24" width="15" height="15" '
        + 'fill="currentColor" aria-hidden="true">'
        + '<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 '
        + '2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>'
        + '</svg>';

    function laggTillLank(rad) {
        if (rad.querySelector('.' + LANK_KLASS)) return;
        const mal = lankmalFor(rad);
        if (!mal) return;
        const forsta = rad.querySelector('[role="gridcell"]');
        if (!forsta) return;

        // Egen cell i stället för att tränga in ikonen i kryssrutekolumnen,
        // där den skars av. Griden formaterar celler efter role och inline
        // width, så en klonad struktur räcker - vi rör inte gridens egen
        // kolumnmodell.
        const cell = document.createElement('div');
        cell.className = LANK_KLASS + ' MuiDataGrid-cell';
        cell.setAttribute('role', 'gridcell');
        cell.style.cssText = `width:${KOLUMNBREDD}px;min-width:${KOLUMNBREDD}px;`
            + `max-width:${KOLUMNBREDD}px;display:flex;align-items:center;`
            + 'justify-content:center;padding:0';

        const a = document.createElement('a');
        a.href = mal;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = arPersonlista(rad)
            ? 'Öppna personakten i ny flik'
            : 'Öppna ministerialboksposten i ny flik';
        a.innerHTML = NYFLIK_IKON;
        a.style.cssText = 'text-decoration:none;line-height:0;display:flex;'
            + 'opacity:.45;cursor:pointer;color:inherit;padding:3px 4px';
        a.addEventListener('mouseenter', () => { a.style.opacity = '1'; });
        a.addEventListener('mouseleave', () => { a.style.opacity = '.45'; });
        // Griden lyssnar på klick i raden för att markera och öppna - hindra
        // att länkklicket också räknas som ett radklick.
        ['click', 'mousedown', 'dblclick'].forEach((h) =>
            a.addEventListener(h, (e) => e.stopPropagation()));

        cell.appendChild(a);
        forsta.parentElement.insertBefore(cell, forsta);
    }

    function laggTillKolumnrubrik() {
        // Per grid, inte första bästa rubrikrad på sidan: startsidan visar
        // tre verifikatlistor som inte får någon ikon, och en rubrikcell där
        // hade blivit en tom kolumn utan innehåll.
        document.querySelectorAll('[role="grid"]').forEach((grid) => {
            // Rubriken hör ihop med ikonen: bara där någon rad faktiskt får
            // en, annars blir kolumnen tom.
            const rader = [...grid.querySelectorAll(RAD)];
            if (!rader.some(lankmalFor)) return;
            const rubrikrad = grid.querySelector('[role="columnheader"]');
            if (!rubrikrad || !rubrikrad.parentElement) return;
            const rad = rubrikrad.parentElement;
            if (rad.querySelector('.' + LANK_KLASS)) return;
            const cell = document.createElement('div');
            cell.className = LANK_KLASS + ' MuiDataGrid-columnHeader';
            cell.setAttribute('role', 'columnheader');
            cell.style.cssText = `width:${KOLUMNBREDD}px;min-width:${KOLUMNBREDD}px;`
                + `max-width:${KOLUMNBREDD}px;padding:0`;
            rad.insertBefore(cell, rad.firstChild);
        });
    }

    function taBortLankar() {
        document.querySelectorAll('.' + LANK_KLASS).forEach((el) => el.remove());
    }

    /* ---------- Mittenklick var som helst på raden ----------
     *
     * Två händelser, olika uppgifter. mousedown hindrar bara webbläsarens
     * autoscroll; det är auxclick som öppnar fliken. Att låta båda öppna
     * gav två flikar per klick - och när de öppnades samtidigt tappade
     * appen dessutom sessionen och båda landade på miljöväljaren.
     */

    function radUnder(e) {
        if (!installningar.mittenklick || e.button !== 1) return null;
        const rad = e.target.closest(RAD);
        // Samma id-fälla som länkikonen: verifikatlistornas data-id är inte
        // en personakt, och Ministerialbokens är blankettnumret.
        return rad && lankmalFor(rad) ? rad : null;
    }

    function hindraAutoscroll(e) {
        if (radUnder(e)) e.preventDefault();
    }

    function oppnaViaMittenklick(e) {
        const rad = radUnder(e);
        if (!rad) return;
        e.preventDefault();
        window.open(lankmalFor(rad), '_blank', 'noopener');
    }

    /* ---------- Auto-hämta relationspersoner ----------
     *
     * Fälten vardnadshavare1.persnr, vardnadshavare2.persnr,
     * relationsperson i Begravning och Person 1 i pålysningsformuläret har
     * en NAMNLÖS ikonknapp bredvid sig som måste klickas för att namnet ska
     * hämtas. Skrivs bara personnumret förblir namnet tomt, och i
     * pålysningsformuläret misslyckas Spara sedan helt utan felmeddelande.
     *
     * Huvudsökningen (searchPersonnummer) och personuppgiftssektionen
     * (huvudperson.*) lämnas ifred - där är knapparna tydligt märkta
     * "Hämta" respektive "Hämta uppgifter igen".
     */

    const KOMPLETT_PNR = /^(\d{8}|\d{6})-?\d{4}$/;

    /* Att ta första bästa knapp i föräldrakedjan träffar fel i flera vyer.
     *
     * Värst: MUI lägger en namnlös kryssknapp inuti fältet så fort det har ett
     * värde, alltså precis när auto-hämtningen ska gå igång. Den låg närmare
     * fältet än Hämta-knappen och klickades i stället - vilket rensade fältet
     * utan att hämta någon. Det syntes på Inträde, där personnumret försvann
     * och inget namn kom fram.
     *
     * Dessutom: startsidan har "Sök" närmast fältet, som navigerar iväg, och
     * en öppnad handling har "Hämta uppgifter igen från folkbokföringen", som
     * skriver över redigerade uppgifter. Ingen av dem ska klickas automatiskt.
     *
     * Kvar att klicka: knappen med texten Hämta, och relationsfältens namnlösa
     * hämtikon.
     */

    function arHamtaKnapp(knapp) {
        const text = (knapp.innerText || '').trim();
        const etikett = (knapp.getAttribute('aria-label') || '').trim();
        if (text === 'Hämta') return true;
        if (text || etikett) return false;
        const ikon = knapp.querySelector('svg');
        return !ikon || ikon.getAttribute('data-testid') !== 'ClearIcon';
    }

    function hittaHamtaKnapp(falt) {
        let el = falt;
        for (let i = 0; i < 5 && el; i++) {
            el = el.parentElement;
            if (!el) break;
            // Leta vidare uppåt förbi knappar som inte hämtar - kryssknappen
            // sitter närmast fältet och hade annars stoppat sökningen.
            const knapp = [...el.querySelectorAll('button')].find(arHamtaKnapp);
            if (knapp) return knapp;
        }
        return null;
    }

    function arRelationsfalt(falt) {
        const id = (falt.id || '').toLowerCase();
        if (!/persnr|personnummer/.test(id)) return false;
        // Sökfältet ska inte söka av sig självt medan man skriver.
        if (id === 'searchpersonnummer') return false;
        // Huvudpersonens fält har knappen "Hämta uppgifter igen från
        // folkbokföringen", som skriver över redigerade uppgifter.
        // arHamtaKnapp sållar bort den på etiketten, men avsikten hör hemma
        // här också - annars beror skyddet på att ett annat lager råkar
        // fånga just den knappen.
        //
        // Pålysningsformuläret är undantaget från undantaget: dess Person 1
        // heter också huvudperson1.persnr, men där är knappen en vanlig
        // hämtning och det finns inga uppgifter att skriva över. Samma
        // prefix, två betydelser - och just det fältet är det som kostar
        // mest att missa, eftersom Spara inte säger något när namnet
        // saknas.
        if (/^huvudperson/.test(id) && !arPalysningsformular()) return false;
        return true;
    }

    function arPalysningsformular() {
        return /^\/palysning(\/|$)/.test(location.pathname);
    }

    function kopplaAutoHamta(falt) {
        if (falt.dataset.svkKbokKopplad) return;
        falt.dataset.svkKbokKopplad = '1';
        // Lyssnar på input, inte change: change fyrar när fältet tappar fokus,
        // vilket är precis vad ett eget klick på Hämta gör. Skriptets klick
        // blev då ett andra klick mitt i appens hämtning, och fältet
        // rensades utan att någon person hämtades.
        falt.addEventListener('input', () => {
            if (!installningar.autoHamta) return;
            const varde = (falt.value || '').trim();
            if (!KOMPLETT_PNR.test(varde)) return;
            // En hämtning per inskrivet nummer - annars utlöser varje
            // efterföljande tangenttryck en ny.
            if (falt.dataset.svkKbokHamtat === varde) return;
            falt.dataset.svkKbokHamtat = varde;
            // Kort fördröjning: appen läser sitt eget tillstånd, inte
            // fältets värde, och hinner inte uppdatera det inom samma tick.
            // Väntan ger också ett eget klick på Hämta tid att inaktivera
            // knappen, så skriptet inte klickar en andra gång.
            setTimeout(() => {
                if ((falt.value || '').trim() !== varde) return;
                const knapp = hittaHamtaKnapp(falt);
                if (knapp && !knapp.disabled) knapp.click();
            }, 250);
        });
    }

    /* ---------- D fyller i dagens datum ----------
     *
     * Fanns i desktopklienten: "D eller d - Dagens datum när markören står
     * i ett datumfält". Gäller alla fält som tar ett datum, inte bara
     * handlingsdatum - även Utträdesdatum, dödsdatum och pålysningsdatum.
     *
     * Fälten skiljer sig i format: de flesta vill ha ÅÅÅÅ-MM-DD, men
     * dödsdatum tar ÅÅÅÅMMDD utan bindestreck. Formatet läses därför ur
     * fältets placeholder i stället för att antas.
     */

    function arDatumfalt(falt) {
        if (falt.tagName !== 'INPUT') return false;
        const ph = falt.placeholder || '';
        const id = falt.id || '';
        if (/ÅÅÅÅ/.test(ph)) return !/NNNN/.test(ph); // personnummerfält har NNNN
        return /datum/i.test(id) && !/persnr/i.test(id);
    }

    function dagensDatumFor(falt) {
        const nu = new Date();
        const p = (n) => String(n).padStart(2, '0');
        const ar = nu.getFullYear();
        const man = p(nu.getMonth() + 1);
        const dag = p(nu.getDate());
        const ph = falt.placeholder || '';
        // Utan bindestreck om placeholdern saknar dem, t.ex. dödsdatumets
        // ÅÅÅÅMMDD.
        return ph.includes('-') || !ph ? `${ar}-${man}-${dag}` : `${ar}${man}${dag}`;
    }

    function skrivDagensDatum(falt) {
        const varde = dagensDatumFor(falt);

        // MUI:s DateField har en egen mask och bryr sig inte om ett värde
        // som sätts via prototypens setter - fältet stod kvar på ÅÅÅÅ-MM-DD.
        // execCommand skriver som en användare gör, så masken hinner
        // formatera, och React ser en riktig input-händelse.
        falt.focus();
        falt.setSelectionRange(0, (falt.value || '').length);
        if (document.execCommand('insertText', false, varde)) return;

        // Fallback för fält utan mask, och för webbläsare som slutat stödja
        // execCommand.
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value').set;
        setter.call(falt, varde);
        falt.dispatchEvent(new Event('input', { bubbles: true }));
        falt.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function hanteraDagensDatum(e) {
        if (!installningar.dagensDatum) return;
        if (e.key !== 'd' && e.key !== 'D') return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        const falt = e.target;
        if (!arDatumfalt(falt)) return;
        // Bokstaven hör aldrig hemma i ett datum, så den blockeras alltid -
        // annars hamnade ett "d" i fältet när det redan var ifyllt.
        e.preventDefault();

        // Fyll bara i tomt fält, annars skrivs ett påbörjat datum över.
        // MUI:s DateField sätter värdet till sin egen mask (ÅÅÅÅ-MM-DD) så
        // fort fältet får fokus, så ett fält som ser tomt ut har ett värde -
        // därför räknas "tomt" som "innehåller ingen siffra".
        if (/\d/.test(falt.value || '')) return;
        skrivDagensDatum(falt);
    }

    /* ---------- Töm förifyllt pålysningsdatum ----------
     *
     * Kbok förifyller Pålysningsdatum med nästa söndag. Rimligt i
     * normalfallet, men fel så fort pålysningen gäller en annan dag - och då
     * måste värdet skrivas över varje gång. Desktopklienten lät en välja.
     *
     * Fältets id är genererat av MUI (:r3d: och liknande), så det hittas via
     * etiketten i stället.
     */

    function faltForEtikett(etikett) {
        const label = [...document.querySelectorAll('label')].find(
            (l) => l.textContent.trim() === etikett);
        if (!label) return null;
        const id = label.getAttribute('for');
        if (id) return document.getElementById(id);
        // Utan for-attribut: fältet ligger i samma formulärgrupp.
        const grupp = label.closest('.MuiFormControl-root, .MuiTextField-root');
        return grupp ? grupp.querySelector('input') : null;
    }

    function tomPalysningsdatum() {
        if (!installningar.tomPalysningsdatum) return;
        if (!/\/palysning\//.test(location.pathname)) return;
        const falt = faltForEtikett('Pålysningsdatum');
        if (!falt) return;

        if (!falt.dataset.svkKbokTomt) {
            if (!(falt.value || '').trim()) return;
            falt.dataset.svkKbokTomt = '1';
            // Tömningen görs med events så att appens eget tillstånd följer
            // med - annars ser fältet tomt ut medan det förifyllda datumet
            // ligger kvar internt och sparas i tysthet.
            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value').set;
            setter.call(falt, '');
            falt.dispatchEvent(new Event('input', { bubbles: true }));
            falt.dispatchEvent(new Event('change', { bubbles: true }));
            // Så fort användaren rör fältet ska valideringen bete sig
            // normalt igen.
            const slappFri = () => { falt.dataset.svkKbokRord = '1'; };
            falt.addEventListener('input', slappFri, { once: true });
            falt.addEventListener('blur', slappFri, { once: true });
        }

        // Tömningen utlöser "Pålysningsdatum måste anges" direkt, innan
        // användaren hunnit skriva något. Felet döljs tills fältet rörts -
        // då får appen visa det som vanligt, inklusive när Spara vägrar.
        if (falt.dataset.svkKbokRord) return;
        doljFelFor(falt);
    }

    function doljFelFor(falt) {
        const grupp = falt.closest('.MuiFormControl-root, .MuiTextField-root');
        if (!grupp) return;
        grupp.querySelectorAll('.Mui-error').forEach((el) => {
            el.classList.remove('Mui-error');
            el.dataset.svkKbokDoltFel = '1';
        });
        const hjalp = grupp.querySelector('.MuiFormHelperText-root');
        if (hjalp && /måste anges/i.test(hjalp.textContent || '')) {
            hjalp.dataset.svkKbokDoltFel = '1';
            hjalp.style.visibility = 'hidden';
        }
    }

    /* ---------- Adressen obligatorisk i alla kyrkliga handlingar ----------
     *
     * Kbok stoppar verifikatet om adressen saknas i Dop, men släpper igenom
     * Konfirmation, Vigsel, Välsignelse och Begravning - trots att postadress
     * och folkbokföringsadress ska registreras för varje kyrklig handling
     * enligt SvKB 2009:9, 3 kap.
     *
     * Kontrollen sitter på Skapa verifikat, inte på Spara. Det speglar hur
     * dopet redan fungerar: den preliminära posten får skapas, men verifikatet
     * stoppas tills adressen finns. Att blockera Spara hade hindrat själva
     * registreringen, vilket är ett större ingrepp än Kbok själv gör.
     *
     * Adressen visas som en sektion med rubriken "Adress vid <handling>" i
     * ett h6, följd av gatuadress och postort. Saknas adressen står rubriken
     * ensam - det är hela signalen, och den är entydig:
     *
     *   med adress:  ['Adress vid begravning', 'Bagarfruv 126', '46290 Hjortnäs']
     *   utan:        ['Adress vid dop']
     *
     * Postnumret och orten står kvar även när gatuadressen tagits bort, och
     * det är gatuadressen Kbok kontrollerar - fältet Adress. En sektion som
     * bara innehåller ['Adress vid vigsel', '46230 Hjortnäs'] saknar alltså
     * adress, trots att den har mer än rubriken.
     *
     * Hur djupt adressen ligger under rubriken varierar mellan handlingarna:
     * i vigsel sitter den i rubrikens egen förälder, i begravning fyra
     * nivåer upp. Sökningen går därför uppåt tills den hittar mer än
     * rubriken - men stannar så fort personuppgifterna omkring börjar synas,
     * för då har den gått för långt och skulle räkna dem som adress.
     *
     * Dop undantas: där gör Kbok redan kontrollen, och två varningar om samma
     * sak vore bara förvirrande.
     *
     * Att kontrollen sitter på Skapa verifikat gör också att den aldrig kan
     * träffa personakten, som inte har någon sådan knapp.
     */

    const ADRESSFEL = 'svk-kbok-adressfel';

    function adressektioner() {
        const rot = document.querySelector('main');
        if (!rot) return [];
        return [...rot.querySelectorAll('*')].filter(
            (el) => el.children.length === 0
                && /^Adress vid /.test((el.textContent || '').trim()));
    }

    // Rubriker som betyder att vi lämnat adressektionen och är uppe bland
    // personuppgifterna.
    const UTANFOR_ADRESS = /^(Personnummer|Person \d+|Personuppgifter|Status|Medlemstyp|Tilltalsnamn)$/;
    // "46230 Hjortnäs" - postnummer och ort, som står kvar utan gatuadress.
    const POSTRAD = /^\d{3}\s?\d{2}\s+\S/;

    function harAdress(rubrik) {
        let box = rubrik;
        for (let i = 0; i < 6 && box.parentElement; i++) {
            box = box.parentElement;
            const rader = (box.innerText || '').split('\n')
                .map((s) => s.trim()).filter(Boolean);
            if (rader.some((r) => UTANFOR_ADRESS.test(r))) return false;
            if (rader.length > 1) {
                // Gatuadressen är den rad som varken är rubriken eller
                // postnummer och ort.
                return rader.slice(1).some((r) => !POSTRAD.test(r));
            }
        }
        return false;
    }

    function saknadeAdresser() {
        return adressektioner().filter((rubrik) => {
            // Dopet sköts av Kbok självt.
            if (/^Adress vid dop$/i.test((rubrik.textContent || '').trim())) return false;
            return !harAdress(rubrik);
        });
    }

    /* Kbok visar samma sak i Dop som en ruta: "Kan inte skapa verifikat -
     * Adress måste anges". Den återskapas här i stället för en text vid
     * fältet, så att de fyra övriga handlingarna beter sig som dopet. */

    function visaAdressruta(antal) {
        if (document.getElementById(ADRESSFEL)) return;
        const overlay = document.createElement('div');
        overlay.id = ADRESSFEL;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;'
            + 'background:rgba(0,0,0,.35);display:flex;align-items:center;'
            + 'justify-content:center;padding:1.5rem';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;'
            + 'padding:1.4rem 1.6rem;max-width:26rem;width:100%;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,.25);'
            + 'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const rubrik = document.createElement('h2');
        rubrik.textContent = 'Kan inte skapa verifikat';
        rubrik.style.cssText = 'margin:0 0 .6rem;font-size:1.05rem';
        ruta.appendChild(rubrik);

        const text = document.createElement('p');
        text.textContent = antal > 1
            ? 'Adress måste anges för båda personerna.'
            : 'Adress måste anges.';
        text.style.cssText = 'margin:0 0 .4rem';
        ruta.appendChild(text);

        const varfor = document.createElement('p');
        varfor.textContent = 'Postadress och folkbokföringsadress ska registreras '
            + 'för varje kyrklig handling (SvKB 2009:9, 3 kap.).';
        varfor.style.cssText = 'margin:0 0 1.1rem;color:#6b6862;font-size:.87rem';
        ruta.appendChild(varfor);

        const rad = document.createElement('div');
        rad.style.cssText = 'display:flex;justify-content:flex-end';
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'OK';
        ok.style.cssText = 'padding:.45rem 1.4rem;border-radius:6px;cursor:pointer;'
            + `font:inherit;font-weight:600;background:${ACCENT};color:#fff;`
            + `border:1px solid ${ACCENT}`;
        ok.addEventListener('mouseenter', () => { ok.style.background = ACCENT_HOVER; });
        ok.addEventListener('mouseleave', () => { ok.style.background = ACCENT; });

        function stang() {
            overlay.remove();
            document.removeEventListener('keydown', viaTangent, true);
        }
        function viaTangent(e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                e.stopPropagation();
                stang();
            }
        }
        ok.addEventListener('click', stang);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) stang(); });
        document.addEventListener('keydown', viaTangent, true);

        rad.appendChild(ok);
        ruta.appendChild(rad);
        overlay.appendChild(ruta);
        document.body.appendChild(overlay);
        ok.focus();
    }

    function kravAdressVidVerifikat(e) {
        if (!installningar.kravAdress) return;
        const knapp = e.target.closest && e.target.closest('button');
        if (!knapp || (knapp.innerText || '').trim() !== 'Skapa verifikat') return;
        const saknade = saknadeAdresser();
        if (!saknade.length) return;
        // Stoppas i capture-fasen, innan appens egen hanterare hinner köra.
        e.preventDefault();
        e.stopImmediatePropagation();
        visaAdressruta(saknade.length);
        saknade[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    /* ---------- Fokus i datumfältet vid in- och utträde ----------
     *
     * Båda flödena är annars helt tangentbordsdrivna: skriv personnumret,
     * personen hämtas av sig själv, och sedan måste man ta musen för att nå
     * datumfältet.
     *
     * Vyerna skiljer sig. Utträdet har fältet på plats direkt när sidan
     * laddat, och där finns inget att flytta fokus ifrån. Inträdet visar
     * Inträdesdatum först när personen hämtats, alltså precis när
     * personnummerfältet gjort sitt - det är då fokus ska vidare.
     */

    function fokuseraDatumfalt() {
        if (!installningar.fokusDatum) return;
        let etikett = null;
        if (/\/uttrade$/.test(location.pathname)) etikett = 'Utträdesdatum';
        else if (/in-och-uttraden/.test(location.pathname)) etikett = 'Inträdesdatum';
        if (!etikett) return;

        const falt = faltForEtikett(etikett);
        // En gång per fält. uppdatera() körs vid varje DOM-ändring, och ett
        // fält som tar tillbaka fokus medan man skriver någon annanstans är
        // värre än inget fokus alls.
        if (!falt || falt.dataset.svkKbokFokuserad) return;

        // Flytta bara från de lägen där det är fokus vi vill lämna: ingenting
        // alls, Hämta-knappen, eller personnummerfältet som just gjort sitt.
        const aktiv = document.activeElement;
        const fårFlyttas = !aktiv || aktiv === document.body
            || aktiv.tagName === 'BUTTON'
            || /persnr|personnummer/i.test(aktiv.id || '');
        if (!fårFlyttas) return;

        falt.dataset.svkKbokFokuserad = '1';
        falt.focus();
    }

    /* ---------- Hoppa över kalenderknappen vid tabb ---------- */

    function stallInDatumTabb() {
        const pa = installningar.hoppaOverDatumvaljare;
        document.querySelectorAll('button[aria-label]').forEach((knapp) => {
            const etikett = knapp.getAttribute('aria-label') || '';
            if (!/^Välj datum|^Välj tid/.test(etikett)) return;
            if (pa) {
                if (knapp.getAttribute('tabindex') !== '-1') {
                    knapp.dataset.svkKbokTabindex = knapp.getAttribute('tabindex') || '';
                    knapp.setAttribute('tabindex', '-1');
                }
            } else if (knapp.dataset.svkKbokTabindex !== undefined) {
                const original = knapp.dataset.svkKbokTabindex;
                if (original) knapp.setAttribute('tabindex', original);
                else knapp.removeAttribute('tabindex');
                delete knapp.dataset.svkKbokTabindex;
            }
        });
    }

    /* ---------- Filnamn på nedladdade blanketter ----------
     *
     * Kbok döper blanketterna till handlingstypen rakt av - Dopblankett.pdf,
     * Upptagandebevis.pdf. Utan datum och person går sparade blanketter inte
     * att skilja åt, och webbläsaren räknar i stället upp dem som (1), (2).
     *
     * PDF:en byggs i webbläsaren, inte på servern: appen skapar ett
     * <a download> mot en blob-URL, klickar det och tar bort det direkt, så
     * det finns inget element kvar att skriva om i DOM:en. Namnet går
     * däremot att fånga genom att patcha HTMLAnchorElement.prototype.click -
     * attributet skrivs om i klicket, innan originalanropet släpps igenom.
     *
     * Uppgifterna läses ur handlingspostens egna sektioner, inte ur
     * personuppgiftsraden högst upp: raden är tom för poster utan personakt,
     * sektionen är det aldrig. En platt skrapning av hela sidan fungerar
     * inte heller - den blandar in vårdnadshavare, relationspersoner och
     * hindersprövningsdatum.
     */

    // Handlingsdatumet hör till blanketterna, som är underlag inför en
    // handling. Bevisen gäller en händelse som redan är registrerad och får
    // därför bara typ och namn.
    const BLANKETTER = ['Dopblankett', 'Konfirmationsblankett', 'Vigselblankett',
        'Välsignelseblankett', 'Begravningsblankett'];
    const BEVIS = ['Upptagandebevis', 'Utträdesbevis'];

    /* Bevisen finns i två varianter, med och utan adress, och Kbok döper
     * filerna därefter - Upptagandebevis_med_adress.pdf. Varianten säger
     * inget om vad beviset gäller, bara hur det är utformat, så båda får
     * grundnamnet. Kboks egen term behålls: Upptagandebevis, inte
     * Inträdesbevis.
     *
     * Suffixet matchas både med mellanslag och understreck, eftersom
     * menyposten och filnamnet skrivs olika.
     */
    function bevisnamn(typ) {
        const utan = typ.replace(/[_ ]med[_ ]adress$/i, '');
        return BEVIS.indexOf(utan) >= 0 ? utan : null;
    }

    /* Personaktens Rapporter-meny har 29 poster - alla rapportmallar med
     * selectionIdType PersonId. Kbok döper dem till mallens namn rakt av, så
     * två uttag blir Medlemsbevis.pdf och Medlemsbevis (1).pdf.
     *
     * Menyetiketten och filnamnet skiljer sig bara på att mellanslag blir
     * understreck - verifierat på sju av dem, inklusive en med bindestreck
     * och en med "på Engelska".
     *
     * De fyra Namn- och adresslista-varianterna står medvetet utanför: de är
     * urval, inte en person, och har ingen huvudperson att döpa efter.
     * Dopinbjudan är med, men får sitt datum ur rutan den frågar i - se
     * kommIhagDopinbjudan().
     */
    const PERSONRAPPORTER = [
        'Anmälan inträde',
        'Anmälan utträde',
        'Anmälan utträde för barn U18',
        'Begäran borttag av anteckning',
        'Dopinbjudan',
        'Följebrev utträdesanmälan via epost',
        'Förfrågan - meddelande inför konfirmation',
        'Förfrågan om medlemskap barn',
        'Förfrågan om medlemskap vuxna',
        'Information inför 18-årsdagen',
        'Meddelande om inträde barn',
        'Medlemsbevis',
        'Medlemsbevis på Engelska',
        'Registerutdrag utan familj',
        'Registerutdrag med familj',
        'Registerutdrag med familj på engelska',
        'Välkomstmeddelande',
    ];

    function personrapportnamn(typ) {
        // Suffixet "med adress" säger hur rapporten är utformad, inte vad den
        // gäller - samma resonemang som för bevisen, alltså samma grundnamn.
        // "med familj" är däremot en egen rapport och får stå kvar.
        const utan = typ.replace(/_/g, ' ').replace(/ med adress$/i, '');
        return PERSONRAPPORTER.indexOf(utan) >= 0 ? utan : null;
    }

    /* Rapporterna gäller läget den dag de togs ut - ett medlemsbevis säger
     * vad som gällde då, inte vid någon registrerad händelse. Därför
     * uttagsdatum, till skillnad från blanketterna som får handlingsdatum och
     * bevisen som får händelsedatum.
     */
    function idagsDatum() {
        const nu = new Date();
        const tva = (n) => String(n).padStart(2, '0');
        return `${nu.getFullYear()}-${tva(nu.getMonth() + 1)}-${tva(nu.getDate())}`;
    }
    const GRUPPBLANKETT = 'Konfirmationsblankett_för_verksamhetsgrupp';
    const GRUPPNYCKEL = 'svk-kbok-gruppnamn';
    const GRUPPKALLA = 'svk-kbok-gruppkalla';

    function sektionMed(rubrik) {
        const rad = [...document.querySelectorAll('main *')].find(
            (el) => el.children.length === 0
                && (el.textContent || '').trim() === rubrik);
        if (!rad) return null;
        // Rubriken sitter några nivåer in i sektionen. Gå uppåt tills en
        // förälder rymmer mer än en handfull fält - då är sektionen med i sin
        // helhet, men inte hela sidan.
        let el = rad;
        for (let i = 0; i < 6 && el.parentElement; i++) {
            el = el.parentElement;
            if (el.querySelectorAll('p,span,div').length > 6) break;
        }
        return el;
    }

    function sektionsfalt(rot, etikett) {
        if (!rot) return null;
        const trad = [...rot.querySelectorAll('*')].find(
            (x) => x.children.length === 0
                && (x.textContent || '').trim() === etikett);
        if (!trad || !trad.parentElement) return null;
        const rader = (trad.parentElement.innerText || '').split('\n')
            .map((s) => s.trim()).filter(Boolean);
        const i = rader.indexOf(etikett);
        const varde = i >= 0 && rader[i + 1] ? rader[i + 1] : null;
        // Ett tomt fält visas som bindestreck.
        return varde && varde !== '-' ? varde : null;
    }

    // Snedstrecken kommer från Kbok självt: ett barn utan förnamn får
    // efternamnet skrivet som /Efternamn/, och snedstreck går inte att ha i
    // ett filnamn. Övriga tecken tas med av samma skäl.
    function rensaFilnamnsdel(varde) {
        return varde.replace(/[/\\:*?"<>|]/g, '-').trim();
    }

    function efternamnI(rubrik) {
        const varde = sektionsfalt(sektionMed(rubrik), 'Efternamn');
        return varde ? rensaFilnamnsdel(varde) : null;
    }

    function personnamnUr(rot) {
        if (!rot) return null;
        // Tilltalsnamnet är det personen faktiskt kallas; förnamnsfältet kan
        // rymma flera namn.
        const delar = [
            sektionsfalt(rot, 'Efternamn'),
            sektionsfalt(rot, 'Tilltalsnamn') || sektionsfalt(rot, 'Förnamn'),
        ].filter(Boolean).map(rensaFilnamnsdel);
        return delar.length ? delar.join(', ') : null;
    }

    function handlingensNamndel() {
        // Vigsel och välsignelse gäller två personer och har sektionerna
        // Person 1/Person 2 i stället för Personuppgifter. Där tas bara
        // efternamnen med - båda ska synas, och med förnamnen blir filnamnet
        // ohanterligt långt.
        const forsta = efternamnI('Person 1');
        if (forsta) {
            const andra = efternamnI('Person 2');
            return andra ? `${forsta}-${andra}` : forsta;
        }
        const enskild = personnamnUr(sektionMed('Personuppgifter'));
        if (enskild) return enskild;
        // Personakten saknar sektionsrubrik - där står namnet i raden högst
        // upp. Den läses sist: på en handlingspost utan personakt är raden
        // tom, och då ska sektionen ovan ha fått svara först.
        return personnamnUr(document.querySelector('main'))
            || ihagkommetNamn()
            || verifikatnamn();
    }

    /* Utträdesvyn visar namnet som löpande text - "Örjan Persson" följt av
     * "Tilltalsnamn: Örjan" - utan de fältetiketter resten av appen använder.
     * Att dela en sådan sträng i förnamn och efternamn går inte att göra rätt:
     * "Björn Erik Larsson" kan vara två förnamn eller ett dubbelt efternamn.
     *
     * Vyn nås bara via personakten, där namnet står i egna fält. Namnet tas
     * därför med dit, tillsammans med personnumret så att en kvarglömd post
     * inte kan sätta fel namn på någon annans bevis.
     */

    const PERSONNYCKEL = 'svk-kbok-person';

    /* Personnumret sparas inte i klartext - bara ett kort kontrollvärde som
     * räcker för att se att det ihågkomna namnet hör till den person som
     * visas. Uppgiften ligger i sessionStorage bara för att överleva sidbytet
     * till utträdesvyn, och ett kontrollvärde går inte att vända tillbaka. */
    function kontrollvarde(text) {
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(36);
    }

    function synligtPersonnummer() {
        const rot = document.querySelector('main');
        if (!rot) return null;
        const traff = (rot.innerText || '').match(/\b\d{8}-\d{4}\b/);
        return traff ? traff[0] : null;
    }

    function kommIhagPersonnamn() {
        if (!/^\/personakt\/\d+$/.test(location.pathname)) return;
        // Läsningen nedan gör flera fulla genomsökningar av main och tvingar
        // fram omritningar via innerText. uppdatera() körs vid varje
        // DOM-ändring, så utan den här spärren skulle samma namn läsas om vid
        // varje hovring och menyöppning. Samma mönster som kommIhagGruppnamn.
        const pnr = synligtPersonnummer();
        if (!pnr) return;
        const nyckel = kontrollvarde(pnr);
        try {
            const sparat = JSON.parse(sessionStorage.getItem(PERSONNYCKEL) || 'null');
            if (sparat && sparat.nyckel === nyckel) return;
        } catch (e) {
            // Trasigt värde: skriv över det nedan.
        }
        const namn = personnamnUr(document.querySelector('main'));
        if (namn) {
            sessionStorage.setItem(PERSONNYCKEL, JSON.stringify({ nyckel, namn }));
        }
    }

    /* Ett verifikat som bekräftas senare - via Aktuella på startsidan i
     * stället för direkt när det skapas - har ingen personakt bakom sig att
     * läsa namnet ur, och inget ihågkommet namn i fliken.
     *
     * Verifikatet visar uppgifterna självt, men namnet sammanskrivet som
     * "Tarja Persson" i stället för uppdelat i fält. Det får stå som det
     * står: att dela strängen går inte att göra rätt, och fallet är ett
     * undantag. Händelsedatumet finns däremot rent och hör till beviset -
     * det är ju den händelse beviset gäller.
     */

    function verifikatfalt(etikett) {
        const rotter = [...document.querySelectorAll('[role="dialog"]')];
        rotter.push(document.querySelector('main'));
        for (const rot of rotter) {
            const varde = rot && sektionsfalt(rot, etikett);
            if (varde) return varde;
        }
        return null;
    }

    function verifikatnamn() {
        const varde = verifikatfalt('Namn');
        return varde ? rensaFilnamnsdel(varde) : null;
    }

    function handelsedatum() {
        const varde = verifikatfalt('Händelsedatum');
        const traff = varde && varde.match(/\d{4}-\d{2}-\d{2}/);
        return traff ? traff[0] : null;
    }

    /* Tas beviset inte ut i verifikatets rapportruta får man hämta det från
     * personakten i efterhand, och där finns inget Händelsedatum. Akten bär
     * däremot tillhörighetens datum:
     *
     *     Tillhörighetsuppgifter
     *       Datum            2026-07-01
     *       Aktuell uppgift  Tillhörig
     *
     * Det är inträdesdatumet för ett upptagandebevis och utträdesdatumet för
     * ett utträdesbevis. En gallrad personakt saknar sektionen, och då blir
     * filnamnet som förut: bara typ och namn.
     */
    function tillhorighetsdatum() {
        const varde = sektionsfalt(sektionMed('Tillhörighetsuppgifter'), 'Datum');
        const traff = varde && varde.match(/\d{4}-\d{2}-\d{2}/);
        return traff ? traff[0] : null;
    }

    /* Dopinbjudan är den enda rapporten som frågar efter ett datum innan den
     * skapas - en ruta med rubriken "Datum för dopinbjudan", ett fält
     * förifyllt med dagens datum och knappen Fortsätt. Det datumet, inte
     * uttagsdatumet, är det inbjudan gäller.
     *
     * Rutan är borta när filen väl laddas ner, så värdet läses medan den
     * står öppen och bärs vidare - samma mönster som gruppnamnet.
     */
    let dopinbjudansDatum = null;

    function kommIhagDopinbjudan() {
        // En selektor först: rutan står öppen sällan, och innerText nedan
        // tvingar fram en omritning vid varje DOM-ändring om den läses fritt.
        const falt = document.querySelector('[role="dialog"] input[placeholder="ÅÅÅÅ-MM-DD"]');
        if (!falt) return;
        const ruta = falt.closest('[role="dialog"]');
        if (!ruta || !/dopinbjudan/i.test(ruta.innerText || '')) return;
        const traff = (falt.value || '').match(/\d{4}-\d{2}-\d{2}/);
        if (traff) dopinbjudansDatum = traff[0];
    }

    function ihagkommetNamn() {
        try {
            const sparat = JSON.parse(sessionStorage.getItem(PERSONNYCKEL) || 'null');
            const pnr = synligtPersonnummer();
            if (!sparat || !pnr) return null;
            return sparat.nyckel === kontrollvarde(pnr) ? sparat.namn : null;
        } catch (e) {
            return null;
        }
    }

    function handlingsdatum() {
        const varde = sektionsfalt(sektionMed('Datum och tid'), 'Datum');
        // Fältet innehåller bara datumet, men ett medföljande klockslag hade
        // gett ett kolon som Windows inte tillåter i filnamn.
        const traff = varde && varde.match(/\d{4}-\d{2}-\d{2}/);
        return traff ? traff[0] : null;
    }

    /* Gruppblanketten hämtas från Skapa konfirmation, en vy som varken visar
     * gruppnamnet eller har några personuppgifter att läsa - URL:en bär bara
     * ett GUID. Namnet plockas därför upp i gruppvyn på vägen dit, som är
     * enda sättet att nå formuläret, och sparas över sidbytet.
     */

    function kommIhagGruppnamn() {
        if (!/^\/konfirmationsgrupper\/[^/]+$/.test(location.pathname)) return;
        // Gruppvyns DataGrid muterar vid varje scroll, och innerText nedan
        // tvingar fram en omritning. Läs bara en gång per grupp.
        if (sessionStorage.getItem(GRUPPKALLA) === location.pathname) return;
        const rot = document.querySelector('main');
        if (!rot) return;
        // Gruppnamnet står utan etikett, på raden ovanför Grupptyp.
        const rader = (rot.innerText || '').split('\n')
            .map((s) => s.trim()).filter(Boolean);
        const i = rader.indexOf('Grupptyp');
        if (i > 0) {
            sessionStorage.setItem(GRUPPNYCKEL, rader[i - 1]);
            sessionStorage.setItem(GRUPPKALLA, location.pathname);
        }
    }

    function gruppfilnamn() {
        // Formulärets datumfält är en input - till skillnad från
        // handlingspostens sektioner, som visar färdig text.
        const sektion = sektionMed('Datum och tid');
        const falt = sektion && sektion.querySelector('input[placeholder="ÅÅÅÅ-MM-DD"]');
        const datum = falt && (falt.value || '').match(/\d{4}-\d{2}-\d{2}/);
        // Namnet gäller bara om formuläret nåddes från just den gruppen -
        // formulärets adress börjar med gruppvyns.
        const kalla = sessionStorage.getItem(GRUPPKALLA) || '';
        const gruppnamn = kalla && location.pathname.startsWith(`${kalla}/`)
            ? sessionStorage.getItem(GRUPPNYCKEL) : null;
        const delar = [];
        if (datum) delar.push(datum[0]);
        // "gemensam" skiljer den från den enskilda blanketten: den här listar
        // hela urvalet med avbockningskolumn, den enskilda gäller en person.
        delar.push('Konfirmationsblankett-gemensam');
        if (gruppnamn) delar.push(rensaFilnamnsdel(gruppnamn));
        return `${delar.join(' - ')}.pdf`;
    }

    function byggFilnamn(ursprung) {
        const typ = ursprung.replace(/\.pdf$/i, '');
        if (typ === GRUPPBLANKETT) return gruppfilnamn();
        const arBlankett = BLANKETTER.indexOf(typ) >= 0;
        const bevis = arBlankett ? null : bevisnamn(typ);
        const rapport = arBlankett || bevis ? null : personrapportnamn(typ);
        if (!arBlankett && !bevis && !rapport) return null;
        const namn = handlingensNamndel();
        if (!namn) return null;
        const delar = [];
        if (arBlankett) {
            const datum = handlingsdatum();
            if (datum) delar.push(datum);
        } else if (bevis) {
            // Går beviset via ett verifikat bär det händelsedatumet - just
            // den händelse beviset gäller. Tas det ut i efterhand från
            // personakten finns inget verifikat, men aktens
            // tillhörighetsuppgift bär samma datum.
            const handelse = handelsedatum() || tillhorighetsdatum();
            if (handelse) delar.push(handelse);
        } else if (rapport === 'Dopinbjudan') {
            // Rutan förifyller dagens datum, så uttagsdatum blir kvar om
            // användaren låter förslaget stå.
            delar.push(dopinbjudansDatum || idagsDatum());
        } else {
            // Verifikatets rapportruta efter ett in- eller utträde listar
            // Välkomstmeddelande sida vid sida med Upptagandebevis. Toge
            // rapporten alltid uttagsdatum medan beviset tar händelsedatum
            // hade två filer ur samma ruta fått olika datum. Finns ett
            // händelsedatum gäller det därför båda; annars, som i
            // personaktens meny, är uttagsdatum det enda som finns.
            delar.push(handelsedatum() || idagsDatum());
        }
        delar.push(arBlankett ? typ : bevis || rapport, namn);
        return `${delar.join(' - ')}.pdf`;
    }

    /* ---------- Visa blanketten i stället för att ladda ner den ----------
     *
     * Kbok laddar ner blanketten direkt när den väljs i Rapporter-menyn. Den
     * som bara vill läsa eller skriva ut får då en fil att städa bort efteråt.
     *
     * Rutan visar PDF:en ovanpå Kbok med tre val: skriva ut, ladda ner eller
     * stänga. Att i stället öppna blob-URL:en i en ny flik hade varit mindre
     * kod, men webbläsarens Spara som föreslår då blob-URL:ens GUID som
     * filnamn - och hela filnamnsbygget ovan hade varit bortkastat.
     */

    // Sparas innan patchen läggs på, så rutans egen nedladdning inte går
    // genom den och byter namn en gång till.
    const ORIGINALKLICK = HTMLAnchorElement.prototype.click;
    const KNAPP_KLASS = 'svk-kbok-knapp';

    /* Hover och fokusring går inte att uttrycka som inline-stil, så rutans
     * knappar får ett eget litet stilblad. Fokusringen behövs för att det ska
     * synas vilken knapp Enter träffar. */
    function laggTillKnappstil() {
        if (document.getElementById('svk-kbok-knappstil')) return;
        const stil = document.createElement('style');
        stil.id = 'svk-kbok-knappstil';
        stil.textContent = `
            .${KNAPP_KLASS} {
                padding: .45rem 1.1rem; border-radius: 6px; cursor: pointer;
                font: inherit; font-weight: 600; white-space: nowrap;
                background: ${ACCENT}; color: #fff; border: 1px solid ${ACCENT};
                transition: background .12s, box-shadow .12s;
            }
            .${KNAPP_KLASS}:hover { background: ${ACCENT_HOVER};
                border-color: ${ACCENT_HOVER}; }
            .${KNAPP_KLASS}.svk-kbok-sekundar { background: #fff; color: ${ACCENT}; }
            .${KNAPP_KLASS}.svk-kbok-sekundar:hover { background: #f3e9ed; }
            .${KNAPP_KLASS}:focus-visible, .${KNAPP_KLASS}:focus {
                outline: 2px solid ${ACCENT}; outline-offset: 2px; }
        `;
        document.head.appendChild(stil);
    }

    function laddaNer(url, filnamn) {
        const lank = document.createElement('a');
        lank.href = url;
        lank.download = filnamn;
        document.body.appendChild(lank);
        ORIGINALKLICK.call(lank);
        lank.remove();
    }

    // Vår egen blob-kopia: laddas ner och släpps sedan, så rapporten inte
    // ligger kvar i flikens minne.
    function laddaNerBlob(blob, filnamn) {
        const url = URL.createObjectURL(blob);
        laddaNer(url, filnamn);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    function byggBlankettruta(url, filnamn, egenYta, egenNedladdning) {
        laggTillKnappstil();
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-blankett';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);'
            + 'display:flex;align-items:center;justify-content:center;padding:min(2rem,4vw)';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;'
            + 'width:min(60rem,100%);height:100%;display:flex;flex-direction:column;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,.25);overflow:hidden;'
            + 'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const huvud = document.createElement('div');
        huvud.style.cssText = 'display:flex;align-items:center;padding:.9rem 1.2rem;'
            + 'border-bottom:1px solid #e5e2dc';
        const namn = document.createElement('span');
        namn.textContent = filnamn;
        namn.style.cssText = 'flex:1;font-weight:600;overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap';
        huvud.appendChild(namn);
        ruta.appendChild(huvud);

        let ram = null;
        if (egenYta) {
            ruta.appendChild(egenYta);
        } else {
            ram = document.createElement('iframe');
            // toolbar=0 döljer webbläsarens egen verktygsrad i PDF-visaren.
            // Dess nedladdningsknapp föreslår blob-URL:ens GUID som filnamn,
            // alltså precis den fälla rutan finns till för att undvika. Zoom
            // fungerar ändå med Ctrl och scrollhjulet.
            ram.src = `${url}#toolbar=0&navpanes=0`;
            ram.style.cssText = 'flex:1;width:100%;border:0';
            ruta.appendChild(ram);
        }

        const fot = document.createElement('div');
        fot.style.cssText = 'display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;'
            + 'padding:.9rem 1.2rem;border-top:1px solid #e5e2dc';
        let forstaKnapp = null;

        const stangare = [];

        function stang() {
            overlay.remove();
            document.removeEventListener('keydown', viaEscape, true);
            stangare.forEach((gor) => gor());
            // Blobben är skriptets egen kopia, ingen annan använder den.
            if (url) URL.revokeObjectURL(url);
        }

        function viaEscape(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                stang();
            }
        }

        [
            ['Skriv ut', true, () => {
                try {
                    if (ram) {
                        ram.contentWindow.focus();
                        ram.contentWindow.print();
                    } else {
                        window.print();
                    }
                } catch (e) {
                    console.warn('svk-kbok-enhancements: kunde inte skriva ut', e);
                }
            }],
            ['Ladda ner', true, () => (egenNedladdning
                ? egenNedladdning() : laddaNer(url, filnamn))],
            ['Stäng', false, stang],
        ].forEach(([text, primar, gor], i) => {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.textContent = text;
            knapp.className = KNAPP_KLASS + (primar ? '' : ' svk-kbok-sekundar');
            knapp.addEventListener('click', gor);
            fot.appendChild(knapp);
            // Skriv ut är det vanligaste nästa steg när blanketten väl visas,
            // och med fokus där går den att nå med Enter direkt.
            if (i === 0) forstaKnapp = knapp;
        });

        ruta.appendChild(fot);
        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) stang();
        });
        document.addEventListener('keydown', viaEscape, true);
        document.body.appendChild(overlay);

        /* Fokusfälla. MUI lämnar tillbaka fokus till Rapporter-knappen när
         * menyn stängs, och eftersom blobben hämtas asynkront hinner rutan
         * öppnas först - ett enkelt focus() räcker därför inte. Fällan håller
         * dessutom tabbningen inne i rutan, som en modal ska.
         *
         * Skriv ut är det vanligaste nästa steget när blanketten väl visas,
         * så fokus börjar där och Enter räcker.
         */
        function tillbakaFokus(e) {
            if (!overlay.isConnected || overlay.contains(e.target)) return;
            if (forstaKnapp) forstaKnapp.focus();
        }
        if (forstaKnapp) {
            document.addEventListener('focusin', tillbakaFokus, true);
            stangare.push(() => document.removeEventListener(
                'focusin', tillbakaFokus, true));
            forstaKnapp.focus();
        }
    }

    /* ---------- Kalkylblad i rutan ----------
     *
     * Rapporter-popupen kan leverera samma rapport som kalkylblad i stället
     * för PDF. Webbläsaren kan inte visa xlsx, men formatet är en zip med
     * XML och går att packa upp med DecompressionStream - ingen extern
     * modul behövs.
     *
     * Kboks kalkylblad är enkla: strängarna ligger inline i cellerna, det
     * finns ingen sharedStrings.xml, och arket är ett. Tolkningen behöver
     * därför bara läsa xl/worksheets/sheet1.xml.
     */

    // Kboks rapporter är små. Större arkiv än så är inte ett kalkylblad vi
    // ska tolka i sidan - då laddas filen ner i stället.
    const ZIP_MAX_BYTE = 25 * 1024 * 1024;
    const ZIP_MAX_FILER = 200;
    const ARK_MAX_RADER = 20000;
    const ARK_MAX_KOLUMNER = 256;

    async function lasZip(blob) {
        if (blob.size > ZIP_MAX_BYTE) throw new Error('arkivet är för stort');
        const data = new Uint8Array(await blob.arrayBuffer());
        const vy = new DataView(data.buffer);
        // Katalogen hittas via End of Central Directory, som ligger sist.
        let eocd = -1;
        for (let i = data.length - 22; i >= 0 && i > data.length - 65558; i--) {
            if (vy.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('ingen zip-katalog');
        const antal = vy.getUint16(eocd + 10, true);
        if (antal > ZIP_MAX_FILER) throw new Error('arkivet har för många filer');
        let pos = vy.getUint32(eocd + 16, true);
        const filer = {};
        for (let i = 0; i < antal; i++) {
            const namnlangd = vy.getUint16(pos + 28, true);
            filer[new TextDecoder().decode(
                data.subarray(pos + 46, pos + 46 + namnlangd))] = {
                metod: vy.getUint16(pos + 10, true),
                storlek: vy.getUint32(pos + 20, true),
                offset: vy.getUint32(pos + 42, true),
            };
            pos += 46 + namnlangd + vy.getUint16(pos + 30, true)
                + vy.getUint16(pos + 32, true);
        }
        return { data, vy, filer };
    }

    async function zipfil(zip, namn) {
        const post = zip.filer[namn];
        if (!post) return null;
        // Namn- och extralängd i den lokala huvudet kan skilja från katalogens.
        const start = post.offset + 30
            + zip.vy.getUint16(post.offset + 26, true)
            + zip.vy.getUint16(post.offset + 28, true);
        if (post.storlek > ZIP_MAX_BYTE || start + post.storlek > zip.data.length) {
            throw new Error('filen i arkivet är trasig eller för stor');
        }
        const rad = zip.data.subarray(start, start + post.storlek);
        if (post.metod === 0) return new TextDecoder().decode(rad);
        return new Response(new Blob([rad]).stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }

    function arkTillRader(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const rader = [...doc.getElementsByTagName('row')];
        if (rader.length > ARK_MAX_RADER) throw new Error('arket har för många rader');
        return rader.map((rad) => {
            const celler = [];
            [...rad.getElementsByTagName('c')].forEach((c) => {
                // Cellens r-attribut bär kolumnbokstaven; tomma celler
                // utelämnas i filen och måste fyllas i för att kolumnerna
                // ska hamna rätt.
                const bokstav = (c.getAttribute('r') || '').replace(/\d+$/, '');
                let index = 0;
                for (let i = 0; i < bokstav.length; i++) {
                    index = index * 26 + (bokstav.charCodeAt(i) - 64);
                }
                if (index > ARK_MAX_KOLUMNER) throw new Error('arket har för många kolumner');
                const text = c.getElementsByTagName('t')[0]
                    || c.getElementsByTagName('v')[0];
                while (celler.length < index - 1) celler.push('');
                celler.push(text ? text.textContent : '');
            });
            return celler;
        });
    }

    function byggKalkylruta(rader, blob, filnamn) {
        const tabell = document.createElement('table');
        tabell.style.cssText = 'border-collapse:collapse;font-size:.85rem;width:100%';
        rader.forEach((rad, i) => {
            const tr = document.createElement('tr');
            rad.forEach((cell) => {
                const td = document.createElement(i === 0 ? 'th' : 'td');
                td.textContent = cell;
                td.style.cssText = 'border:1px solid #e5e2dc;padding:.3rem .5rem;'
                    + 'text-align:left;white-space:nowrap'
                    + (i === 0 ? ';background:#f6f4f1;font-weight:600' : '');
                tr.appendChild(td);
            });
            tabell.appendChild(tr);
        });
        const yta = document.createElement('div');
        yta.style.cssText = 'flex:1;overflow:auto;padding:1rem 1.2rem';
        yta.appendChild(tabell);
        byggBlankettruta(null, filnamn, yta, () => laddaNerBlob(blob, filnamn));
    }

    function visaBlankett(url, filnamn) {
        // Egen kopia av blobben: appen tar bort länken direkt efter klicket
        // och kan återkalla sin blob-URL, och då hade ramen visat en tom sida.
        fetch(url)
            .then((svar) => svar.blob())
            .then((blob) => {
                // Rapporter-popupen har en växel mellan PDF och kalkylblad.
                // Ett kalkylblad går inte att visa i en iframe - webbläsaren
                // laddar ner det i stället, och då utan download-attribut, så
                // filen får blob-URL:ens GUID som namn. Ladda hellre ner den
                // med rätt namn direkt.
                if (/sheet|excel/i.test(blob.type) || /\.xlsx$/i.test(filnamn)) {
                    return lasZip(blob)
                        .then((zip) => zipfil(zip, 'xl/worksheets/sheet1.xml'))
                        .then((xml) => {
                            if (!xml) throw new Error('inget ark i filen');
                            byggKalkylruta(arkTillRader(xml), blob, filnamn);
                        })
                        .catch((e) => {
                            // Går kalkylbladet inte att läsa är en nedladdning
                            // bättre än ingenting.
                            console.warn('svk-kbok-enhancements: kunde inte visa '
                                + 'kalkylbladet', e);
                            laddaNerBlob(blob, filnamn);
                        });
                }
                if (blob.type !== 'application/pdf') {
                    laddaNerBlob(blob, filnamn);
                    return undefined;
                }
                byggBlankettruta(URL.createObjectURL(blob), filnamn);
                return undefined;
            })
            .catch((e) => {
                // Går blobben inte att läsa är en nedladdning bättre än
                // ingenting - annars hade klicket bara försvunnit.
                console.warn('svk-kbok-enhancements: kunde inte visa blanketten', e);
                laddaNer(url, filnamn);
            });
    }

    /* Namn och gruppnamn ligger i sessionStorage bara för att överleva
     * sidbytet till den vy där blanketten tas ut. De ska inte ligga kvar en
     * arbetsdag, och absolut inte till nästa person som loggar in i samma
     * flik. Därför glöms de efter nedladdningen och vid utloggning. */
    const NAMNNYCKLAR = [PERSONNYCKEL, GRUPPNYCKEL, GRUPPKALLA];
    const UTLOGGAD_SIDA = /utb_login|utloggad|logga-in|login/i;

    function glomIhagkomnaNamn() {
        NAMNNYCKLAR.forEach((nyckel) => sessionStorage.removeItem(nyckel));
    }

    function gallraVidUtloggning() {
        const utloggad = UTLOGGAD_SIDA.test(location.pathname)
            || /adfs/i.test(location.hostname);
        if (!utloggad) return;
        glomIhagkomnaNamn();
        // Hanterad-markeringarna gallras i läsningen; utloggningen är ett
        // bra tillfälle att låta den köra även om fliken inte öppnats.
        lasHanterade();
    }

    function dopOmNedladdningar() {
        HTMLAnchorElement.prototype.click = function () {
            try {
                const ursprung = this.getAttribute('download');
                if (ursprung && installningar.blankettnamn) {
                    const nytt = byggFilnamn(ursprung);
                    // Går inget namn att bygga lämnas Kboks eget i fred - ett
                    // igenkännbart filnamn är bättre än ett stympat.
                    if (nytt) this.setAttribute('download', nytt);
                    // Det ihågkomna namnet har gjort sitt när filen fått
                    // sitt. Öppnas personakten igen sparas det på nytt.
                    glomIhagkomnaNamn();
                }
                if (ursprung && installningar.visaBlankett && this.href) {
                    visaBlankett(this.href, this.getAttribute('download') || ursprung);
                    // Nedladdningen hoppas över - rutan har en egen knapp för
                    // den som ändå vill spara filen.
                    return undefined;
                }
            } catch (e) {
                console.warn('svk-kbok-enhancements: kunde inte byta filnamn', e);
            }
            return ORIGINALKLICK.apply(this, arguments);
        };
    }

    /* ---------- Kom ihåg miljövalet i Utbildningsmiljön ----------
     *
     * Utbildningsmiljön låter en välja instans på /utv_selectDb efter
     * inloggningen. Valet ligger i serversessionen, inte i fliken, och att
     * öppna en länk i en ny flik nollställer det - för BÅDA flikarna,
     * eftersom sessionen är gemensam. Verifierat: en ny flik mot
     * /personakt/<id> landar på miljövalet, och den ursprungliga fliken gör
     * det också vid nästa sidladdning.
     *
     * Skriptet kommer därför ihåg vad som valdes senast och fyller i det
     * igen. Sidan finns bara i Utbildningsmiljön, så inget av det här rör
     * produktionen.
     */

    const MILJONYCKEL = 'svk-kbok-miljo';
    const MALNYCKEL = 'svk-kbok-onskad-sida';
    const FORSOKNYCKEL = 'svk-kbok-mal-forsokt';
    const MILJOVAL_SIDA = /utv_selectDb/i;
    // Sidor som aldrig är ett vettigt mål att skickas tillbaka till.
    const EJ_MAL = /utv_selectDb|login/i;

    /* Miljövalet kastar bort adressen man var på väg till: efter valet landar
     * man på startsidan, inte på personakten man klickade.
     *
     * Omdirigeringen görs av appen, inte av servern - begäran om
     * /personakt/<id> besvaras med 200 och appen byter sedan sida.
     * Navigeringsposten bär därför kvar den ursprungliga adressen, och den
     * fungerar även för en länk som klistrats in för hand.
     *
     * Målet läggs i sessionStorage, som är per flik - två flikar på väg till
     * olika personakter ska inte kunna ta varandras.
     */

    function sparaOnskadSida() {
        const post = performance.getEntriesByType('navigation')[0];
        if (!post || !post.name) return;
        let mal;
        try {
            mal = new URL(post.name);
        } catch (e) {
            return;
        }
        if (mal.origin !== location.origin) return;
        if (EJ_MAL.test(mal.pathname) || mal.pathname === '/') return;
        // Ett försök i taget. Spärren släpps först när navigeringen bevisligen
        // kommit fram, så en misslyckad omgång inte kan bli rundgång.
        if (sessionStorage.getItem(FORSOKNYCKEL)) return;
        sessionStorage.setItem(MALNYCKEL, mal.pathname + mal.search);
    }

    function gaTillOnskadSida() {
        if (MILJOVAL_SIDA.test(location.pathname)) return;
        const har = location.pathname + location.search;
        const mal = sessionStorage.getItem(MALNYCKEL);
        if (!mal) {
            // Framme vid det senast försökta målet: släpp spärren så nästa
            // sidladdning får ett eget försök. Låg den kvar gällde den hela
            // fliken, och ett F5 på en undersida landade alltid på startsidan.
            if (sessionStorage.getItem(FORSOKNYCKEL) === har) {
                sessionStorage.removeItem(FORSOKNYCKEL);
            }
            return;
        }
        // Tas bort före navigeringen: leder adressen tillbaka till miljövalet
        // ska skriptet inte försöka igen i all evighet.
        sessionStorage.removeItem(MALNYCKEL);
        // Spärren bär målet, så den kan släppas när vi ser att vi kommit dit.
        sessionStorage.setItem(FORSOKNYCKEL, mal);
        if (mal === har) return;
        // Måste gå via routern, inte location.href: varje FULL sidladdning
        // nollställer miljövalet, så en vanlig navigering hade kastat
        // tillbaka en till miljövalssidan i all oändlighet. pushState plus
        // popstate byter vy utan att ladda om, och sessionen rörs inte.
        history.pushState({}, '', mal);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }

    function ledtext(text) {
        return [...document.querySelectorAll('body *')].find(
            (el) => el.children.length === 0
                && (el.textContent || '').trim() === text);
    }

    // Stegen i dropdownen renderas asynkront, så varje steg väntar in sitt
    // element i stället för att anta att föregående klick hunnit slå igenom.
    function vantaPa(hitta, forsok = 20) {
        return new Promise((klar, fel) => {
            const prova = (kvar) => {
                const traff = hitta();
                if (traff) return klar(traff);
                if (kvar <= 0) return fel(new Error('hittade inte elementet'));
                return setTimeout(() => prova(kvar - 1), 150);
            };
            prova(forsok);
        });
    }

    /* MUI:s Select öppnar listan på mousedown, inte på click - ett vanligt
     * element.click() gjorde ingenting alls, och listan förblev tom. */
    function oppnaLista(el) {
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((typ) => {
            el.dispatchEvent(new MouseEvent(typ, {
                bubbles: true, cancelable: true, view: window, button: 0,
            }));
        });
    }

    function hanteraMiljoval() {
        if (!installningar.minnsMiljo) {
            // Inställningen av: låt inte heller en kvarglömd måladress
            // flytta användaren efter ett val som gjorts för hand.
            sessionStorage.removeItem(MALNYCKEL);
            return;
        }
        if (!MILJOVAL_SIDA.test(location.pathname)) {
            gaTillOnskadSida();
            return;
        }
        sparaOnskadSida();

        // Lär av det användaren själv väljer - första gången finns inget
        // sparat, och då är det klicket som ger skriptet svaret.
        document.querySelectorAll('[role="option"]').forEach((val) => {
            if (val.dataset.svkKbokMiljo) return;
            val.dataset.svkKbokMiljo = '1';
            val.addEventListener('click', () => {
                const namn = (val.textContent || '').trim();
                if (namn) localStorage.setItem(MILJONYCKEL, namn);
            });
        });

        const sparad = localStorage.getItem(MILJONYCKEL);
        if (!sparad) return;
        // En gång per sidladdning - annars skulle MutationObserver starta om
        // sekvensen för varje ändring den själv orsakar.
        if (document.body.dataset.svkKbokMiljoval) return;
        document.body.dataset.svkKbokMiljoval = '1';

        vantaPa(() => ledtext('Inget valt'))
            .then((trigger) => {
                oppnaLista(trigger);
                return vantaPa(() => [...document.querySelectorAll('[role="option"]')]
                    .find((o) => (o.textContent || '').trim() === sparad));
            })
            .then((val) => {
                val.click();
                return vantaPa(() => [...document.querySelectorAll('button')].find(
                    (b) => (b.innerText || '').trim() === 'Välj miljö' && !b.disabled));
            })
            .then((knapp) => knapp.click())
            .catch(() => {
                // Ser sidan annorlunda ut får användaren välja själv - bättre
                // än att klicka på måfå i ett formulär som byter instans.
                console.warn(`svk-kbok-enhancements: kunde inte välja miljön "${sparad}"`);
            });
    }

    /* ---------- Ny version och versionshistorik ----------
     *
     * GitHub raw skickar access-control-allow-origin: *, så både skriptfilen
     * och changeloggen går att hämta med fetch utan @grant. Det kompletterar
     * Tampermonkeys egen kontroll: den kollar på sitt eget intervall, det här
     * ger besked när panelen öppnas.
     *
     * Anropet går till GitHub från en flik som visar personuppgifter. Inget
     * skickas - det är en GET efter en publik fil - men det är ett utgående
     * anrop till tredjepart, och därför en egen inställning.
     */

    const CHANGELOG_URL = INSTALLATIONSURL.replace(
        /[^/]+\.user\.js$/, 'CHANGELOG.md');
    const UPPDATERINGSNYCKEL = 'svk-kbok-senaste-version';
    const DYGN = 24 * 60 * 60 * 1000;

    /* Jämför per siffergrupp, inte som text: '0.9' är inte nyare än '0.31'. */
    function arNyare(kandidat, nuvarande) {
        const a = String(kandidat).split('.').map(Number);
        const b = String(nuvarande).split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const x = a[i] || 0;
            const y = b[i] || 0;
            if (x !== y) return x > y;
        }
        return false;
    }

    /* Svaret cachas ett dygn så att inte varje sidladdning blir ett anrop.
     * Panelen öppnas sällan och tvingar därför alltid en färsk kontroll -
     * annars kan en nyss utgiven version se ut att inte finnas, vilket den
     * gjorde när cachen hunnit fyllas strax före en utgivning.
     */
    function hamtaSenasteVersion(tvinga) {
        let sparat = null;
        try {
            sparat = JSON.parse(localStorage.getItem(UPPDATERINGSNYCKEL) || 'null');
        } catch (e) {
            sparat = null;
        }
        if (!tvinga && sparat && Date.now() - sparat.tid < DYGN) {
            console.log(`svk-kbok-enhancements: senaste kända version `
                + `${sparat.version}, kontrollerad ${new Date(sparat.tid).toLocaleString('sv')}`);
            return Promise.resolve(sparat.version);
        }
        return fetch(INSTALLATIONSURL, { cache: 'no-store' })
            .then((svar) => svar.text())
            .then((text) => {
                const traff = text.match(/@version\s+([\d.]+)/);
                if (!traff) {
                    console.warn('svk-kbok-enhancements: hittade inget '
                        + 'versionsnummer i den hämtade filen');
                    return null;
                }
                localStorage.setItem(UPPDATERINGSNYCKEL,
                    JSON.stringify({ version: traff[1], tid: Date.now() }));
                console.log(`svk-kbok-enhancements: kör ${VERSION}, `
                    + `senaste är ${traff[1]}`);
                return traff[1];
            })
            .catch((e) => {
                // Utan den här raden är ett blockerat anrop omöjligt att
                // skilja från att ingen ny version finns.
                console.warn('svk-kbok-enhancements: kunde inte hämta '
                    + 'versionsnumret', e);
                return null;
            });
    }

    // Läses av menyposten, som byggs om av appen och inte kan vänta på ett
    // nätverksanrop varje gång.
    let senasteVersion = null;

    const VISADNYCKEL = 'svk-kbok-uppdatering-visad';

    /* Changeloggen renderas som markdown. Filen är vår egen och använder bara
     * en handfull element, så en fullständig parser vore överdrift - men
     * innehållet byggs som DOM-noder och inte via innerHTML, så en framtida
     * rad med HTML i sig inte kan köras. */

    function markeraInline(rad, mal) {
        // **fet**, `kod` och [text](adress)
        const monster = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
        let sist = 0;
        let traff = monster.exec(rad);
        while (traff) {
            if (traff.index > sist) {
                mal.appendChild(document.createTextNode(rad.slice(sist, traff.index)));
            }
            const bit = traff[0];
            if (bit.startsWith('**')) {
                const stark = document.createElement('strong');
                stark.textContent = bit.slice(2, -2);
                mal.appendChild(stark);
            } else if (bit.startsWith('`')) {
                const kod = document.createElement('code');
                kod.textContent = bit.slice(1, -1);
                kod.style.cssText = 'background:#f6f4f1;padding:.05rem .3rem;'
                    + 'border-radius:3px;font-size:.9em';
                mal.appendChild(kod);
            } else {
                const delar = bit.match(/\[([^\]]+)\]\(([^)]+)\)/);
                // Texten kommer från GitHub. Bara vanliga webbadresser blir
                // länkar; ett javascript:-schema hade kört i Kboks kontext.
                if (!/^https?:\/\//i.test(delar[2])) {
                    mal.appendChild(document.createTextNode(delar[1]));
                    return;
                }
                const lank = document.createElement('a');
                lank.textContent = delar[1];
                lank.href = delar[2];
                lank.target = '_blank';
                lank.rel = 'noopener';
                lank.style.color = ACCENT;
                mal.appendChild(lank);
            }
            sist = traff.index + bit.length;
            traff = monster.exec(rad);
        }
        if (sist < rad.length) {
            mal.appendChild(document.createTextNode(rad.slice(sist)));
        }
    }

    /* Markdown viker rader: en listpunkt eller ett stycke fortsätter över
     * radbrytningar tills en tom rad. Utan att vika ihop dem först bryts
     * ord som **Skriv ut** mitt itu och renderas som text. */
    function vikBlock(md) {
        const block = [];
        let aktuellt = null;
        md.split('\n').forEach((rad) => {
            const text = rad.trim();
            if (!text) {
                aktuellt = null;
                return;
            }
            const nyttBlock = /^(#{1,4}\s|[-*]\s)/.test(text);
            if (nyttBlock || !aktuellt) {
                aktuellt = { text };
                block.push(aktuellt);
            } else {
                aktuellt.text += ` ${text}`;
            }
        });
        return block;
    }

    function renderaMarkdown(md, hoppaOverForstaRubrik) {
        const yta = document.createElement('div');
        let lista = null;
        let forstaRubrikPasserad = false;
        let nyttAvsnitt = false;
        let nagotNytt = false;

        vikBlock(md).forEach(({ text }) => {
            const rubrik = text.match(/^(#{1,4})\s+(.*)$/);
            if (rubrik) {
                lista = null;
                // Filens egen topprubrik dubblerar rutans.
                if (hoppaOverForstaRubrik && rubrik[1].length === 1
                    && !forstaRubrikPasserad) {
                    forstaRubrikPasserad = true;
                    return;
                }
                forstaRubrikPasserad = true;
                const h = document.createElement(`h${Math.min(rubrik[1].length + 1, 6)}`);
                markeraInline(rubrik[2], h);
                h.style.cssText = rubrik[1].length <= 2
                    ? `font-size:1rem;margin:1.2rem 0 .3rem;color:${ACCENT}`
                    : 'font-size:.92rem;margin:.9rem 0 .2rem';
                // En versionsrubrik nyare än den körande gäller något
                // användaren ännu inte har. Har man hoppat över flera
                // versioner är det annars svårt att se var ens egen slutar.
                const version = rubrik[2].trim().match(/^\d+(\.\d+)*$/);
                nyttAvsnitt = !!version && arNyare(version[0], VERSION);
                if (nyttAvsnitt) {
                    nagotNytt = true;
                    const markering = document.createElement('span');
                    markering.textContent = ' nytt';
                    markering.style.cssText = `background:${ACCENT};color:#fff;`
                        + 'font-size:.65rem;padding:.1rem .4rem;border-radius:999px;'
                        + 'margin-left:.4rem;vertical-align:middle;font-weight:600';
                    h.appendChild(markering);
                }
                yta.appendChild(h);
                return;
            }
            const punkt = text.match(/^[-*]\s+(.*)$/);
            if (punkt) {
                if (!lista) {
                    lista = document.createElement('ul');
                    lista.style.cssText = 'margin:.3rem 0;padding-left:1.2rem';
                    yta.appendChild(lista);
                }
                const li = document.createElement('li');
                li.style.margin = '.25rem 0';
                markeraInline(punkt[1], li);
                lista.appendChild(li);
                return;
            }
            lista = null;
            const stycke = document.createElement('p');
            stycke.style.cssText = 'margin:.4rem 0';
            markeraInline(text, stycke);
            yta.appendChild(stycke);
        });
        if (nagotNytt) {
            const notis = document.createElement('p');
            notis.textContent = `Märkta avsnitt är nyare än din version (${VERSION}).`;
            notis.style.cssText = 'margin:0 0 .8rem;color:#6b6862;font-size:.85rem';
            yta.insertBefore(notis, yta.firstChild);
        }
        return yta;
    }

    /* Egen ruta ovanpå den som öppnade den. Tidigare fälldes ändringarna ut
     * inuti panelen, vilket gjorde den lång och lämnade knappen kvar med fel
     * text när man fällde ihop igen. */

    function visaChangelog() {
        if (document.getElementById('svk-kbok-changelog')) return;
        laggTillKnappstil();
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-changelog';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;'
            + 'background:rgba(0,0,0,.35);display:flex;align-items:center;'
            + 'justify-content:center;padding:1.5rem';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;'
            + 'width:min(40rem,100%);max-height:calc(100vh - 3rem);display:flex;'
            + 'flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.25);'
            + 'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const rubrik = document.createElement('h2');
        rubrik.textContent = 'Ändringar';
        rubrik.style.cssText = 'margin:0;padding:1.2rem 1.5rem .6rem;font-size:1.1rem';
        ruta.appendChild(rubrik);

        const kropp = document.createElement('div');
        kropp.style.cssText = 'flex:1;overflow-y:auto;padding:0 1.5rem';
        kropp.textContent = 'Hämtar...';
        ruta.appendChild(kropp);

        const fot = document.createElement('div');
        fot.style.cssText = 'display:flex;justify-content:flex-end;'
            + 'padding:.9rem 1.5rem 1.2rem';
        const stangKnapp = document.createElement('button');
        stangKnapp.type = 'button';
        stangKnapp.textContent = 'Stäng';
        stangKnapp.className = KNAPP_KLASS;

        function stang() {
            overlay.remove();
            document.removeEventListener('keydown', viaEscape, true);
        }
        function viaEscape(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                stang();
            }
        }
        stangKnapp.addEventListener('click', stang);
        fot.appendChild(stangKnapp);
        ruta.appendChild(fot);
        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) stang(); });
        document.addEventListener('keydown', viaEscape, true);
        document.body.appendChild(overlay);
        stangKnapp.focus();

        fetch(CHANGELOG_URL, { cache: 'no-store' })
            .then((svar) => svar.text())
            .then((md) => {
                kropp.textContent = '';
                kropp.appendChild(renderaMarkdown(md, true));
            })
            .catch(() => { kropp.textContent = 'Kunde inte hämta ändringarna.'; });
    }

    /* En ny version är lätt att missa som en prick i en meny man sällan
     * öppnar. Rutan visas därför en gång per dygn - klickar man Senare
     * kommer den tillbaka i morgon, inte vid nästa sidladdning. */

    function byggUppdateringsruta(senaste) {
        laggTillKnappstil();
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-uppdatering';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;'
            + 'background:rgba(0,0,0,.35);display:flex;align-items:center;'
            + 'justify-content:center;padding:1.5rem';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;'
            + 'padding:1.4rem 1.6rem;max-width:32rem;width:100%;'
            + 'max-height:calc(100vh - 2rem);overflow-y:auto;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,.25);'
            + 'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const rubrik = document.createElement('h2');
        rubrik.textContent = `${PRODUKTNAMN} ${senaste} finns`;
        rubrik.style.cssText = 'margin:0 0 .3rem;font-size:1.1rem';
        ruta.appendChild(rubrik);

        const ingress = document.createElement('p');
        ingress.textContent = `Du kör ${VERSION}. Uppdateringen öppnar skriptet, `
            + 'och tillägget visar sin egen dialog.';
        ingress.style.cssText = 'margin:0 0 1rem;color:#6b6862;font-size:.9rem';
        ruta.appendChild(ingress);

        const fot = document.createElement('div');
        fot.style.cssText = 'display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap';

        /* Dygnsspärren sätts när rutan avfärdas, inte när den visas. Sätts
         * den vid visningen försvinner rutan i ett dygn så fort sidan laddas
         * om, även om användaren inte hunnit läsa den. Nu återkommer den vid
         * varje sidladdning tills man faktiskt tagit ställning. */
        function stang() {
            localStorage.setItem(VISADNYCKEL, String(Date.now()));
            overlay.remove();
            document.removeEventListener('keydown', viaEscape, true);
        }
        function viaEscape(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                stang();
            }
        }

        let forsta = null;
        [
            ['Uppdatera', true, () => {
                window.open(INSTALLATIONSURL, '_blank', 'noopener');
                stang();
            }],
            ['Visa ändringar', false, visaChangelog],
            ['Senare', false, stang],
        ].forEach(([namn, primar, gor], i) => {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.textContent = namn;
            knapp.className = KNAPP_KLASS + (primar ? '' : ' svk-kbok-sekundar');
            knapp.addEventListener('click', gor);
            fot.appendChild(knapp);
            if (i === 0) forsta = knapp;
        });

        ruta.appendChild(fot);
        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) stang(); });
        document.addEventListener('keydown', viaEscape, true);
        document.body.appendChild(overlay);
        if (forsta) forsta.focus();
    }

    function kollaUppdateringVidStart() {
        if (!installningar.kollaUppdatering) return;
        hamtaSenasteVersion().then((senaste) => {
            senasteVersion = senaste;
            if (!senaste || !arNyare(senaste, VERSION)) return;
            const visad = Number(localStorage.getItem(VISADNYCKEL) || 0);
            if (Date.now() - visad < DYGN) return;
            byggUppdateringsruta(senaste);
        });
    }

    function finnsNyareVersion() {
        return !!senasteVersion && arNyare(senasteVersion, VERSION);
    }

    /* ---------- Inställningspanel ----------
     *
     * Nås via menyposten Kbok Plus i användarmenyn under avataren. Menyn
     * byggs om av appen vid varje öppning, så posten läggs till på nytt av
     * MutationObserver - se laggTillMenypost().
     */

    function byggPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-panel';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);'
            + 'display:flex;align-items:center;justify-content:center';

        const ruta = document.createElement('div');
        // Egen scroll: med alla grupper utfällda blev panelen högre än en
        // mobilskärm och svämmade ut ur rutan.
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;padding:1.2rem 1.6rem;'
            + 'max-width:34rem;width:calc(100% - 2rem);box-shadow:0 8px 32px rgba(0,0,0,.25);'
            + 'max-height:calc(100vh - 2rem);overflow-y:auto;'
            + 'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const rubrik = document.createElement('h2');
        rubrik.textContent = PRODUKTNAMN;
        rubrik.style.cssText = 'margin:0 0 .2rem;font-size:1.1rem';
        ruta.appendChild(rubrik);

        const ingress = document.createElement('p');
        ingress.textContent = 'Inställningarna sparas i den här webbläsaren.';
        ingress.style.cssText = 'margin:0 0 .6rem;color:#6b6862;font-size:.9rem';
        ruta.appendChild(ingress);

        /* Flikrad. Måtten är avlästa ur Kboks egna MUI-flikar (Aktuella /
         * Senaste / Alla församlingar på startsidan): 14px, halvfet, ingen
         * versalisering, 12px 16px padding, och en 2px indikator i
         * accentfärgen under den valda. Typsnittet ärvs från panelen i
         * stället för att sättas till Kboks DM Sans - resten av panelen
         * använder systemtypsnittet, och en avvikande flikrad hade synts
         * mer än den hade liknat. */
        const flikrad = document.createElement('div');
        flikrad.style.cssText = 'display:flex;border-bottom:1px solid #e3e0da;margin:0 0 .2rem';
        ruta.appendChild(flikrad);

        const flikar = [];

        function laggTillFlik(etikett) {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.textContent = etikett;
            const yta = document.createElement('div');
            flikrad.appendChild(knapp);
            ruta.appendChild(yta);
            const flik = { knapp, yta };
            knapp.addEventListener('click', () => valjFlik(flik));
            flikar.push(flik);
            return yta;
        }

        function valjFlik(vald) {
            flikar.forEach((flik) => {
                const aktiv = flik === vald;
                flik.knapp.style.cssText = 'font:500 14px/1.4 inherit;text-transform:none;'
                    + 'padding:12px 16px;min-width:90px;background:none;border:none;'
                    + 'cursor:pointer;border-bottom:2px solid '
                    + (aktiv ? ACCENT : 'transparent') + ';margin-bottom:-1px;'
                    + 'color:' + (aktiv ? ACCENT : 'rgba(0,0,0,.6)');
                flik.yta.style.display = aktiv ? 'block' : 'none';
            });
        }

        const flikInstallningar = laggTillFlik('Inställningar');
        const flikGenvagar = laggTillFlik('Genvägar');
        valjFlik(flikar[0]);

        // Pågående inspelningar av genvägar har en lyssnare på document.
        // Stängs panelen mitt i måste den bort, annars ändrar nästa
        // tangenttryckning genvägen i tysthet.
        const pagaendeInspelningar = new Set();
        function stangPanel() {
            [...pagaendeInspelningar].forEach((avsluta) => avsluta());
            overlay.remove();
        }

        function kryssrad(nyckel, markerad) {
            const rad = document.createElement('label');
            rad.style.cssText = 'display:flex;gap:.6rem;align-items:flex-start;'
                + 'margin:.3rem 0;cursor:pointer';
            const kryss = document.createElement('input');
            kryss.type = 'checkbox';
            kryss.checked = !!installningar[nyckel];
            kryss.style.cssText = `margin-top:.25rem;flex:none;accent-color:${ACCENT};`
                + 'width:16px;height:16px;cursor:pointer';
            kryss.addEventListener('change', () => {
                installningar[nyckel] = kryss.checked;
                sparaInstallningar();
                if (nyckel === 'nyflikLank' && !kryss.checked) taBortLankar();
                uppdatera();
            });
            const text = document.createElement('span');
            text.textContent = ETIKETTER[nyckel];
            if (markerad) text.style.color = ACCENT;
            rad.appendChild(kryss);
            rad.appendChild(text);
            return rad;
        }

        function gruppRubrik(titel) {
            const h = document.createElement('h3');
            h.textContent = titel;
            h.style.cssText = 'font-size:.8rem;text-transform:uppercase;'
                + 'letter-spacing:.05em;color:#6b6862;margin:.7rem 0 .2rem';
            return h;
        }

        GRUPPER.forEach((grupp) => {
            flikInstallningar.appendChild(gruppRubrik(grupp.rubrik));
            grupp.nycklar.forEach((n) => flikInstallningar.appendChild(kryssrad(n)));
            if (grupp.rubrik === 'Pålysningsbok') {
                // Markeringarna bor i den här webbläsaren, så här är stället
                // att bli av med dem också.
                const rensa = document.createElement('button');
                rensa.type = 'button';
                rensa.textContent = 'Rensa sparade Hanterad-markeringar';
                rensa.style.cssText = 'margin:.2rem 0 0 1.6rem;font:inherit;font-size:.82rem;'
                    + `padding:.3rem .8rem;border:1px solid ${ACCENT};border-radius:999px;`
                    + `background:#fff;color:${ACCENT};cursor:pointer`;
                rensa.addEventListener('click', () => {
                    rensaHanterade();
                    rensa.textContent = 'Markeringarna är borttagna';
                    rensa.disabled = true;
                });
                flikInstallningar.appendChild(rensa);
            }
        });

        flikInstallningar.appendChild(gruppRubrik('Går inte att ångra'));
        flikInstallningar.appendChild(kryssrad('fokusBekraftaVerifikat', true));
        const varning = document.createElement('p');
        varning.textContent = 'Att bekräfta ett verifikat är slutregistrering. '
            + 'Genvägen Ctrl+B gör samma sak.';
        varning.style.cssText = 'margin:.2rem 0 0 1.6rem;color:#6b6862;font-size:.82rem';
        flikInstallningar.appendChild(varning);

        /* Genvägar med inspelning. Inget bibliotek behövs - keydown bär
         * redan tangent och modifierare, och att spela in en kombination är
         * att läsa nästa keydown och beskriva den. */
        const genvHuvud = document.createElement('div');
        genvHuvud.style.cssText = 'display:flex;align-items:center;gap:1rem;'
            + 'margin:1.2rem 0 .2rem';
        const genvHjalp = document.createElement('p');
        genvHjalp.textContent = 'Klicka på en tangentkombination och tryck den nya du vill använda.';
        genvHjalp.style.cssText = 'margin:0;color:#6b6862;font-size:.85rem;flex:1';
        genvHuvud.appendChild(genvHjalp);
        // Huvudbrytaren hör till listan nedanför, inte till kryssrutorna
        // på den andra fliken.
        const genvBrytare = kryssrad('genvagarPa');
        genvBrytare.style.margin = '0';
        genvBrytare.style.fontSize = '.85rem';
        genvHuvud.appendChild(genvBrytare);
        flikGenvagar.appendChild(genvHuvud);

        Object.entries(KOMMANDON).forEach(([nyckel, kmd]) => {
            const rad = document.createElement('div');
            rad.style.cssText = 'display:flex;gap:.7rem;align-items:center;margin:.45rem 0';

            const namn = document.createElement('span');
            namn.textContent = kmd.etikett;
            namn.title = kmd.gammal || '';
            namn.style.cssText = 'flex:1';
            if (kmd.varning) namn.style.color = ACCENT;

            const knapp = document.createElement('button');
            knapp.type = 'button';
            const nuvarande = () => (installningar.genvagar || {})[nyckel] || kmd.standard;
            knapp.textContent = nuvarande();
            knapp.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:.8rem;'
                + `padding:.35rem .8rem;border:1px solid ${ACCENT};border-radius:999px;`
                + `background:#fff;color:${ACCENT};cursor:pointer;min-width:6.5rem;font-weight:600`;

            let spelarIn = false;
            const avsluta = () => {
                spelarIn = false;
                pagaendeInspelningar.delete(avsluta);
                knapp.textContent = nuvarande();
                knapp.style.borderColor = ACCENT;
                knapp.style.background = '#fff';
                document.removeEventListener('keydown', fanga, true);
            };
            function fanga(e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === 'Escape') return avsluta();
                const beskrivning = beskrivTangent(e);
                if (!beskrivning) return;
                installningar.genvagar = { ...(installningar.genvagar || {}), [nyckel]: beskrivning };
                sparaInstallningar();
                avsluta();
            }
            knapp.addEventListener('click', () => {
                if (spelarIn) return avsluta();
                spelarIn = true;
                pagaendeInspelningar.add(avsluta);
                knapp.textContent = 'tryck…';
                knapp.style.borderColor = ACCENT;
                knapp.style.background = '#fbeaea';
                document.addEventListener('keydown', fanga, true);
            });

            const ater = document.createElement('button');
            ater.type = 'button';
            ater.textContent = '↺';
            ater.title = `Återställ till ${kmd.standard}`;
            ater.style.cssText = 'border:none;background:none;cursor:pointer;font-size:15px;opacity:.5';
            ater.addEventListener('click', () => {
                const g = { ...(installningar.genvagar || {}) };
                delete g[nyckel];
                installningar.genvagar = g;
                sparaInstallningar();
                knapp.textContent = nuvarande();
            });

            rad.appendChild(namn);
            rad.appendChild(knapp);
            rad.appendChild(ater);
            flikGenvagar.appendChild(rad);
        });

        // Ctrl+B står markerad i listan ovan, men markeringen säger inte vad
        // den betyder. Varningen om slutregistrering finns på båda flikarna
        // eftersom både inställningen och genvägen gör samma sak.
        const genvVarning = document.createElement('p');
        genvVarning.textContent = 'Ctrl+B slutregistrerar verifikatet. Det går inte att ångra.';
        genvVarning.style.cssText = 'margin:.9rem 0 0;color:#6b6862;font-size:.82rem';
        flikGenvagar.appendChild(genvVarning);

        const fot = document.createElement('div');
        fot.style.cssText = 'margin-top:1rem;padding-top:.8rem;border-top:1px solid #e3e0da;'
            + 'display:flex;align-items:center;gap:.8rem;font-size:.82rem;color:#6b6862';
        const ver = document.createElement('span');
        ver.textContent = `Version ${VERSION}`;
        ver.style.flex = '1';

        const repolank = document.createElement('a');
        repolank.href = REPOURL;
        repolank.target = '_blank';
        repolank.rel = 'noopener';
        repolank.textContent = 'GitHub';
        repolank.title = 'Repot med beskrivning, ändringar och källkod';
        repolank.style.cssText = `color:${ACCENT};text-decoration:underline`;

        const uppdatera_lank = document.createElement('a');
        uppdatera_lank.href = INSTALLATIONSURL;
        uppdatera_lank.target = '_blank';
        uppdatera_lank.rel = 'noopener';
        uppdatera_lank.textContent = 'Sök efter uppdatering';
        uppdatera_lank.title = 'Öppnar skriptet - Tampermonkey visar sin uppdateringsdialog '
            + 'om en nyare version finns';
        uppdatera_lank.style.cssText = `color:${ACCENT};text-decoration:underline`;
        fot.appendChild(ver);
        fot.appendChild(repolank);
        fot.appendChild(uppdatera_lank);
        ruta.appendChild(fot);

        if (installningar.kollaUppdatering) {
            // Panelen öppnas sällan, så den frågar alltid GitHub på nytt i
            // stället för att lita på dygnscachen.
            hamtaSenasteVersion(true).then((senaste) => {
                senasteVersion = senaste;
                if (!senaste || !arNyare(senaste, VERSION)) return;
                ver.textContent = `Version ${VERSION} - ${senaste} finns`;
                ver.style.color = ACCENT;
                ver.style.fontWeight = '600';
                uppdatera_lank.textContent = `Uppdatera till ${senaste}`;
                laggTillMenypost();
            });

            const visa = document.createElement('a');
            visa.href = '#';
            visa.textContent = 'Visa ändringar';
            visa.style.cssText = `color:${ACCENT};text-decoration:underline;`
                + 'cursor:pointer;font-size:.85rem;display:block;margin:.6rem 0 0';
            visa.addEventListener('click', (e) => {
                e.preventDefault();
                visaChangelog();
            });
            ruta.appendChild(visa);
        }

        // Egen rad, högerställd. Länken ovanför är inline och drog annars
        // upp knappen bredvid sig.
        const knapprad = document.createElement('div');
        knapprad.style.cssText = 'display:flex;justify-content:flex-end;margin-top:.8rem';
        const stang = document.createElement('button');
        stang.textContent = 'Stäng';
        stang.style.cssText = `background:${ACCENT};color:#fff;border:none;`
            + 'border-radius:999px;padding:.55rem 1.5rem;cursor:pointer;font-weight:600;font-size:.9rem';
        stang.addEventListener('mouseenter', () => { stang.style.background = ACCENT_HOVER; });
        stang.addEventListener('mouseleave', () => { stang.style.background = ACCENT; });
        stang.addEventListener('click', stangPanel);
        knapprad.appendChild(stang);
        ruta.appendChild(knapprad);

        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) stangPanel(); });
        document.body.appendChild(overlay);
    }

    /* ---------- Skriv ut ett öppnat verifikat ----------
     *
     * Desktopklienten hade en utskriftsikon på verifikatet. Webben har
     * ingen, och webbläsarens Ctrl+P skriver ut hela sidan bakom rutan -
     * verifikatet hamnar på första sidan och resten blir tomma ark. Uppmätt
     * på ett begravningsverifikat: tre sidor.
     *
     * Lösningen är ett utskriftsstilblad, inte en egen utskriftsvy. Då
     * gäller den både för ikonen och för den som trycker Ctrl+P av gammal
     * vana - hade knappen byggt sin egen ruta hade Ctrl+P fortsatt ge tre
     * sidor.
     *
     * Reglerna hänger på en klass som sätts på verifikatrutans portalrot,
     * alltså den direkta barnnoden till body som rymmer dialogen. Allt
     * annat under body döljs vid utskrift; knapparna inne i rutan döljs
     * också, eftersom de är kontroller och inte innehåll.
     */

    const UTSKRIFT_KLASS = 'svk-kbok-utskriftsrot';
    const EJ_UTSKRIFT_KLASS = 'svk-kbok-ej-utskrift';
    /* Reglerna gäller bara medan body bär den här klassen, alltså medan en
     * verifikatruta är öppen eller avstämningens utskriftskopia finns. Utan
     * spärren dolde stilbladet hela sidan vid Ctrl+P på alla Kbok-sidor så
     * länge inställningen var på - tomt papper i Pålysningsboken, mätt
     * 2026-09-07. */
    const UTSKRIFT_AKTIV = 'svk-kbok-skriver';

    function laggTillUtskriftsstil() {
        if (document.getElementById('svk-kbok-utskriftsstil')) return;
        const stil = document.createElement('style');
        stil.id = 'svk-kbok-utskriftsstil';
        stil.textContent = `
            @media print {
                body.${UTSKRIFT_AKTIV} > *:not(.${UTSKRIFT_KLASS}) { display: none !important; }
                .${UTSKRIFT_KLASS} .MuiBackdrop-root { display: none !important; }
                .${UTSKRIFT_KLASS} .MuiDialog-container {
                    display: block !important; height: auto !important; }
                .${UTSKRIFT_KLASS} .MuiDialog-paper {
                    position: static !important; margin: 0 !important;
                    width: 100% !important; max-width: none !important;
                    height: auto !important; max-height: none !important;
                    overflow: visible !important; box-shadow: none !important;
                    border-radius: 0 !important; }
                .${UTSKRIFT_KLASS} .MuiDialogContent-root {
                    overflow: visible !important; }
                .${UTSKRIFT_KLASS} button { display: none !important; }
                .${UTSKRIFT_KLASS} .${EJ_UTSKRIFT_KLASS} { display: none !important; }
            }
        `;
        document.head.appendChild(stil);
    }

    // Material Designs print, samma formspråk som Kboks egna ikoner.
    const UTSKRIFT_IKON = '<svg viewBox="0 0 24 24" width="20" height="20" '
        + 'fill="currentColor" aria-hidden="true">'
        + '<path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 '
        + '11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>'
        + '</svg>';

    function arVerifikatruta(dialog) {
        const rubrik = dialog.querySelector('.MuiDialogTitle-root');
        return !!rubrik && /^Verifikat\b/.test((rubrik.textContent || '').trim());
    }

    function laggTillUtskriftsknapp() {
        const dialog = [...document.querySelectorAll('[role="dialog"]')]
            .find(arVerifikatruta);
        // Spärren på body följer rutan: på medan den är öppen, av annars,
        // så Ctrl+P på en vanlig sida skriver ut sidan som vanligt.
        const kopia = document.querySelector('.svk-kbok-avstamningsutskrift');
        document.body.classList.toggle(UTSKRIFT_AKTIV, !!dialog || !!kopia);
        if (!dialog) return;

        // Portalroten bär klassen, inte dialogen: stilbladet döljer allt
        // annat direkt under body, och dialogen ligger några nivåer ned.
        const rot = [...document.body.children].find((el) => el.contains(dialog));
        if (rot) rot.classList.add(UTSKRIFT_KLASS);

        const rubrik = dialog.querySelector('.MuiDialogTitle-root');
        if (!rubrik || rubrik.querySelector('.svk-kbok-skrivut')) return;

        // Verktygsraden högst upp i innehållet består bara av knappar. De
        // döljs var för sig av stilbladet, men raden själv blir kvar som en
        // tom remsa med kantlinjer. Rader vars hela text kommer från deras
        // egna knappar är kontroller och inget annat - de döljs i sin helhet.
        const innehall = dialog.querySelector('.MuiDialogContent-root');
        if (innehall) {
            [...innehall.children].forEach((rad) => {
                const knappar = [...rad.querySelectorAll('button')];
                if (!knappar.length) return;
                const bara = (t) => (t || '').replace(/\s+/g, '');
                const knapptext = knappar.map((k) => k.innerText).join('');
                if (bara(rad.innerText) === bara(knapptext)) {
                    rad.classList.add(EJ_UTSKRIFT_KLASS);
                }
            });
        }

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'svk-kbok-skrivut';
        knapp.title = 'Skriv ut verifikatet';
        knapp.setAttribute('aria-label', 'Skriv ut verifikatet');
        knapp.innerHTML = UTSKRIFT_IKON;
        // Rubrikraden är flex med space-between. Utan margin-left:auto hade
        // en tredje nod hamnat mitt i raden i stället för intill krysset.
        knapp.style.cssText = 'background:none;border:none;cursor:pointer;padding:.35rem;'
            + 'display:inline-flex;align-items:center;color:inherit;opacity:.7;'
            + 'border-radius:50%;margin-left:auto';
        knapp.addEventListener('mouseenter', () => { knapp.style.opacity = '1'; });
        knapp.addEventListener('mouseleave', () => { knapp.style.opacity = '.7'; });
        knapp.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.print();
        });

        // Stängkrysset sitter längst till höger i rubrikraden. Ikonen läggs
        // före det, så krysset behåller sin plats i hörnet.
        const kryss = rubrik.querySelector('button');
        if (kryss) kryss.insertAdjacentElement('beforebegin', knapp);
        else rubrik.appendChild(knapp);
    }

    /* ---------- Sökbar plats ----------
     *
     * Fältet Välj plats i handlingsformulären och Pålyses i kyrka i
     * pålysningsformuläret är en MUI Autocomplete med fritext, men utan
     * filter: listan visar alla församlingens kyrkor oavsett vad man skriver.
     * Mätt i Utbildningsmiljön med fyra kyrkor - "hopp" visade alla fyra.
     * Med sjutton kyrkor i en församling blir det bläddring varje gång.
     *
     * Skriptet lägger ett filter ovanpå Kboks egen lista: alternativ som inte
     * innehåller det skrivna döljs, piltangenterna flyttar en egen markering
     * bland de synliga, Enter klickar det markerade alternativet så MUI
     * själv sätter värdet. Tab lämnar fältet som förut, med fritexten kvar.
     * Kboks egen tangentnavigering stoppas bara medan listan är öppen och
     * bara i de här fälten - den hade annars gått igenom dolda rader.
     */

    const PLATSFALT = /^(Välj plats|Pålyses i kyrka|Pålysningsplats)$/;
    const PLATS_DOLD = 'svk-kbok-plats-dold';
    const PLATS_VALD = 'svk-kbok-plats-vald';
    const PLATS_NOT = 'svk-kbok-plats-not';

    function laggTillPlatsstil() {
        if (document.getElementById('svk-kbok-platsstil')) return;
        const stil = document.createElement('style');
        stil.id = 'svk-kbok-platsstil';
        stil.textContent = `
            .${PLATS_DOLD} { display: none !important; }
            .${PLATS_VALD} { background: rgba(125, 0, 55, .08) !important; }
            .${PLATS_NOT} { padding: 6px 16px; color: #6b6862; font-size: .9em; }
        `;
        document.head.appendChild(stil);
    }

    function arPlatsfalt(input) {
        if (!input || input.getAttribute('role') !== 'combobox' || !input.id) return false;
        const etikett = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        return !!etikett && PLATSFALT.test((etikett.textContent || '').replace(/\s*\*$/, '').trim());
    }

    function platslista(input) {
        // MUI döper listrutan efter fältets id. aria-controls sätts bara
        // medan den är öppen, så id:t är den säkra vägen.
        return document.getElementById(`${input.id}-listbox`);
    }

    function synligaPlatser(lista) {
        return [...lista.querySelectorAll('[role="option"]')]
            .filter((o) => !o.classList.contains(PLATS_DOLD));
    }

    function filtreraPlatslistor() {
        document.querySelectorAll('input[role="combobox"]').forEach((input) => {
            if (!arPlatsfalt(input)) return;
            const lista = platslista(input);
            if (!lista) return;
            laggTillPlatsstil();
            const sokt = (input.value || '').trim().toLowerCase();
            let traffar = 0;
            lista.querySelectorAll('[role="option"]').forEach((o) => {
                const traff = !sokt || (o.textContent || '').toLowerCase().includes(sokt);
                o.classList.toggle(PLATS_DOLD, !traff);
                if (!traff) o.classList.remove(PLATS_VALD);
                if (traff) traffar += 1;
            });
            let not = lista.querySelector(`.${PLATS_NOT}`);
            if (!traffar) {
                if (!not) {
                    not = document.createElement('li');
                    not.className = PLATS_NOT;
                    not.setAttribute('aria-hidden', 'true');
                    lista.appendChild(not);
                }
                not.textContent = 'Ingen kyrka i listan matchar. Texten står kvar som den är.';
            } else if (not) {
                not.remove();
            }
        });
    }

    function flyttaPlatsmarkering(lista, steg) {
        const synliga = synligaPlatser(lista);
        if (!synliga.length) return;
        const nu = synliga.findIndex((o) => o.classList.contains(PLATS_VALD));
        const nasta = nu < 0
            ? (steg > 0 ? 0 : synliga.length - 1)
            : (nu + steg + synliga.length) % synliga.length;
        synliga.forEach((o, i) => o.classList.toggle(PLATS_VALD, i === nasta));
        synliga[nasta].scrollIntoView({ block: 'nearest' });
    }

    function hanteraPlatstangent(e) {
        if (!installningar.sokbarPlats) return;
        const input = e.target;
        if (!(input instanceof HTMLInputElement) || !arPlatsfalt(input)) return;
        const lista = platslista(input);
        if (!lista) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            flyttaPlatsmarkering(lista, e.key === 'ArrowDown' ? 1 : -1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const synliga = synligaPlatser(lista);
            const vald = synliga.find((o) => o.classList.contains(PLATS_VALD))
                || (synliga.length === 1 ? synliga[0] : null);
            if (vald) {
                // Klicket går till MUI:s egen hanterare, som sätter värdet i
                // det React-kontrollerade fältet och stänger listan.
                vald.click();
                return;
            }
            /* Ingen träff: fritexten står kvar och listan stängs. Utan det
             * hade Enter gått vidare till Kbok, där Enter i platsfältet
             * skickar hela formuläret och skapar posten - mätt i
             * Utbildningsmiljön, med och utan skriptet. Ett Enter för att
             * "bekräfta" ett eget kyrknamn ska inte spara en begravning. */
            input.dispatchEvent(new KeyboardEvent('keydown',
                { key: 'Escape', code: 'Escape', bubbles: true }));
        }
    }

    /* ---------- Avstämning av tacksägelser ----------
     *
     * Kyrkoordningen 24 kap. 6 §: efter ett dödsfall ska tacksägelse hållas
     * i en församlings gudstjänst, oavsett om det blir en begravning i
     * Svenska kyrkans ordning. Kbok visar ingenstans vem som saknar en. Den
     * här fliken i Pålysningsboken ställer dödsfallsverifikaten för en
     * period mot dödsfallspålysningarna och listar dem som saknar.
     *
     * Verifikaten söks för den inloggade församlingen - sökningen har ingen
     * enhetsparameter, den ignoreras tyst. Pålysningarna söks i alla
     * församlingar användaren har behörighet till, så en tacksägelse i
     * grannförsamlingen räknas.
     *
     * Fyra anrop, alla mot Kboks API med appens egen cookie:
     *
     *   Verifikat/FetchVerifikatBySearchlist   arendeTypsID 5 = Dödsfall
     *   Palysning/SearchByAttribute            kodtypPALYSNING DL = Dödsfall
     *   Verifikat/FetchVerifikatByVerifikatsId ett per verifikat - listan bär
     *                                          bara personId, inte personnummer
     *   Palysning/FetchOrCreatePalysning       ett per matchad pålysning -
     *                                          kyrklighandlingsId 0 = fristående
     *
     * Löpnumret i pålysningslistan går inte att använda för arten: för en
     * fristående pålysning fylls det med ett värde från en annan rad i
     * träfflistan (Kbok-bugg, rapporterad 2026-09-07). Därför detaljanropet.
     *
     * Inget hämtat sparas. Kryssrutan Hanterad sparas i webbläsaren som
     * verifikatets id och dagens datum, inget mer, och gallras efter ett år.
     */

    const HANTERADE_NYCKEL = 'svk-kbok-hanterade';
    const AVSTAMNING_ID = 'svk-kbok-avstamning';
    const DOLJ_KLASS = 'svk-kbok-dold-av-avstamning';
    const ARENDETYP_DODSFALL = 5;
    const PALYSNINGSTYP_DODSFALL = 'DL';
    const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
        'augusti', 'september', 'oktober', 'november', 'december'];

    /* API:t ligger på en annan värd än appen (kbok-utb-api.ksys.se för
     * Utbildningsmiljön) och produktionens adress är inte känd. Basen läses därför ur appens egna anrop när de passerar
     * XHR-patchen, aldrig ur en lista. */
    let apiBas = null;

    function kommIhagApiBas(url) {
        if (apiBas) return;
        const m = String(url).match(
            /^(https:\/\/[^/]+)\/(GetUserSession|Verifikat|Palysning|Enhet|Misc|Person)\b/);
        if (m) apiBas = m[1];
    }

    function apiAnrop(metod, sokvag, kropp) {
        return new Promise((klar, fel) => {
            if (!apiBas) {
                fel(new Error('Kbok har inte hämtat något ännu. Ladda om sidan och försök igen.'));
                return;
            }
            const xhr = new XMLHttpRequest();
            xhr.open(metod, `${apiBas}/${sokvag}`);
            xhr.withCredentials = true;
            if (kropp !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.addEventListener('load', () => {
                if (xhr.status < 200 || xhr.status >= 300) {
                    fel(new Error(`${sokvag} svarade ${xhr.status}`));
                    return;
                }
                // Inga träffar ger 204 utan kropp, inte en tom lista.
                if (xhr.status === 204 || !xhr.responseText) {
                    klar({});
                    return;
                }
                try {
                    klar(JSON.parse(xhr.responseText));
                } catch (e) {
                    fel(new Error(`${sokvag} gav ett svar som inte gick att läsa`));
                }
            });
            xhr.addEventListener('error', () => fel(new Error(`${sokvag} gick inte att nå`)));
            // Ett anrop som aldrig svarar får inte låsa knappen för evigt.
            xhr.timeout = 30000;
            xhr.addEventListener('timeout', () => fel(new Error(`${sokvag} svarade inte i tid`)));
            xhr.send(kropp === undefined ? null : JSON.stringify(kropp));
        });
    }

    /* Sidar igenom ett sökanrop. Verifikatsvaret säger total, pålysningssvaret
     * totalt. Servern får kapa sidstorleken - loopen räknar på det som kom.
     * Kom en full sida fortsätter den även om totalt säger att allt är
     * hämtat: samma API-familj räknar bevisligen fel på löpnumret, och en
     * tyst trunkering hade gett falska Saknas. */
    async function hamtaAlla(sokvag, kropp, sidstorlek) {
        const alla = [];
        let skip = 0;
        for (;;) {
            const svar = await apiAnrop('POST', sokvag, { ...kropp, skip, limit: sidstorlek });
            const poster = Array.isArray(svar.paginatedResults) ? svar.paginatedResults : [];
            alla.push(...poster);
            skip += poster.length;
            const totalt = Number(svar.totalt ?? svar.total ?? 0);
            if (!poster.length) break;
            if (skip >= totalt && poster.length < sidstorlek) break;
            if (skip > 5000) break;
        }
        return alla;
    }

    // Högst n anrop i luften samtidigt, resultaten i ursprunglig ordning.
    async function parallellt(poster, n, gor) {
        const ut = new Array(poster.length);
        let nasta = 0;
        async function arbetare() {
            while (nasta < poster.length) {
                const i = nasta++;
                ut[i] = await gor(poster[i]);
            }
        }
        await Promise.all(Array.from({ length: Math.min(n, poster.length) }, arbetare));
        return ut;
    }

    /* Kbok levererar personnumret som tolv siffror med bindestreck i båda
     * listorna (mätt). Bara den formen blir en nyckel - ett tiosiffrigt eller
     * saknat nummer går inte att para ihop säkert och räknas som okänt. */
    function normaliseratPnr(v) {
        const siffror = String(v || '').replace(/\D/g, '');
        return siffror.length === 12 ? siffror : '';
    }

    // Pålysningens datum kommer som 20250906, verifikatets som 2025-09-06.
    function visaDatum(v) {
        const s = String(v || '').trim();
        return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
    }

    function isoDatum(d) {
        const tva = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${tva(d.getMonth() + 1)}-${tva(d.getDate())}`;
    }

    function manadsgranser(ar, manad) {
        return [isoDatum(new Date(ar, manad, 1)), isoDatum(new Date(ar, manad + 1, 0))];
    }

    /* --- Hanterad-markeringarna --- */

    function lasHanterade() {
        let lista;
        try {
            lista = JSON.parse(localStorage.getItem(HANTERADE_NYCKEL)) || [];
        } catch (e) {
            lista = [];
        }
        if (!Array.isArray(lista)) lista = [];
        const grans = Date.now() - 365 * DYGN;
        const kvar = lista.filter((p) => p && p.verifikatId && Date.parse(p.datum) > grans);
        if (kvar.length !== lista.length) skrivHanterade(kvar);
        return kvar;
    }

    function skrivHanterade(lista) {
        if (lista.length) localStorage.setItem(HANTERADE_NYCKEL, JSON.stringify(lista));
        else localStorage.removeItem(HANTERADE_NYCKEL);
    }

    function sattHanterad(verifikatId, ja) {
        const utan = lasHanterade().filter((p) => String(p.verifikatId) !== String(verifikatId));
        if (ja) utan.push({ verifikatId: String(verifikatId), datum: idagsDatum() });
        skrivHanterade(utan);
    }

    function rensaHanterade() {
        localStorage.removeItem(HANTERADE_NYCKEL);
    }

    /* --- Hämtningen --- */

    async function stamAv(fran, till, status, avbruten) {
        // Efter varje väntan: har användaren bytt period eller lämnat vyn
        // slutar vi hämta. Det som redan hämtats kastas av anroparen.
        const kolla = () => { if (avbruten()) throw new Error('avbruten'); };
        status('Hämtar församlingar…');
        const session = await apiAnrop('GET', 'GetUserSession');
        const behorighet = session.permissions || {};
        const enheter = (behorighet.enheter || []).filter((e) => !e.isUpphord);
        const aktiv = (behorighet.enheter || [])
            .find((e) => e.enhetsId === behorighet.aktivEnhetId) || null;

        status('Hämtar dödsfallsverifikat…');
        const verifikat = await hamtaAlla('Verifikat/FetchVerifikatBySearchlist', {
            sortBy: 'datum',
            order: 'desc',
            objectSearchParameters: {
                form: 'vfk001',
                initieradAvEnhet: false,
                datumFrom: fran,
                datumTom: till,
                arendeTypsID: ARENDETYP_DODSFALL,
            },
        }, 50);

        kolla();
        /* Pålysningsfönstret är bredare än perioden åt båda håll. Bakåt:
         * aviseringen från Skatteverket kommer dagar efter dödsfallet, och
         * en tacksägelse söndagen efter kan alltså ligga före verifikatets
         * datum - dör någon 28 augusti, pålyses 31 augusti och aviseras 3
         * september hör pålysningen till septemberavstämningen. Framåt:
         * pålysningen kan ligga på en minnesgudstjänst ett år senare. */
        const fonsterFran = new Date(fran);
        fonsterFran.setMonth(fonsterFran.getMonth() - 6);
        const fonsterTill = new Date(till > isoDatum(new Date()) ? till : isoDatum(new Date()));
        fonsterTill.setFullYear(fonsterTill.getFullYear() + 1);
        status('Hämtar pålysningar…');
        const palysningar = await hamtaAlla('Palysning/SearchByAttribute', {
            sortBy: 'palysningsdatum',
            order: 'desc',
            objectSearchParameters: {
                enhetsIds: enheter.map((e) => e.enhetsId),
                personnummer: null,
                fornamn: '',
                efternamn: '',
                kodtypPALYSNING: PALYSNINGSTYP_DODSFALL,
                fromDatum: isoDatum(fonsterFran),
                tomDatum: isoDatum(fonsterTill),
                kyrka: null,
            },
        }, 200);

        kolla();
        const perPnr = new Map();
        palysningar.forEach((p) => {
            const nyckel = normaliseratPnr(p.personnummer);
            if (!nyckel || !p.palysningsId) return;
            if (!perPnr.has(nyckel)) perPnr.set(nyckel, []);
            perPnr.get(nyckel).push(p);
        });

        const skyddade = verifikat.filter((v) => v.arskyddadperson);
        const oppna = verifikat.filter((v) => !v.arskyddadperson);

        status(`Hämtar uppgifter om ${oppna.length} avlidna…`);
        const rader = await parallellt(oppna, 4, async (v) => {
            const rad = {
                verifikatId: v.verifikatsId,
                personId: v.personId,
                aviserat: v.datum,
                namn: '',
                personnummer: '',
                // null = kunde inte stämmas av: uppgiften saknas eller gick
                // inte att hämta. Skiljs från en tom lista, som betyder Saknas.
                palysningar: null,
                fel: '',
            };
            try {
                const detalj = await apiAnrop('GET',
                    `Verifikat/FetchVerifikatByVerifikatsId?verifikatsId=${encodeURIComponent(v.verifikatsId)}`);
                const falt = {};
                (detalj.rows || []).forEach((r) => { falt[r.label] = r.text; });
                rad.namn = falt.Namn || '';
                rad.personnummer = falt.Personnummer || '';
                const pnr = normaliseratPnr(falt.Personnummer);
                if (pnr) rad.palysningar = perPnr.get(pnr) || [];
                else rad.fel = 'Personnummer saknas - kan inte stämmas av här';
            } catch (e) {
                // Ett enda glapp får inte fälla hela månaden.
                rad.fel = 'Verifikatet gick inte att hämta';
            }
            return rad;
        });

        kolla();
        const matchade = rader.flatMap((r) => r.palysningar || []);
        status(`Kontrollerar ${matchade.length} pålysningar…`);
        await parallellt(matchade, 4, async (p) => {
            try {
                const d = await apiAnrop('POST', 'Palysning/FetchOrCreatePalysning',
                    { palysningsId: p.palysningsId });
                p.knuten = !!d.kyrklighandlingsId;
                p.dodsdatum = d.dodsdatum || p.datum;
            } catch (e) {
                p.knuten = null;
                p.dodsdatum = p.datum;
            }
        });
        rader.forEach((r) => {
            r.dodsdatum = [...new Set((r.palysningar || []).map((p) => visaDatum(p.dodsdatum))
                .filter(Boolean))].join(', ');
        });
        kolla();

        // Verifikatet bär inget dödsdatum. Saknas pålysning hämtas det ur
        // personakten, där avregistreringsdatumet är dödsdagen. Uppmätt att
        // anropet inte hamnar i startsidans Senaste personer.
        const utanDatum = rader.filter((r) => !r.dodsdatum && r.personId);
        if (utanDatum.length) status(`Hämtar dödsdatum för ${utanDatum.length} avlidna…`);
        await parallellt(utanDatum, 4, async (r) => {
            try {
                const akt = await apiAnrop('POST', 'Person/FetchPersonakt', { personId: r.personId });
                const person = akt.kyrkoperson || {};
                if ((person.avregistreringsorsak || {}).kod === 'AV') {
                    r.dodsdatum = visaDatum(person.avregistreringsdatum);
                }
            } catch (e) {
                // Kolumnen blir tom, resten av raden står kvar.
            }
        });

        return { aktiv, antalEnheter: enheter.length, rader, skyddade };
    }

    /* --- Vyn --- */

    // Ett objekt per sidladdning av Pålysningsboken: flikknappen, panelen
    // och om vår flik är den valda.
    let avstamning = null;

    function laggTillAvstamningsstil() {
        if (document.getElementById('svk-kbok-avstamningsstil')) return;
        const stil = document.createElement('style');
        stil.id = 'svk-kbok-avstamningsstil';
        stil.textContent = `
            .${DOLJ_KLASS} { display: none !important; }
            #${AVSTAMNING_ID} { padding: 1rem 0 1.5rem; font-size: 14px; }
            #${AVSTAMNING_ID} .svk-kbok-rad { display: flex; flex-wrap: wrap; gap: .6rem;
                align-items: center; margin-bottom: .8rem; }
            #${AVSTAMNING_ID} .svk-kbok-manad { font: inherit; font-weight: 600; min-width: 10rem;
                text-align: center; text-transform: capitalize; border: 1px solid #c9c5bd;
                border-radius: 6px; padding: .3rem .5rem; background: #fff; cursor: pointer; }
            #${AVSTAMNING_ID} .svk-kbok-pil { border: 1px solid #c9c5bd; background: #fff;
                border-radius: 6px; width: 2rem; height: 2rem; cursor: pointer; font: inherit; }
            #${AVSTAMNING_ID} input[type=date] { font: inherit; padding: .3rem .5rem;
                border: 1px solid #c9c5bd; border-radius: 6px; }
            #${AVSTAMNING_ID} .svk-kbok-summering { margin: .2rem 0 .8rem; }
            #${AVSTAMNING_ID} .svk-kbok-status { color: #6b6862; }
            #${AVSTAMNING_ID} .svk-kbok-status.svk-kbok-fel { color: #b3261e; }
            .svk-kbok-avstamningstabell { border-collapse: collapse; width: 100%; }
            .svk-kbok-avstamningstabell th, .svk-kbok-avstamningstabell td {
                text-align: left; vertical-align: top; padding: .45rem .6rem;
                border-bottom: 1px solid #e5e2dc; }
            .svk-kbok-avstamningstabell th { font-weight: 600; white-space: nowrap; }
            .svk-kbok-avstamningstabell .svk-kbok-mitt { text-align: center; }
            .svk-kbok-avstamningstabell .svk-kbok-mitt input { vertical-align: middle; }
            .svk-kbok-avstamningstabell .svk-kbok-saknas { color: #b3261e; font-weight: 600; }
            .svk-kbok-avstamningstabell .svk-kbok-fristaende { color: ${ACCENT}; font-weight: 600; }
            .svk-kbok-avstamningstabell tr.svk-kbok-hanterad td { opacity: .5; }
            .svk-kbok-avstamningstabell a { color: ${ACCENT}; }
            .svk-kbok-avstamningstabell .svk-kbok-dampad { color: #6b6862; font-size: .9em; }
            .svk-kbok-avstamningsutskrift { display: none; }
            @media print {
                .svk-kbok-avstamningsutskrift { display: block; font: 11pt/1.4 sans-serif; }
                .svk-kbok-avstamningsutskrift h2 { font-size: 14pt; margin: 0 0 .3rem; }
                .svk-kbok-avstamningsutskrift .svk-kbok-avstamningstabell tr { break-inside: avoid; }
            }
        `;
        document.head.appendChild(stil);
    }

    function el(tagg, klass, text) {
        const e = document.createElement(tagg);
        if (klass) e.className = klass;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function byggAvstamning(tablist) {
        laggTillAvstamningsstil();
        laggTillKnappstil();

        /* Flikknappen får appens egna MUI-klasser från en granne, så den
         * ser ut som de andra. Klassen Mui-selected sätts och tas bort av
         * skriptet självt - React känner inte till knappen. */
        const granne = tablist.querySelector('[role="tab"]');
        const flik = document.createElement('button');
        flik.type = 'button';
        flik.setAttribute('role', 'tab');
        flik.id = `${AVSTAMNING_ID}-flik`;
        flik.className = (granne ? granne.className : '')
            .split(/\s+/).filter((k) => k && k !== 'Mui-selected').join(' ');
        flik.textContent = 'Avstämning';
        tablist.appendChild(flik);

        const panel = document.createElement('div');
        panel.id = AVSTAMNING_ID;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', flik.id);
        panel.hidden = true;

        const tillstand = {
            flik, panel, vald: false, fran: null, till: null, resultat: null, period: null,
            borttagen: false,
        };

        // Föregående kalendermånad är förvald: avstämningen görs månaden
        // efter, när aviseringarna hunnit komma.
        const nu = new Date();
        let ar = nu.getFullYear();
        let manad = nu.getMonth() - 1;
        if (manad < 0) { manad = 11; ar -= 1; }

        const rad = el('div', 'svk-kbok-rad');
        const bakat = el('button', 'svk-kbok-pil', '‹');
        bakat.type = 'button';
        bakat.title = 'Föregående månad';
        // Månaden är ett månadsfält: klicka på den och välj månad och år
        // direkt, i stället för att stega. Webbläsaren visar den på svenska.
        const manadstext = document.createElement('input');
        manadstext.type = 'month';
        manadstext.className = 'svk-kbok-manad';
        manadstext.setAttribute('aria-label', 'Månad');
        let egetIntervallValt = false;
        const periodtext = () => (egetIntervallValt ? 'Eget intervall' : `${MANADER[manad]} ${ar}`);
        const framat = el('button', 'svk-kbok-pil', '›');
        framat.type = 'button';
        framat.title = 'Nästa månad';
        const franFalt = document.createElement('input');
        franFalt.type = 'date';
        franFalt.setAttribute('aria-label', 'Aviserat fr.o.m.');
        const tillFalt = document.createElement('input');
        tillFalt.type = 'date';
        tillFalt.setAttribute('aria-label', 'Aviserat t.o.m.');
        const kor = el('button', KNAPP_KLASS, 'Stäm av');
        kor.type = 'button';
        const skrivUt = el('button', `${KNAPP_KLASS} svk-kbok-sekundar`, 'Skriv ut');
        skrivUt.type = 'button';
        const rensa = el('button', `${KNAPP_KLASS} svk-kbok-sekundar`, 'Rensa sparade markeringar');
        rensa.type = 'button';
        rad.append(bakat, manadstext, framat, franFalt, el('span', null, 'till'), tillFalt,
            kor, skrivUt, rensa);
        panel.appendChild(rad);

        const summering = el('p', 'svk-kbok-summering');
        panel.appendChild(summering);
        const status = el('p', 'svk-kbok-status');
        panel.appendChild(status);
        const yta = el('div');
        panel.appendChild(yta);

        function sattManad() {
            [tillstand.fran, tillstand.till] = manadsgranser(ar, manad);
            franFalt.value = tillstand.fran;
            tillFalt.value = tillstand.till;
            egetIntervallValt = false;
            manadstext.value = `${ar}-${String(manad + 1).padStart(2, '0')}`;
        }

        function egetIntervall() {
            tillstand.fran = franFalt.value;
            tillstand.till = tillFalt.value;
            egetIntervallValt = true;
            manadstext.value = '';
        }

        bakat.addEventListener('click', () => {
            manad -= 1;
            if (manad < 0) { manad = 11; ar -= 1; }
            sattManad();
            korAvstamning();
        });
        framat.addEventListener('click', () => {
            manad += 1;
            if (manad > 11) { manad = 0; ar += 1; }
            sattManad();
            korAvstamning();
        });
        manadstext.addEventListener('change', () => {
            const traff = manadstext.value.match(/^(\d{4})-(\d{2})$/);
            if (!traff) return;
            ar = Number(traff[1]);
            manad = Number(traff[2]) - 1;
            sattManad();
            korAvstamning();
        });
        franFalt.addEventListener('change', egetIntervall);
        tillFalt.addEventListener('change', egetIntervall);
        kor.addEventListener('click', korAvstamning);
        skrivUt.addEventListener('click', () => skrivUtAvstamning(tillstand, summering.textContent));
        rensa.addEventListener('click', () => {
            if (!window.confirm('Ta bort alla sparade Hanterad-markeringar i den här webbläsaren?')) return;
            rensaHanterade();
            if (tillstand.resultat) rita();
        });

        /* Varje körning får ett eget nummer och låser sin period vid start.
         * Byter användaren månad medan en hämtning pågår är den gamla
         * körningen inaktuell: den slutar hämta, ritar ingenting och en ny
         * körning startar för den valda perioden. Utan det hade en
         * augustilista kunnat visas under septembers rubrik. */
        let pagar = false;
        let senasteKorning = 0;
        async function korAvstamning() {
            const korning = ++senasteKorning;
            if (pagar) return; // den pågående ser att den blivit omsprungen
            if (!tillstand.fran || !tillstand.till) {
                status.classList.add('svk-kbok-fel');
                status.textContent = 'Ange både från- och till-datum.';
                return;
            }
            const period = {
                fran: tillstand.fran,
                till: tillstand.till,
                text: periodtext(),
            };
            const inaktuell = () => korning !== senasteKorning || tillstand.borttagen;
            pagar = true;
            kor.disabled = true;
            status.classList.remove('svk-kbok-fel');
            yta.textContent = '';
            summering.textContent = '';
            try {
                const resultat = await stamAv(period.fran, period.till, (t) => {
                    if (!inaktuell()) status.textContent = t;
                }, inaktuell);
                if (inaktuell()) return;
                tillstand.resultat = resultat;
                tillstand.period = period;
                status.textContent = '';
                rita();
            } catch (e) {
                if (inaktuell()) return;
                console.warn('svk-kbok-enhancements: avstämningen misslyckades', e);
                status.classList.add('svk-kbok-fel');
                status.textContent = `Avstämningen gick inte att göra: ${e.message}`;
            } finally {
                pagar = false;
                kor.disabled = false;
                // Perioden byttes under hämtningen: kör om för den nya.
                if (korning !== senasteKorning && !tillstand.borttagen) korAvstamning();
            }
        }

        function rita() {
            const { aktiv, antalEnheter, rader, skyddade } = tillstand.resultat;
            const hanterade = new Set(lasHanterade().map((p) => String(p.verifikatId)));
            rader.forEach((r) => { r.hanterad = hanterade.has(String(r.verifikatId)); });

            const saknar = rader.filter((r) => r.palysningar && !r.palysningar.length);
            const okanda = rader.filter((r) => !r.palysningar);
            const p = tillstand.period;
            const period = p.text === 'Eget intervall' ? `${p.fran} till ${p.till}` : `i ${p.text}`;
            summering.textContent = `${aktiv ? aktiv.enhetsNamn : 'Vald församling'}: `
                + `${rader.length + skyddade.length} dödsfall aviserade ${period}, `
                + `${saknar.length} utan pålysning, `
                + (okanda.length ? `${okanda.length} som inte kunde stämmas av, ` : '')
                + `${rader.filter((r) => r.hanterad).length} markerade som hanterade. `
                + `Pålysningar sökta i ${antalEnheter} ${antalEnheter === 1 ? 'församling' : 'församlingar'}.`;

            yta.textContent = '';
            if (!rader.length && !skyddade.length) {
                yta.appendChild(el('p', 'svk-kbok-status', 'Inga dödsfallsverifikat i perioden.'));
                return;
            }

            // Utan pålysning först, sedan de som inte gick att stämma av,
            // hanterade sist, annars senast aviserad först.
            const ordning = (r) => (r.hanterad ? 3 : !r.palysningar ? 1 : r.palysningar.length ? 2 : 0);
            rader.sort((a, b) => ordning(a) - ordning(b) || (a.aviserat < b.aviserat ? 1 : -1));

            yta.appendChild(byggTabell(rader, tillstand));

            if (skyddade.length) {
                const p = el('p', 'svk-kbok-status');
                p.style.marginTop = '.8rem';
                p.textContent = `${skyddade.length} ${skyddade.length === 1 ? 'verifikat' : 'verifikat'} `
                    + 'gäller skyddade personer och kan inte stämmas av här. Aviserat: '
                    + skyddade.map((v) => visaDatum(v.datum)).join(', ') + '.';
                yta.appendChild(p);
            }
        }

        placeraAvstamningspanel(tablist, panel);

        flik.addEventListener('click', () => {
            tillstand.vald = true;
            synkaAvstamningsflik();
            if (!tillstand.resultat && !pagar) korAvstamning();
        });

        sattManad();
        return tillstand;
    }

    /* Panelen läggs efter appens egna paneler, som är syskon till
     * flikraden och växlar med attributet hidden. Finns de inte än hamnar
     * den direkt efter flikradens rot. */
    function placeraAvstamningspanel(tablist, panel) {
        const appPanel = [...document.querySelectorAll('[role="tabpanel"]')]
            .filter((p) => /^palysning-tab-panel/.test(p.id)).pop();
        const rot = tablist.closest('.MuiTabs-root') || tablist.parentElement;
        (appPanel || rot).insertAdjacentElement('afterend', panel);
    }

    function byggTabell(rader, tillstand) {
        const tabell = el('table', 'svk-kbok-avstamningstabell');
        const huvud = el('thead');
        const hr = el('tr');
        ['Avliden', 'Dödsdatum', 'Aviserat', 'Pålysning', 'Art', 'Hanterad', 'Öppna']
            .forEach((t) => hr.appendChild(el('th', t === 'Hanterad' ? 'svk-kbok-mitt' : null, t)));
        huvud.appendChild(hr);
        tabell.appendChild(huvud);
        const kropp = el('tbody');

        rader.forEach((r) => {
            const tr = el('tr', r.hanterad ? 'svk-kbok-hanterad' : '');
            tr.dataset.verifikatId = r.verifikatId;

            const avliden = el('td');
            avliden.appendChild(el('div', null, r.namn || '(uppgift saknas)'));
            avliden.appendChild(el('div', 'svk-kbok-dampad', r.personnummer));
            tr.appendChild(avliden);

            tr.appendChild(el('td', null, r.dodsdatum || ''));
            tr.appendChild(el('td', null, visaDatum(r.aviserat)));

            const palysning = el('td');
            const art = el('td');
            if (!r.palysningar) {
                palysning.appendChild(el('span', 'svk-kbok-dampad', r.fel || 'Kan inte stämmas av här'));
            } else if (!r.palysningar.length) {
                palysning.appendChild(el('span', 'svk-kbok-saknas', 'Saknas'));
            } else {
                r.palysningar.forEach((p) => {
                    // Datum och församling räcker här - kyrkan står i pålysningen.
                    const lank = el('a', null,
                        [visaDatum(p.palysningsdatum), p.forsamling].filter(Boolean).join(' · '));
                    lank.href = `/palysning/${p.palysningsId}`;
                    palysning.appendChild(el('div')).appendChild(lank);
                    const artrad = el('div');
                    // Löpnumret säger självt att pålysningen är knuten.
                    if (p.knuten === true) {
                        artrad.textContent = p.lopnr || 'Knuten';
                    } else if (p.knuten === false) {
                        artrad.appendChild(el('span', 'svk-kbok-fristaende', 'Fristående'));
                    } else {
                        artrad.textContent = 'Art okänd';
                    }
                    art.appendChild(artrad);
                });
                const forsamlingar = new Set(r.palysningar.map((p) => p.forsamling));
                if (forsamlingar.size > 1) {
                    art.appendChild(el('div', 'svk-kbok-dampad', `${forsamlingar.size} församlingar`));
                }
            }
            tr.appendChild(palysning);
            tr.appendChild(art);

            const hanterad = el('td', 'svk-kbok-mitt');
            const kryss = document.createElement('input');
            kryss.type = 'checkbox';
            kryss.checked = r.hanterad;
            kryss.setAttribute('aria-label', `Hanterad: ${r.namn}`);
            kryss.style.cssText = `accent-color:${ACCENT};width:16px;height:16px;cursor:pointer`;
            kryss.addEventListener('change', () => {
                sattHanterad(r.verifikatId, kryss.checked);
                r.hanterad = kryss.checked;
                tr.classList.toggle('svk-kbok-hanterad', kryss.checked);
                // Summeringen räknar om, raden flyttar först vid nästa ritning.
                const antal = tillstand.resultat.rader.filter((x) => x.hanterad).length;
                const summering = tillstand.panel.querySelector('.svk-kbok-summering');
                summering.textContent = summering.textContent
                    .replace(/\d+ markerade som hanterade/, `${antal} markerade som hanterade`);
            });
            hanterad.appendChild(kryss);
            tr.appendChild(hanterad);

            const oppna = el('td');
            const verifikatlank = el('a', null, 'Verifikat');
            verifikatlank.href = '/';
            verifikatlank.title = 'Öppnar verifikatet';
            verifikatlank.addEventListener('click', (e) => {
                e.preventDefault();
                // Flikraden är appens eget element och bär en React-fiber;
                // vår tabell gör det inte.
                oppnaVerifikat(r.verifikatId, document.querySelector('[role="tablist"]'));
            });
            oppna.appendChild(verifikatlank);
            if (personaktUrl(r.personId)) {
                oppna.appendChild(el('span', 'svk-kbok-dampad', ' · '));
                const lank = el('a', null, 'Personakt');
                lank.href = personaktUrl(r.personId);
                lank.target = '_blank';
                lank.rel = 'noopener';
                oppna.appendChild(lank);
            }
            tr.appendChild(oppna);
            kropp.appendChild(tr);
        });
        tabell.appendChild(kropp);
        return tabell;
    }

    /* Verifikatet har ingen egen adress. Rutan styrs av en React-kontext
     * (VerifikatWindowProvider) som ligger runt hela appen, och dess värde
     * går att nå från vilket element som helst genom att följa fiberns
     * föräldrakedja uppåt: Provider-fibern bär värdet i memoizedProps.value.
     * Anropet öppnar rutan på plats, på den sida man står. Löftet det
     * returnerar infrias först när rutan stängs, så det inväntas inte.
     *
     * Reserv: startsidan läser ett openVerifikatId ur navigeringens
     * tillstånd - så gör appen själv efter en registrering. Routern lyssnar
     * på popstate och läser history.state.usr, så ett pushState följt av
     * ett eget popstate-event tar samma väg, men byter sida.
     * Båda vägarna verifierade i Utbildningsmiljön. */
    function verifikatfonster(fran) {
        const nyckel = Object.keys(fran).find((k) => k.startsWith('__reactFiber$'));
        let fiber = nyckel && fran[nyckel];
        for (let steg = 0; fiber && steg < 500; steg++) {
            const varde = fiber.memoizedProps && fiber.memoizedProps.value;
            if (varde && typeof varde.openVerifikatWindow === 'function') return varde;
            fiber = fiber.return;
        }
        return null;
    }

    function oppnaVerifikat(verifikatId, fran) {
        const fonster = fran && verifikatfonster(fran);
        if (fonster) {
            try {
                Promise.resolve(fonster.openVerifikatWindow(Number(verifikatId),
                    { markInfoAsViewedOnClose: false })).catch(() => {});
                return;
            } catch (e) {
                console.warn('svk-kbok-enhancements: verifikatrutan gick inte att öppna på plats', e);
            }
        } else {
            // Syns i konsolen den dag Kbok byter komponentträd, innan någon
            // användare hinner undra varför klicket byter sida.
            console.warn('svk-kbok-enhancements: hittade inte verifikatrutans kontext, går via startsidan');
        }
        const state = {
            usr: { openVerifikatId: Number(verifikatId), markInfoAsViewedOnClose: false },
            key: Math.random().toString(36).slice(2, 10),
            idx: ((history.state && history.state.idx) || 0) + 1,
        };
        history.pushState(state, '', '/');
        dispatchEvent(new PopStateEvent('popstate', { state }));
    }

    /* Utskriften går samma väg som verifikatutskriften: en kopia av listan
     * läggs direkt under body med utskriftsklassen, stilbladet döljer allt
     * annat, och kopian tas bort när utskriftsdialogen stängts. */
    function skrivUtAvstamning(tillstand, summering) {
        if (!tillstand.resultat) return;
        laggTillUtskriftsstil();
        const kopia = el('div', `${UTSKRIFT_KLASS} svk-kbok-avstamningsutskrift`);
        kopia.appendChild(el('h2', null, 'Avstämning av tacksägelser'));
        kopia.appendChild(el('p', null, summering));
        const tabell = tillstand.panel.querySelector('.svk-kbok-avstamningstabell');
        if (tabell) {
            const klon = tabell.cloneNode(true);
            // Kryssrutans läge följer inte med i en klon - skriv det som text.
            klon.querySelectorAll('input[type=checkbox]').forEach((k, i) => {
                const original = tabell.querySelectorAll('input[type=checkbox]')[i];
                k.replaceWith(document.createTextNode(original && original.checked ? 'Ja' : ''));
            });
            klon.querySelectorAll('a').forEach((a) => {
                a.replaceWith(document.createTextNode(a.textContent));
            });
            kopia.appendChild(klon);
        } else {
            kopia.appendChild(el('p', null, 'Inga dödsfallsverifikat i perioden.'));
        }
        document.body.appendChild(kopia);
        document.body.classList.add(UTSKRIFT_AKTIV);
        window.addEventListener('afterprint', () => {
            kopia.remove();
            document.body.classList.remove(UTSKRIFT_AKTIV);
        }, { once: true });
        window.print();
    }

    /* Körs vid varje DOM-ändring. Ser till att fliken finns när
     * Pålysningsboken visas, och att vald-läget håller trots att React ritar
     * om flikraden - React sätter tillbaka Mui-selected på sin egen flik och
     * visar sin panel, så båda tas om hand här. */
    function synkaAvstamningsflik() {
        const forsta = document.getElementById('palysning-tab-0');
        const tablist = forsta && forsta.closest('[role="tablist"]');
        if (!tablist) {
            // Sidan lämnad, eller flikraden borta för ett ögonblick: ta bort
            // vårt så en pågående hämtning inte skriver i en lös panel.
            if (avstamning) {
                avstamning.borttagen = true;
                avstamning.panel.remove();
                avstamning.flik.remove();
            }
            avstamning = null;
            return;
        }
        if (!avstamning) {
            avstamning = byggAvstamning(tablist);
        } else {
            // React kan ha ritat om flikraden eller panelernas förälder;
            // samma knapp och panel sätts då tillbaka med sitt innehåll.
            if (!tablist.contains(avstamning.flik)) tablist.appendChild(avstamning.flik);
            if (!document.body.contains(avstamning.panel)) {
                placeraAvstamningspanel(tablist, avstamning.panel);
            }
        }
        const { flik, panel, vald } = avstamning;
        const appFlikar = [...tablist.querySelectorAll('[role="tab"]')].filter((t) => t !== flik);
        const appPaneler = [...document.querySelectorAll('[role="tabpanel"]')]
            .filter((p) => /^palysning-tab-panel/.test(p.id));
        const indikator = tablist.parentElement.querySelector('.MuiTabs-indicator');

        flik.classList.toggle('Mui-selected', vald);
        flik.setAttribute('aria-selected', String(vald));
        flik.style.boxShadow = vald ? 'inset 0 -2px 0 currentColor' : '';
        panel.hidden = !vald;
        if (vald) {
            // Samma inre luft som appens egna flikar: innehållet börjar i
            // linje med flikraden, hur kortet än är byggt i den här miljön.
            panel.style.paddingLeft = '0px';
            panel.style.paddingRight = '0px';
            const luft = Math.max(0, Math.round(
                tablist.getBoundingClientRect().left - panel.getBoundingClientRect().left));
            panel.style.paddingLeft = `${luft}px`;
            panel.style.paddingRight = `${luft}px`;
        }
        appFlikar.forEach((t) => {
            if (vald) {
                t.classList.remove('Mui-selected');
                t.setAttribute('aria-selected', 'false');
            } else if (t.dataset.svkKbokVald === 'true') {
                t.classList.add('Mui-selected');
                t.setAttribute('aria-selected', 'true');
            }
            // Minns vilken appflik som var vald när vi tog över, så den kan
            // återfå markeringen innan React hunnit rita om.
            if (!vald) t.dataset.svkKbokVald = String(t.classList.contains('Mui-selected'));
        });
        if (indikator) indikator.style.visibility = vald ? 'hidden' : '';
        appPaneler.forEach((p) => p.classList.toggle(DOLJ_KLASS, vald));
        // Skapa, Ta bort markerade och Rapporter hör till appens lista och
        // gör inget för vår. Raden de står i döljs medan vår flik är vald.
        const knapprad = appensKnapprad(tablist);
        if (knapprad) knapprad.classList.toggle(DOLJ_KLASS, vald);
    }

    function appensKnapprad(tablist) {
        const knappar = [...document.querySelectorAll('main button')]
            .filter((b) => /^(Skapa|Ta bort markerade|Rapporter)\b/.test((b.textContent || '').trim()));
        if (knappar.length < 2) return null;
        // Närmaste gemensamma förälder som inte också rymmer flikraden.
        let rad = knappar[0].parentElement;
        while (rad && !knappar.every((k) => rad.contains(k))) rad = rad.parentElement;
        return rad && !rad.contains(tablist) ? rad : null;
    }

    /* Klick på någon av appens flikar lämnar vår. Lyssnaren sitter på
     * document, inte på flikraden - React byter ut flikraden vid omritning,
     * och en lyssnare på det gamla elementet hade följt med i papperskorgen. */
    function lamnaAvstamningVidFlikklick(e) {
        if (!avstamning || !avstamning.vald) return;
        const t = e.target.closest('[role="tab"]');
        if (!t || t === avstamning.flik || !/^palysning-tab-/.test(t.id)) return;
        avstamning.vald = false;
        synkaAvstamningsflik();
    }

    function taBortAvstamningsflik() {
        if (!avstamning) return;
        avstamning.vald = false;
        synkaAvstamningsflik();
        avstamning.borttagen = true;
        avstamning.flik.remove();
        avstamning.panel.remove();
        avstamning = null;
    }

    /* ---------- Menypost i användarmenyn ----------
     *
     * Avatarmenyn är en NAV.MuiList-root med posterna Byt församling,
     * Inställningar och Logga ut. Posten klonas från Inställningar, så den
     * ärver appens egen formatering i stället för att härma den.
     *
     * Menyn byggs om varje gång den öppnas, så posten måste läggas till på
     * nytt vid varje öppning - det sköter MutationObserver.
     */

    function laggTillMenypost() {
        // Menyposten byggs om av appen vid varje öppning. Har versionsläget
        // ändrats sedan den sattes in måste den bytas ut, annars saknas
        // pricken tills menyn öppnas nästa gång.
        const befintlig = document.querySelector('.' + MENY_KLASS);
        if (befintlig && befintlig.dataset.svkKbokNy !== String(finnsNyareVersion())) {
            befintlig.remove();
        }
        const nav = document.querySelector('nav.MuiList-root, .MuiList-root');
        if (!nav || nav.querySelector('.' + MENY_KLASS)) return;

        const poster = [...nav.children];
        const forlaga = poster.find((el) => (el.innerText || '').trim() === 'Inställningar');
        if (!forlaga) return;

        const post = forlaga.cloneNode(true);
        post.classList.add(MENY_KLASS);

        // Byt ikonen mot ett plustecken - posten är ett tillägg, inte en
        // av appens egna funktioner.
        const ikon = post.querySelector('.MuiListItemIcon-root');
        if (ikon) {
            ikon.innerHTML = '';
            const tecken = document.createElement('span');
            tecken.textContent = '✚';
            tecken.style.cssText = 'font-size:17px;line-height:1;opacity:.75';
            ikon.appendChild(tecken);
        }
        const text = post.querySelector('.MuiListItemText-primary')
            || post.querySelector('.MuiTypography-root');
        if (text) {
            text.textContent = PRODUKTNAMN;
            // En prick räcker - menyposten är trång, och panelen säger vilken
            // version det gäller.
            if (finnsNyareVersion()) {
                const prick = document.createElement('span');
                prick.textContent = ' \u25CF';
                prick.title = `Version ${senasteVersion} finns`;
                prick.style.cssText = `color:${ACCENT};font-size:.7em;`
                    + 'vertical-align:middle';
                text.appendChild(prick);
            }
        }

        // Klonen bär med sig förlagans lyssnare i vissa webbläsare - byt ut
        // noden mot en ren kopia av sig själv innan vår egen kopplas på.
        const ren = post.cloneNode(true);
        // Speglar versionsläget posten byggdes med, så den kan bytas ut när
        // det ändras.
        ren.dataset.svkKbokNy = String(finnsNyareVersion());
        ren.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            stangMenyn();
            if (!document.getElementById('svk-kbok-panel')) byggPanel();
        });

        forlaga.insertAdjacentElement('afterend', ren);
    }

    function stangMenyn() {
        // Menyn ligger i en MUI-popover; Escape stänger den utan att välja.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const bakgrund = document.querySelector('.MuiBackdrop-root');
        if (bakgrund) bakgrund.click();
    }

    /* ---------- Markerbart personnummer ----------
     *
     * MUI DataGrid fångar klick på hela raden, så ett försök att markera
     * ett personnummer med musen öppnar personakten i stället. Cellen har
     * data-field="PERSNR" - klickhändelser stoppas där, så texten går att
     * dra över och kopiera. Dubbelklick för att öppna posten fungerar
     * fortfarande överallt utom i just den cellen.
     */

    function gorPersonnummerMarkerbart(rad) {
        const cell = rad.querySelector('[data-field="PERSNR"]');
        if (!cell) return;
        const pa = installningar.markerbartPersonnummer;
        cell.style.userSelect = pa ? 'text' : '';
        cell.style.cursor = pa ? 'text' : '';
        cell.title = pa ? 'Personnumret går att markera och kopiera' : '';
        if (cell.dataset.svkKbokMarkerbar) return;
        cell.dataset.svkKbokMarkerbar = '1';
        // Lyssnaren sitter kvar men frågar efter inställningen vid varje
        // klick. Att koppla bort den hade krävt namngivna funktioner per
        // cell, och cellerna byts ut hela tiden av gridens virtualisering.
        ['mousedown', 'click', 'dblclick'].forEach((h) =>
            cell.addEventListener(h, (e) => {
                if (installningar.markerbartPersonnummer) e.stopPropagation();
            }));
    }

    /* ---------- Fokus på Bekräfta verifikat ----------
     *
     * Verifikat-dialogen öppnas utan att någon knapp har fokus - kontrollerat
     * via document.activeElement, som är dialogens container. Enter gör
     * därför ingenting, till skillnad från enkla OK-dialoger där OK-knappen
     * fokuseras automatiskt. I desktopklienten kunde man bekräfta direkt med
     * Enter efter att ha stämplat.
     */

    function fokuseraBekrafta() {
        if (!installningar.fokusBekraftaVerifikat) return;
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog || dialog.dataset.svkKbokFokus) return;
        const knapp = [...dialog.querySelectorAll('button')].find(
            (b) => (b.innerText || '').trim() === 'Bekräfta verifikat' && !b.disabled);
        if (!knapp) return;
        dialog.dataset.svkKbokFokus = '1';
        knapp.focus();
    }

    /* ---------- Kör om vid varje DOM-ändring ---------- */

    /* Varje steg körs för sig. Utan det skulle ett undantag i en funktion
     * avbryta alla som står efter i listan - och eftersom uppdatera() körs vid
     * varje DOM-ändring skulle avbrottet upprepas för resten av sidbesöket,
     * tyst för den som inte har konsolen öppen. */
    function sakert(namn, gor) {
        try {
            gor();
        } catch (e) {
            console.warn(`svk-kbok-enhancements: ${namn} misslyckades`, e);
        }
    }

    function uppdatera() {
        sakert('menyposten', laggTillMenypost);
        // En query, inte två - listan används av båda stegen nedan.
        const rader = [...document.querySelectorAll(RAD)];
        if (installningar.nyflikLank) {
            sakert('länkikonen', () => {
                laggTillKolumnrubrik();
                rader.forEach(laggTillLank);
            });
        }
        sakert('markerbart personnummer',
            () => rader.forEach(gorPersonnummerMarkerbart));
        if (installningar.autoHamta) {
            sakert('auto-hämtning', () => {
                document.querySelectorAll('input').forEach((f) => {
                    if (arRelationsfalt(f)) kopplaAutoHamta(f);
                });
            });
        }
        sakert('datumtabb', stallInDatumTabb);
        sakert('fokus i datumfältet', fokuseraDatumfalt);
        if (installningar.blankettnamn) {
            sakert('gruppnamnet', kommIhagGruppnamn);
            sakert('personnamnet', kommIhagPersonnamn);
            sakert('dopinbjudans datum', kommIhagDopinbjudan);
        }
        if (installningar.skrivUtVerifikat) {
            sakert('utskriftsknappen', () => {
                laggTillUtskriftsstil();
                laggTillUtskriftsknapp();
            });
        }
        sakert('miljövalet', hanteraMiljoval);
        sakert('gallring vid utloggning', gallraVidUtloggning);
        if (installningar.sokbarPlats) sakert('sökbar plats', filtreraPlatslistor);
        if (installningar.avstamningTacksagelser) {
            sakert('avstämningen', synkaAvstamningsflik);
        } else {
            sakert('avstämningen', taBortAvstamningsflik);
        }
        sakert('pålysningsdatum', tomPalysningsdatum);
        sakert('fokus på Bekräfta', fokuseraBekrafta);
    }

    /* Patcharna läggs på omedelbart, före appen hunnit köra något. Skriptet
     * körs därför med @run-at document-start.
     *
     * Det spelar roll för fangaPersonid: kommer patchen efter appens första
     * anrop har svaret redan passerat, kartan är tom och Ministerialbokens
     * rader får ingen ikon förrän användaren söker om. Verifierat - med
     * skriptet pålagt efter listladdningen blev det 0 ikoner, och 12 först
     * efter en ny sökning.
     *
     * De läggs på en gång, inte i uppdatera() - den körs vid varje DOM-ändring
     * och hade staplat lager på lager av omslutande funktioner.
     */
    dopOmNedladdningar();
    fangaPersonid();

    // Resten rör DOM:en och väntar därför in den.
    function start() {
        let vantar = false;
        new MutationObserver(() => {
            if (vantar) return;
            vantar = true;
            requestAnimationFrame(() => { vantar = false; uppdatera(); });
        }).observe(document.body, { childList: true, subtree: true });

        document.addEventListener('click', kravAdressVidVerifikat, true);
        document.addEventListener('click', lamnaAvstamningVidFlikklick, true);
        document.addEventListener('mousedown', hindraAutoscroll, true);
        document.addEventListener('auxclick', oppnaViaMittenklick, true);
        document.addEventListener('keydown', hanteraGenvag, true);
        document.addEventListener('keydown', hanteraPlatstangent, true);
        // Att skriva ändrar fältets värde men inte DOM:en, så MutationObserver
        // ser det inte. Filtret körs därför även vid varje tecken.
        document.addEventListener('input', (e) => {
            if (installningar.sokbarPlats && arPlatsfalt(e.target)) {
                sakert('sökbar plats', filtreraPlatslistor);
            }
        }, true);
        document.addEventListener('keydown', hanteraDagensDatum, true);
        uppdatera();
        // Efter uppdatera(), så inställningarna hunnit läsas in.
        sakert('uppdateringskontroll', kollaUppdateringVidStart);

        console.log('svk-kbok-enhancements laddat');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
