// ==UserScript==
// @name         Kbok – öppna personakt i ny flik + auto-hämta relationsperson
// @namespace    https://kbok.svenskakyrkan.se/
// @version      0.1
// @description  Länkikon och mittenklick öppnar personakten i ny flik. Auto-hämtar relationspersoners namn när personnumret är komplett.
// @match        https://kbok.svenskakyrkan.se/*
// @match        https://kbok-utbildning.svenskakyrkan.se/*
// @match        https://testmiljön/*
// @match        https://testmiljön/*
// @run-at       document-idle
// ==/UserScript==

/* Kbok är en MUI-app. Två saker styr hur skriptet är byggt:
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
 */

(function () {
    'use strict';

    const LANK_KLASS = 'svk-kbok-nyflik';
    const RAD = '[role="row"][data-id]';

    function personaktUrl(id) {
        return `${location.origin}/personakt/${id}`;
    }

    /* ---------- Länkikon per rad ---------- */

    function laggTillLank(rad) {
        if (rad.querySelector('.' + LANK_KLASS)) return;
        const id = rad.getAttribute('data-id');
        if (!id) return;

        // Första cellen är kryssrutekolumnen i de flesta listor. Lägg
        // ikonen i den cell som har minst innehåll, annars i den första.
        const celler = rad.querySelectorAll('[role="gridcell"]');
        if (!celler.length) return;
        const vard = celler[0];

        const a = document.createElement('a');
        a.className = LANK_KLASS;
        a.href = personaktUrl(id);
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Öppna personakten i ny flik';
        a.textContent = '↗';
        a.style.cssText = [
            'margin-left:4px', 'text-decoration:none', 'font-size:13px',
            'line-height:1', 'opacity:0.45', 'cursor:pointer',
            'color:inherit', 'padding:2px',
        ].join(';');
        a.addEventListener('mouseenter', () => { a.style.opacity = '1'; });
        a.addEventListener('mouseleave', () => { a.style.opacity = '0.45'; });
        // Griden lyssnar på klick i raden för att markera/öppna - hindra
        // att länkklicket också räknas som ett radklick.
        a.addEventListener('click', (e) => { e.stopPropagation(); });
        a.addEventListener('mousedown', (e) => { e.stopPropagation(); });
        a.addEventListener('dblclick', (e) => { e.stopPropagation(); });

        vard.appendChild(a);
    }

    /* ---------- Mittenklick var som helst på raden ---------- */

    function hanteraMittenklick(e) {
        if (e.button !== 1) return;
        const rad = e.target.closest(RAD);
        if (!rad) return;
        const id = rad.getAttribute('data-id');
        if (!id) return;
        e.preventDefault();
        window.open(personaktUrl(id), '_blank', 'noopener');
    }

    /* ---------- Auto-hämta relationspersoner ----------
     *
     * Relationspersonfälten (vardnadshavare1.persnr, vardnadshavare2.persnr,
     * relationsperson i Begravning, Person 1 i pålysningsformuläret) har en
     * NAMNLÖS ikonknapp bredvid sig som måste klickas för att namnet ska
     * hämtas. Att bara skriva personnumret ger tomt namn, och i
     * pålysningsformuläret misslyckas Spara sedan helt utan felmeddelande.
     *
     * Skriptet klickar knappen åt dig när fältet innehåller ett komplett
     * personnummer. Huvudsökningens fält lämnas ifred - där är knappen
     * tydligt märkt "Hämta" och att söka i förtid vore påträngande.
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
        // Huvudsökningen och personuppgiftssektionen sköter sig själva.
        if (id === 'searchpersonnummer') return false;
        if (id.startsWith('huvudperson')) return false;
        return true;
    }

    function kopplaAutoHamta(falt) {
        if (falt.dataset.svkKbokKopplad) return;
        falt.dataset.svkKbokKopplad = '1';
        falt.addEventListener('change', () => {
            const varde = (falt.value || '').trim();
            if (!KOMPLETT_PNR.test(varde)) return;
            const knapp = hittaHamtaKnapp(falt);
            if (knapp && !knapp.disabled) knapp.click();
        });
    }

    /* ---------- Kör om vid varje DOM-ändring ---------- */

    function uppdatera() {
        document.querySelectorAll(RAD).forEach(laggTillLank);
        document.querySelectorAll('input').forEach((f) => {
            if (arRelationsfalt(f)) kopplaAutoHamta(f);
        });
    }

    let vantar = false;
    const observer = new MutationObserver(() => {
        if (vantar) return;
        vantar = true;
        requestAnimationFrame(() => { vantar = false; uppdatera(); });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('mousedown', hanteraMittenklick, true);
    document.addEventListener('auxclick', hanteraMittenklick, true);
    uppdatera();

    console.log('svk-kbok-enhancements laddat');
})();
