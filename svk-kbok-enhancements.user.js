// ==UserScript==
// @name         Kbok-tillägg
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.4
// @description  Öppna personakt i ny flik, markerbart personnummer, auto-hämta relationsperson, tabb förbi datumväljaren och tangentbordsgenvägar. Inställningar via kugghjulet.
// @match        https://kbok.svenskakyrkan.se/*
// @match        https://kbok-utbildning.svenskakyrkan.se/*
// @match        https://testmiljön/*
// @match        https://testmiljön/*
// @run-at       document-idle
// @grant        none
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
        autoHamta: 'Hämta relationspersonens namn automatiskt när personnumret är komplett',
        hoppaOverDatumvaljare: 'Hoppa över kalenderknappen vid tabb, så datum går att skriva rakt igenom',
        markerbartPersonnummer: 'Gör personnumret i träfflistor markerbart utan att posten öppnas',
        dagensDatum: 'D i ett tomt datumfält fyller i dagens datum',
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

    /* ---------- Länkikon per rad ---------- */

    function laggTillLank(rad) {
        if (rad.querySelector('.' + LANK_KLASS)) return;
        const id = rad.getAttribute('data-id');
        if (!id) return;
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
        a.href = personaktUrl(id);
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Öppna personakten i ny flik';
        a.textContent = '↗';
        a.style.cssText = 'text-decoration:none;font-size:14px;line-height:1;'
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
        const rubrikrad = document.querySelector('[role="columnheader"]');
        if (!rubrikrad || !rubrikrad.parentElement) return;
        const rad = rubrikrad.parentElement;
        if (rad.querySelector('.' + LANK_KLASS)) return;
        const cell = document.createElement('div');
        cell.className = LANK_KLASS + ' MuiDataGrid-columnHeader';
        cell.setAttribute('role', 'columnheader');
        cell.style.cssText = `width:${KOLUMNBREDD}px;min-width:${KOLUMNBREDD}px;`
            + `max-width:${KOLUMNBREDD}px;padding:0`;
        rad.insertBefore(cell, rad.firstChild);
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
        return rad && rad.getAttribute('data-id') ? rad : null;
    }

    function hindraAutoscroll(e) {
        if (radUnder(e)) e.preventDefault();
    }

    function oppnaViaMittenklick(e) {
        const rad = radUnder(e);
        if (!rad) return;
        e.preventDefault();
        window.open(personaktUrl(rad.getAttribute('data-id')), '_blank', 'noopener');
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

    function hittaHamtaKnapp(falt) {
        let el = falt;
        for (let i = 0; i < 5 && el; i++) {
            el = el.parentElement;
            if (!el) break;
            const knapp = el.querySelector('button');
            if (knapp) return knapp;
        }
        return null;
    }

    function arRelationsfalt(falt) {
        const id = (falt.id || '').toLowerCase();
        if (!/persnr|personnummer/.test(id)) return false;
        if (id === 'searchpersonnummer') return false;
        if (id.startsWith('huvudperson')) return false;
        return true;
    }

    function kopplaAutoHamta(falt) {
        if (falt.dataset.svkKbokKopplad) return;
        falt.dataset.svkKbokKopplad = '1';
        falt.addEventListener('change', () => {
            if (!installningar.autoHamta) return;
            if (!KOMPLETT_PNR.test((falt.value || '').trim())) return;
            const knapp = hittaHamtaKnapp(falt);
            if (knapp && !knapp.disabled) knapp.click();
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

        const stang = document.createElement('button');
        stang.textContent = 'Stäng';
        stang.style.cssText = `margin-top:1.3rem;background:${ACCENT};color:#fff;border:none;`
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
        fokuseraBekrafta();
    }

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
})();
