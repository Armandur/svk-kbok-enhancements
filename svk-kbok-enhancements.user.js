// ==UserScript==
// @name         Kbok-tillägg
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.44
// @description  Öppna posten i ny flik, auto-hämta personen, tabb förbi datumväljaren, döpta blanketter, adresskrav på verifikat och tangentbordsgenvägar. Inställningar via Kbok Plus i menyn under avataren.
// @match        https://kbok.svenskakyrkan.se/*
// @match        https://kbok-utbildning.svenskakyrkan.se/*
// @match        https://testmiljön/*
// @match        https://testmiljön/*
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
    const VERSION = '0.44';
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
              'fokusDatum', 'kravAdress', 'tomPalysningsdatum'] },
        { rubrik: 'Blanketter och rapporter',
          nycklar: ['blankettnamn', 'visaBlankett'] },
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

    function klickaKnappMedText(text) {
        const knapp = [...document.querySelectorAll('button')].find(
            (b) => (b.innerText || '').trim() === text && !b.disabled);
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

    function personaktUrl(id) {
        return `${location.origin}/personakt/${id}`;
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
                    poster.forEach((post) => {
                        if (post && post.kyrklighandlingsId && post.personid) {
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
        if (!id) return null;
        // Sök personer: radens id ÄR personaktens, och där finns ingen
        // handling att öppna.
        if (arPersonlista(rad)) return personaktUrl(id);
        const post = HANDLING.get(id);
        if (!post) return null;
        const vy = HANDLINGSVY[post.kod];
        // Okänd handlingstyp: personakten är bättre än ingen länk alls.
        if (!vy) return personaktUrl(post.personid);
        const fraga = post.kod === 'V' ? `?kyrklighandlingsId=${id}` : '';
        return `${personaktUrl(post.personid)}/${vy}${fraga}`;
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
        try {
            const sparat = JSON.parse(sessionStorage.getItem(PERSONNYCKEL) || 'null');
            if (sparat && sparat.pnr === pnr) return;
        } catch (e) {
            // Trasigt värde: skriv över det nedan.
        }
        const namn = personnamnUr(document.querySelector('main'));
        if (namn) {
            sessionStorage.setItem(PERSONNYCKEL, JSON.stringify({ pnr, namn }));
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
            if (!sparat) return null;
            return sparat.pnr === synligtPersonnummer() ? sparat.namn : null;
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
        const gruppnamn = sessionStorage.getItem(GRUPPNYCKEL);
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

    async function lasZip(blob) {
        const data = new Uint8Array(await blob.arrayBuffer());
        const vy = new DataView(data.buffer);
        // Katalogen hittas via End of Central Directory, som ligger sist.
        let eocd = -1;
        for (let i = data.length - 22; i >= 0 && i > data.length - 65558; i--) {
            if (vy.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('ingen zip-katalog');
        const antal = vy.getUint16(eocd + 10, true);
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
        const rad = zip.data.subarray(start, start + post.storlek);
        if (post.metod === 0) return new TextDecoder().decode(rad);
        return new Response(new Blob([rad]).stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }

    function arkTillRader(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return [...doc.getElementsByTagName('row')].map((rad) => {
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
        byggBlankettruta(null, filnamn, yta, () => laddaNer(
            URL.createObjectURL(blob), filnamn));
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
                            laddaNer(URL.createObjectURL(blob), filnamn);
                        });
                }
                if (blob.type !== 'application/pdf') {
                    laddaNer(URL.createObjectURL(blob), filnamn);
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

    function dopOmNedladdningar() {
        HTMLAnchorElement.prototype.click = function () {
            try {
                const ursprung = this.getAttribute('download');
                if (ursprung && installningar.blankettnamn) {
                    const nytt = byggFilnamn(ursprung);
                    // Går inget namn att bygga lämnas Kboks eget i fred - ett
                    // igenkännbart filnamn är bättre än ett stympat.
                    if (nytt) this.setAttribute('download', nytt);
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
        stang.addEventListener('click', () => overlay.remove());
        knapprad.appendChild(stang);
        ruta.appendChild(knapprad);

        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
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
        sakert('miljövalet', hanteraMiljoval);
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
        document.addEventListener('mousedown', hindraAutoscroll, true);
        document.addEventListener('auxclick', oppnaViaMittenklick, true);
        document.addEventListener('keydown', hanteraGenvag, true);
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
