// ==UserScript==
// @name         Kbok-tillägg
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.17
// @description  Öppna personakt i ny flik, markerbart personnummer, auto-hämta relationsperson, tabb förbi datumväljaren och tangentbordsgenvägar. Inställningar via kugghjulet.
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

    const NYCKEL = 'svk-kbok-enhancements';
    const LANK_KLASS = 'svk-kbok-nyflik';
    const RAD = '[role="row"][data-id]';
    const KOLUMNBREDD = 34;
    const MENY_KLASS = 'svk-kbok-menypost';
    const PRODUKTNAMN = 'Kbok Plus';
    const VERSION = '0.17';
    // Tampermonkey hämtar den här adressen med jämna mellanrum, jämför
    // @version och erbjuder uppdatering när numret höjts. Raw-länken gäller
    // först när repot är publicerat på GitHub; fram till dess installeras
    // skriptet från den lokala servern och uppdateras för hand.
    const INSTALLATIONSURL = 'https://raw.githubusercontent.com/armandur/'
        + 'svk-kbok-enhancements/main/svk-kbok-enhancements.user.js';
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
    };

    const ETIKETTER = {
        nyflikLank: 'Länkikon i träfflistor som öppnar personakten i ny flik',
        mittenklick: 'Mittenklick på en rad öppnar personakten i ny flik',
        autoHamta: 'Hämta personen automatiskt så fort personnumret är komplett',
        hoppaOverDatumvaljare: 'Hoppa över kalenderknappen vid tabb, så datum går att skriva rakt igenom',
        markerbartPersonnummer: 'Gör personnumret i träfflistor markerbart utan att posten öppnas',
        dagensDatum: 'D i ett tomt datumfält fyller i dagens datum',
        blankettnamn: 'Döp om nedladdade blanketter och bevis till handlingsdatum, typ och namn',
        minnsMiljo: 'Kom ihåg miljövalet i Utbildningsmiljön, så det inte behöver göras om i varje ny flik',
        visaBlankett: 'Visa blanketten i en ruta med Skriv ut och Ladda ner i stället för att ladda ner den direkt',
        tomPalysningsdatum: 'Förifyll inte nästa söndag som pålysningsdatum - lämna fältet tomt',
        fokusBekraftaVerifikat: 'Sätt fokus på Bekräfta verifikat när dialogen öppnas, så Enter bekräftar (irreversibelt)',
        genvagarPa: 'Tangentbordsgenvägar',
    };

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
    };

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
        return true;
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
        return personnamnUr(document.querySelector('main')) || ihagkommetNamn();
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
        const namn = personnamnUr(document.querySelector('main'));
        const pnr = synligtPersonnummer();
        if (namn && pnr) {
            sessionStorage.setItem(PERSONNYCKEL, JSON.stringify({ pnr, namn }));
        }
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
        if (!arBlankett && BEVIS.indexOf(typ) < 0) return null;
        const namn = handlingensNamndel();
        if (!namn) return null;
        const delar = [];
        if (arBlankett) {
            const datum = handlingsdatum();
            if (datum) delar.push(datum);
        }
        delar.push(typ, namn);
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

    function laddaNer(url, filnamn) {
        const lank = document.createElement('a');
        lank.href = url;
        lank.download = filnamn;
        document.body.appendChild(lank);
        ORIGINALKLICK.call(lank);
        lank.remove();
    }

    function byggBlankettruta(url, filnamn) {
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-blankett';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);'
            + 'display:flex;align-items:center;justify-content:center;padding:min(2rem,4vw)';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;'
            + 'width:min(60rem,100%);height:100%;display:flex;flex-direction:column;'
            + 'box-shadow:0 8px 32px rgba(0,0,0,.25);overflow:hidden;'
            + 'font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const huvud = document.createElement('div');
        huvud.style.cssText = 'display:flex;align-items:center;padding:.9rem 1.2rem;'
            + 'border-bottom:1px solid #e5e2dc';
        const namn = document.createElement('span');
        namn.textContent = filnamn;
        namn.style.cssText = 'flex:1;font-weight:600;overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap';
        huvud.appendChild(namn);
        ruta.appendChild(huvud);

        const ram = document.createElement('iframe');
        // toolbar=0 döljer webbläsarens egen verktygsrad i PDF-visaren. Dess
        // nedladdningsknapp föreslår blob-URL:ens GUID som filnamn, alltså
        // precis den fälla rutan finns till för att undvika. Zoom fungerar
        // ändå med Ctrl och scrollhjulet.
        ram.src = `${url}#toolbar=0&navpanes=0`;
        ram.style.cssText = 'flex:1;width:100%;border:0';
        ruta.appendChild(ram);

        const fot = document.createElement('div');
        fot.style.cssText = 'display:flex;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;'
            + 'padding:.9rem 1.2rem;border-top:1px solid #e5e2dc';

        function stang() {
            overlay.remove();
            document.removeEventListener('keydown', viaEscape, true);
            // Blobben är skriptets egen kopia, ingen annan använder den.
            URL.revokeObjectURL(url);
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
                    ram.contentWindow.focus();
                    ram.contentWindow.print();
                } catch (e) {
                    console.warn('svk-kbok-enhancements: kunde inte skriva ut', e);
                }
            }],
            ['Ladda ner', true, () => laddaNer(url, filnamn)],
            ['Stäng', false, stang],
        ].forEach(([text, primar, gor]) => {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.textContent = text;
            knapp.style.cssText = 'padding:.45rem 1.1rem;border-radius:6px;cursor:pointer;'
                + 'font:inherit;font-weight:600;white-space:nowrap;'
                + (primar
                    ? `background:${ACCENT};color:#fff;border:1px solid ${ACCENT}`
                    : `background:#fff;color:${ACCENT};border:1px solid ${ACCENT}`);
            if (primar) {
                knapp.addEventListener('mouseenter', () => { knapp.style.background = ACCENT_HOVER; });
                knapp.addEventListener('mouseleave', () => { knapp.style.background = ACCENT; });
            }
            knapp.addEventListener('click', gor);
            fot.appendChild(knapp);
        });

        ruta.appendChild(fot);
        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) stang();
        });
        document.addEventListener('keydown', viaEscape, true);
        document.body.appendChild(overlay);
    }

    function visaBlankett(url, filnamn) {
        // Egen kopia av blobben: appen tar bort länken direkt efter klicket
        // och kan återkalla sin blob-URL, och då hade ramen visat en tom sida.
        fetch(url)
            .then((svar) => svar.blob())
            .then((blob) => byggBlankettruta(URL.createObjectURL(blob), filnamn))
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

    /* ---------- Inställningspanel ----------
     *
     * Sitter som ett kugghjul i sidhuvudet, bredvid Kboks egna ikoner.
     * Användarmenyn under avataren vore en naturligare plats, men den
     * byggs om av appen vid varje öppning och en injicerad post försvinner.
     */

    function byggPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'svk-kbok-panel';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);'
            + 'display:flex;align-items:center;justify-content:center';

        const ruta = document.createElement('div');
        ruta.style.cssText = 'background:#fff;color:#1c1b19;border-radius:10px;padding:1.4rem 1.6rem;'
            + 'max-width:34rem;width:calc(100% - 2rem);box-shadow:0 8px 32px rgba(0,0,0,.25);'
            + 'font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

        const rubrik = document.createElement('h2');
        rubrik.textContent = PRODUKTNAMN;
        rubrik.style.cssText = 'margin:0 0 .2rem;font-size:1.1rem';
        ruta.appendChild(rubrik);

        const ingress = document.createElement('p');
        ingress.textContent = 'Inställningarna sparas i den här webbläsaren.';
        ingress.style.cssText = 'margin:0 0 1rem;color:#6b6862;font-size:.9rem';
        ruta.appendChild(ingress);

        Object.keys(STANDARD).forEach((nyckel) => {
            const rad = document.createElement('label');
            rad.style.cssText = 'display:flex;gap:.6rem;align-items:flex-start;margin:.7rem 0;cursor:pointer';
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
            if (nyckel === 'fokusBekraftaVerifikat') {
                text.style.color = ACCENT;
            }
            rad.appendChild(kryss);
            rad.appendChild(text);
            ruta.appendChild(rad);
        });

        /* Genvägar med inspelning. Inget bibliotek behövs - keydown bär
         * redan tangent och modifierare, och att spela in en kombination är
         * att läsa nästa keydown och beskriva den. */
        const genvRubrik = document.createElement('h3');
        genvRubrik.textContent = 'Genvägar';
        genvRubrik.style.cssText = 'font-size:.95rem;margin:1.3rem 0 .2rem';
        ruta.appendChild(genvRubrik);

        const genvHjalp = document.createElement('p');
        genvHjalp.textContent = 'Klicka på en tangentkombination och tryck den nya du vill använda.';
        genvHjalp.style.cssText = 'margin:0 0 .6rem;color:#6b6862;font-size:.85rem';
        ruta.appendChild(genvHjalp);

        Object.entries(KOMMANDON).forEach(([nyckel, kmd]) => {
            const rad = document.createElement('div');
            rad.style.cssText = 'display:flex;gap:.7rem;align-items:center;margin:.45rem 0';

            const namn = document.createElement('span');
            namn.textContent = kmd.etikett;
            namn.title = kmd.gammal || '';
            namn.style.cssText = 'flex:1';

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
            ruta.appendChild(rad);
        });

        const fot = document.createElement('div');
        fot.style.cssText = 'margin-top:1.3rem;padding-top:.9rem;border-top:1px solid #e3e0da;'
            + 'display:flex;align-items:center;gap:.8rem;font-size:.82rem;color:#6b6862';
        const ver = document.createElement('span');
        ver.textContent = `Version ${VERSION}`;
        ver.style.flex = '1';
        const uppdatera_lank = document.createElement('a');
        uppdatera_lank.href = INSTALLATIONSURL;
        uppdatera_lank.target = '_blank';
        uppdatera_lank.rel = 'noopener';
        uppdatera_lank.textContent = 'Sök efter uppdatering';
        uppdatera_lank.title = 'Öppnar skriptet - Tampermonkey visar sin uppdateringsdialog '
            + 'om en nyare version finns';
        uppdatera_lank.style.cssText = `color:${ACCENT};text-decoration:underline`;
        fot.appendChild(ver);
        fot.appendChild(uppdatera_lank);
        ruta.appendChild(fot);

        const stang = document.createElement('button');
        stang.textContent = 'Stäng';
        stang.style.cssText = `margin-top:1rem;background:${ACCENT};color:#fff;border:none;`
            + 'border-radius:999px;padding:.55rem 1.5rem;cursor:pointer;font-weight:600;font-size:.9rem';
        stang.addEventListener('mouseenter', () => { stang.style.background = ACCENT_HOVER; });
        stang.addEventListener('mouseleave', () => { stang.style.background = ACCENT; });
        stang.addEventListener('click', () => overlay.remove());
        ruta.appendChild(stang);

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
        if (text) text.textContent = PRODUKTNAMN;

        // Klonen bär med sig förlagans lyssnare i vissa webbläsare - byt ut
        // noden mot en ren kopia av sig själv innan vår egen kopplas på.
        const ren = post.cloneNode(true);
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

    function uppdatera() {
        laggTillMenypost();
        if (installningar.nyflikLank) {
            laggTillKolumnrubrik();
            document.querySelectorAll(RAD).forEach(laggTillLank);
        }
        document.querySelectorAll(RAD).forEach(gorPersonnummerMarkerbart);
        if (installningar.autoHamta) {
            document.querySelectorAll('input').forEach((f) => {
                if (arRelationsfalt(f)) kopplaAutoHamta(f);
            });
        }
        stallInDatumTabb();
        if (installningar.blankettnamn) {
            kommIhagGruppnamn();
            kommIhagPersonnamn();
        }
        hanteraMiljoval();
        tomPalysningsdatum();
        fokuseraBekrafta();
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

        document.addEventListener('mousedown', hindraAutoscroll, true);
        document.addEventListener('auxclick', oppnaViaMittenklick, true);
        document.addEventListener('keydown', hanteraGenvag, true);
        document.addEventListener('keydown', hanteraDagensDatum, true);
        uppdatera();

        console.log('svk-kbok-enhancements laddat');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
