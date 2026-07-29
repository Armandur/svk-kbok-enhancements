"""Skärmdumpar till README, tagna i Utbildningsmiljön med skriptet injicerat.

Tre bilder: inställningspanelen, visningsrutan med en blankett och en
träfflista med länkikonen.

Utbildningsmiljöns personer är fiktiv övningsdata som får publiceras. testmiljön
får inte användas här - där finns riktiga testpersoner.

Skriptet injiceras med add_init_script, som motsvarar @run-at
document-start. Registreringen måste ske före inloggningens första
navigering, annars hinner appen starta först. PDF-visaren finns bara i
den fullständiga Chromium-kanalen; standard-headless ger en tom ram.

Körs: ~/.local/share/shot-venv/bin/python verktyg/skarmdumpar.py [steg]
Kräver KBOK_UTB_* - se kbok-web/docs/inloggning.md.
"""

import asyncio
import json
import os
import sys

from playwright.async_api import async_playwright

KBOK_VERKTYG = os.environ.get(
    "KBOK_WEB_VERKTYG", "/home/rasmus/workspace/kbok-web/manual/verktyg"
)
sys.path.insert(0, KBOK_VERKTYG)
from testa_inloggning import login_utb  # noqa: E402

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKRIPT = os.path.join(ROT, "svk-kbok-enhancements.user.js")
OUT = os.environ.get("KBOK_SCREENSHOT_DIR", os.path.join(ROT, "skarmdumpar"))
GRANSKNING = os.environ.get("KBOK_REVIEW_DIR", "/tmp/kbok-enhancements-shots")

# Visningsrutan är av som standard och måste slås på för att gå att
# fotografera. Övriga inställningar lämnas i standardläget, så panelbilden
# visar vad man faktiskt får vid installation.
INSTALLNINGAR = {"visaBlankett": True}

VIEWPORT = {"width": 1440, "height": 900}
HOG_VIEWPORT = {"width": 1440, "height": 1800}
RADER_I_BILD = 8


async def skarmdumpa(page, locator, namn):
    """Beskuren bild till repot, hel sida till granskningen.

    Helsidesbilden är till för att se om utsnittet tappat sammanhang -
    en tom PDF-ram eller en lista utan ikoner ser likadan ut i ett klipp
    som en lyckad bild.
    """
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(GRANSKNING, exist_ok=True)
    await page.screenshot(path=f"{GRANSKNING}/{namn}-hel.png", full_page=True)
    await locator.screenshot(path=f"{OUT}/{namn}.png")
    print(f"   sparad: {OUT}/{namn}.png")


async def starta(p):
    # channel="chromium" - standard-headless saknar PDF-visaren.
    webblasare = await p.chromium.launch(channel="chromium", args=["--no-sandbox"])
    page = await webblasare.new_page(viewport=VIEWPORT)
    # Ordningen är viktig: inställningarna måste ligga i localStorage innan
    # skriptet läser dem vid start.
    await page.add_init_script(
        "try { localStorage.setItem('svk-kbok-enhancements', "
        f"{json.dumps(json.dumps(INSTALLNINGAR))}); }} catch (e) {{}}"
    )
    await page.add_init_script(path=SKRIPT)
    await login_utb(page)
    return webblasare, page


async def oppna_panelen(page):
    """Panelen ligger som ✚ Kbok Plus i menyn under avataren."""
    banner = page.locator("header, [role='banner']").first
    knappar = banner.get_by_role("button")
    await knappar.last.click()
    await page.wait_for_timeout(700)
    await page.get_by_text("Kbok Plus", exact=False).first.click()
    await page.wait_for_selector("#svk-kbok-panel", timeout=8000)
    await page.wait_for_timeout(500)


async def steg_panel(page):
    print("1. Inställningspanelen")
    # Panelen har egen scroll och kapas annars av viewporthöjden.
    await page.set_viewport_size(HOG_VIEWPORT)
    await page.wait_for_timeout(400)
    await oppna_panelen(page)
    await skarmdumpa(page, page.locator("#svk-kbok-panel > div"), "panel")
    await page.keyboard.press("Escape")
    await page.locator("#svk-kbok-panel").evaluate("el => el.remove()")
    await page.set_viewport_size(VIEWPORT)
    await page.wait_for_timeout(400)


async def ga_till_ministerialbok(page):
    await page.get_by_role("link", name="Ministerialbok", exact=True).click()
    await page.wait_for_timeout(1500)


async def steg_lista(page):
    print("2. Träfflistan med länkikonen")
    await ga_till_ministerialbok(page)
    rader = page.locator("[role='row'][data-id]")
    antal = await rader.count()
    ikoner = await page.locator(".svk-kbok-nyflik").count()
    print(f"   rader: {antal}, länkikoner: {ikoner}")
    kolumner = await page.locator("[role='columnheader']").evaluate_all(
        "els => els.map(e => e.getAttribute('data-field'))"
    )
    print("   kolumner:", kolumner)
    for i in range(min(3, antal)):
        text = await rader.nth(i).inner_text()
        print(f"   rad {i}: {text!r}")
    # Handlingstyp-filtret står öppet när vyn laddat och lägger sig över de
    # översta raderna.
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(600)

    # Sortera på handlingsdatum stigande. Listan innehåller annars dagens
    # egna testposter överst, och de ser ut som skräp i en README-bild.
    await page.locator("[role='columnheader'][data-field='forrattningsdatum']").click()
    await page.wait_for_timeout(1200)
    # Rubrikens verktygstips ligger kvar över första raden så länge musen
    # står på kolumnhuvudet.
    await page.mouse.move(20, 860)
    await page.wait_for_timeout(1200)

    # Griden sträcks till vyns höjd och är bredare än fönstret. Klipp efter
    # ett antal rader och vid personnummerkolumnens högerkant, så bilden
    # slutar på en kolumngräns i stället för mitt i nästa rubrik. Raderna
    # är virtualiserade och ligger inte i visuell ordning i DOM:en - mät
    # och sortera på y.
    grid = await page.locator(".MuiDataGrid-root").first.bounding_box()
    boxar = await rader.evaluate_all(
        "els => els.map(e => e.getBoundingClientRect()).map(r => [r.top, r.bottom])"
    )
    boxar.sort()
    nedre = boxar[min(RADER_I_BILD, len(boxar)) - 1][1]
    kolumn = await page.locator("[role='columnheader'][data-field='personnummer']").bounding_box()
    klipp = {
        "x": grid["x"],
        "y": grid["y"],
        "width": kolumn["x"] + kolumn["width"] - grid["x"] + 12,
        "height": nedre - grid["y"],
    }
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(GRANSKNING, exist_ok=True)
    await page.screenshot(path=f"{GRANSKNING}/trafflista-hel.png", full_page=True)
    await page.screenshot(path=f"{OUT}/trafflista.png", clip=klipp)
    print(f"   sparad: {OUT}/trafflista.png")


async def steg_blankett(page, rad):
    """Öppnar en ministerialbokspost och hämtar dess blankett med F9.

    Vägen via handlingen, inte via listans Rapporter-meny: filnamnet byggs
    av handlingspostens egna fält, och det är just filnamnet rutans
    överkant visar.
    """
    print(f"3. Visningsrutan (rad {rad})")
    await page.locator("[role='row'][data-id]").nth(rad).dblclick()
    await page.wait_for_timeout(3000)
    print("   url:", page.url)
    flikar = await page.get_by_role("tab").all_inner_texts()
    print("   flikar:", flikar)
    await page.keyboard.press("F9")
    await page.wait_for_selector("#svk-kbok-blankett", timeout=20000)
    # PDF:en renderas i en iframe - vänta in visaren, inte bara rutan.
    await page.wait_for_timeout(4000)
    namn = await page.locator("#svk-kbok-blankett > div > div span").first.inner_text()
    print("   filnamn i rutan:", namn)
    await skarmdumpa(page, page.locator("#svk-kbok-blankett > div"), "visningsruta")


async def main():
    steg = sys.argv[1] if len(sys.argv) > 1 else "alla"
    rad = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        webblasare, page = await starta(p)
        print("Inloggad:", page.url)
        if steg in ("alla", "panel"):
            await steg_panel(page)
        if steg in ("alla", "lista", "blankett"):
            await steg_lista(page)
        if steg in ("alla", "blankett"):
            await steg_blankett(page, rad)
        await webblasare.close()


if __name__ == "__main__":
    asyncio.run(main())
