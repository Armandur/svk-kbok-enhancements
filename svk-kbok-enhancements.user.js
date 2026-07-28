// ==UserScript==
// @name         Kbok-tillägg
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.2
// @description  Öppna personakt i ny flik, auto-hämta relationsperson, hoppa över datumväljaren vid tabb. Inställningar via kugghjulet i sidhuvudet.
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

    const STANDARD = {
        nyflikLank: true,
        mittenklick: true,
        autoHamta: true,
        hoppaOverDatumvaljare: true,
    };

    const ETIKETTER = {
        nyflikLank: 'Länkikon i träfflistor som öppnar personakten i ny flik',
        mittenklick: 'Mittenklick på en rad öppnar personakten i ny flik',
        autoHamta: 'Hämta relationspersonens namn automatiskt när personnumret är komplett',
        hoppaOverDatumvaljare: 'Hoppa över kalenderknappen vid tabb, så datum går att skriva rakt igenom',
    };

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
        const cell = rad.querySelector('[role="gridcell"]');
        if (!cell) return;

        const a = document.createElement('a');
        a.className = LANK_KLASS;
        a.href = personaktUrl(id);
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Öppna personakten i ny flik';
        a.textContent = '↗';
        a.style.cssText = 'margin-left:4px;text-decoration:none;font-size:13px;'
            + 'line-height:1;opacity:0.45;cursor:pointer;color:inherit;padding:2px';
        a.addEventListener('mouseenter', () => { a.style.opacity = '1'; });
        a.addEventListener('mouseleave', () => { a.style.opacity = '0.45'; });
        // Griden lyssnar på klick i raden för att markera och öppna - hindra
        // att länkklicket också räknas som ett radklick.
        ['click', 'mousedown', 'dblclick'].forEach((h) =>
            a.addEventListener(h, (e) => e.stopPropagation()));

        cell.appendChild(a);
    }

    function taBortLankar() {
        document.querySelectorAll('.' + LANK_KLASS).forEach((a) => a.remove());
    }

    /* ---------- Mittenklick var som helst på raden ---------- */

    function hanteraMittenklick(e) {
        if (!installningar.mittenklick || e.button !== 1) return;
        const rad = e.target.closest(RAD);
        if (!rad) return;
        const id = rad.getAttribute('data-id');
        if (!id) return;
        e.preventDefault();
        window.open(personaktUrl(id), '_blank', 'noopener');
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
        rubrik.textContent = 'Kbok-tillägg';
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
            kryss.style.cssText = 'margin-top:.25rem;flex:none';
            kryss.addEventListener('change', () => {
                installningar[nyckel] = kryss.checked;
                sparaInstallningar();
                if (nyckel === 'nyflikLank' && !kryss.checked) taBortLankar();
                uppdatera();
            });
            const text = document.createElement('span');
            text.textContent = ETIKETTER[nyckel];
            rad.appendChild(kryss);
            rad.appendChild(text);
            ruta.appendChild(rad);
        });

        const stang = document.createElement('button');
        stang.textContent = 'Stäng';
        stang.style.cssText = 'margin-top:1.2rem;background:#7d0037;color:#fff;border:none;'
            + 'border-radius:999px;padding:.55rem 1.3rem;cursor:pointer;font-weight:600';
        stang.addEventListener('click', () => overlay.remove());
        ruta.appendChild(stang);

        overlay.appendChild(ruta);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    function laggTillKugghjul() {
        const banner = document.querySelector('header, [role="banner"]');
        if (!banner || banner.querySelector('#svk-kbok-kugge')) return;
        const knapp = document.createElement('button');
        knapp.id = 'svk-kbok-kugge';
        knapp.type = 'button';
        knapp.title = 'Inställningar för Kbok-tillägg';
        knapp.textContent = '⚙';
        knapp.style.cssText = 'background:none;border:none;cursor:pointer;font-size:19px;'
            + 'opacity:.55;padding:6px 8px;color:inherit;line-height:1';
        knapp.addEventListener('mouseenter', () => { knapp.style.opacity = '1'; });
        knapp.addEventListener('mouseleave', () => { knapp.style.opacity = '.55'; });
        knapp.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.getElementById('svk-kbok-panel')) return;
            byggPanel();
        });

        // Före den första av Kboks egna ikoner, så den inte hamnar mitt i
        // deras grupp.
        const forsta = banner.querySelector('button');
        if (forsta && forsta.parentElement) forsta.parentElement.insertBefore(knapp, forsta);
        else banner.appendChild(knapp);
    }

    /* ---------- Kör om vid varje DOM-ändring ---------- */

    function uppdatera() {
        laggTillKugghjul();
        if (installningar.nyflikLank) document.querySelectorAll(RAD).forEach(laggTillLank);
        if (installningar.autoHamta) {
            document.querySelectorAll('input').forEach((f) => {
                if (arRelationsfalt(f)) kopplaAutoHamta(f);
            });
        }
        stallInDatumTabb();
    }

    let vantar = false;
    new MutationObserver(() => {
        if (vantar) return;
        vantar = true;
        requestAnimationFrame(() => { vantar = false; uppdatera(); });
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('mousedown', hanteraMittenklick, true);
    document.addEventListener('auxclick', hanteraMittenklick, true);
    uppdatera();

    console.log('svk-kbok-enhancements laddat');
})();
