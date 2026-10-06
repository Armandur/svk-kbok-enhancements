"""Verifierar fliken Avstämning i Pålysningsboken med skriptet injicerat.

Utbildningsmiljön har i praktiken inga dödsfallsverifikat, så skriptet
mockar verifikatsökningen: 60 påhittade avlidna aviserade i december 2025,
där de första kan bytas mot riktiga personer som har pålysningar i miljön.
Pålysningarna hämtas på riktigt, så matchning, art och Minnesgudstjänst
testas mot Kboks faktiska svar. Miljön nollas varje natt, så pålysningarna
måste läggas in på nytt inför en körning.

Körs i en fish-shell så KBOK_UTB_* ur secrets.fish finns:

    ~/.local/share/shot-venv/bin/python verktyg/verifiera_avstamning.py \\
        --person "Eklund, Anton=19411118-6377" \\
        --person "Olsson, Isabel=19390421-7464"

    --bredd 390        viewport-bredd, förval 1440
    --ta-over          klicka "Logga in ändå" om kontot redan är inloggat.
                       Det loggar ut den som sitter i miljön - fråga först.
    --ut KATALOG       skärmdumpar, förval /tmp/kbok-enhancements-shots

Skriptet avslutas med fel så fort en kontroll inte håller.
"""

import argparse
import asyncio
import os
import re
import sys

from playwright.async_api import async_playwright

KBOK_VERKTYG = os.environ.get(
    "KBOK_WEB_VERKTYG", "/home/rasmus/workspace/kbok-web/manual/verktyg"
)
sys.path.insert(0, KBOK_VERKTYG)
from testa_inloggning import login_utb  # noqa: E402

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKRIPT = os.path.join(ROT, "svk-kbok-enhancements.user.js")
ANTAL = 60
PERIOD = ("2025-12-01", "2025-12-31")


def kontrollera(villkor, text):
    if not villkor:
        raise SystemExit(f"FEL: {text}")
    print(f"   ok: {text}")


async def logga_in(page, ta_over):
    try:
        await login_utb(page)
    except Exception:
        knapp = page.get_by_role("button", name="Logga in ändå")
        if not await knapp.count():
            raise
        if not ta_over:
            raise SystemExit(
                "FEL: kontot är redan inloggat i miljön. Vänta, eller kör med "
                "--ta-over för att logga ut den som sitter där."
            )
        await knapp.click()
        await page.wait_for_url(lambda u: "utb_login" not in u, timeout=20000)
        await page.wait_for_load_state("networkidle", timeout=15000)


def bygg_mock(personer):
    """Svarar på verifikatanropen i stället för Kbok."""

    async def mock(route):
        url = route.request.url
        if "FetchVerifikatBySearchlist" in url:
            kropp = route.request.post_data_json or {}
            skip, limit = int(kropp.get("skip", 0)), int(kropp.get("limit", 50))
            rader = [
                {"verifikatsId": i, "datum": f"2025-12-{(i % 28) + 1:02d}",
                 "personId": 90000 + i, "arskyddadperson": False}
                for i in range(1, ANTAL + 1)
            ][skip:skip + limit]
            await route.fulfill(json={"total": ANTAL, "paginatedResults": rader})
        elif "FetchVerifikatByVerifikatsId" in url:
            n = int(url.rsplit("=", 1)[1])
            namn, pnr = personer.get(n, (
                f"Testperson {n:02d}, Test",
                f"1950{(n % 12) + 1:02d}{(n % 28) + 1:02d}-{1000 + n}",
            ))
            await route.fulfill(json={"rows": [
                {"label": "Namn", "text": namn},
                {"label": "Personnummer", "text": pnr},
            ]})
        elif "FetchPersonakt" in url:
            await route.fulfill(json={"kyrkoperson": {}})
        else:
            await route.continue_()

    return mock


async def tabell(page):
    return await page.evaluate(
        """() => Array.from(document.querySelectorAll('.svk-kbok-avstamningstabell tbody tr'))
            .map(tr => Array.from(tr.children).map(td => td.innerText.replace(/\\n/g, ' | ')))"""
    )


async def rubrik(page, namn):
    return page.get_by_role("button", name=re.compile(rf"^{namn}"))


async def kor(arg):
    personer = {}
    for i, p in enumerate(arg.person, start=1):
        namn, pnr = p.rsplit("=", 1)
        personer[i] = (namn.strip(), pnr.strip())
    os.makedirs(arg.ut, exist_ok=True)

    async with async_playwright() as p:
        webblasare = await p.chromium.launch(channel="chromium", args=["--no-sandbox"])
        page = await webblasare.new_page(viewport={"width": arg.bredd, "height": 900})
        await page.add_init_script(path=SKRIPT)
        mock = bygg_mock(personer)
        await page.route("**/Verifikat/**", mock)
        await page.route("**/Person/FetchPersonakt", mock)
        await logga_in(page, arg.ta_over)

        print("1. Avstämningen för december 2025")
        await page.get_by_role("link", name="Pålysningsbok", exact=True).click()
        await page.wait_for_timeout(2500)
        await page.get_by_role("tab", name="Avstämning").click()
        stam_av = page.get_by_role("button", name="Stäm av")

        async def vanta_klar():
            # Fliken stämmer av föregående månad direkt när den öppnas.
            for _ in range(90):
                await page.wait_for_timeout(1000)
                if await stam_av.is_enabled():
                    return
            raise SystemExit("FEL: avstämningen blev inte klar på 90 sekunder")

        await vanta_klar()
        await page.get_by_label("Aviserat fr.o.m.").fill(PERIOD[0])
        await page.get_by_label("Aviserat t.o.m.").fill(PERIOD[1])
        await vanta_klar()
        await stam_av.click()
        await page.wait_for_timeout(500)
        await vanta_klar()
        await page.wait_for_timeout(1000)

        summering = await page.locator(".svk-kbok-summering").inner_text()
        print("   ", summering)
        kontrollera(f"{ANTAL} dödsfall" in summering, f"summeringen räknar {ANTAL} dödsfall")
        rader = await tabell(page)
        kontrollera(len(rader) == 50, "första sidan har 50 rader")
        panel = page.locator("#svk-kbok-avstamning")
        await panel.screenshot(path=f"{arg.ut}/avstamning-{arg.bredd}.png")

        print("2. Sortering på Avliden: stigande, fallande, förvald")
        await (await rubrik(page, "Avliden")).click()
        await page.wait_for_timeout(300)
        rader = await tabell(page)
        namn = [r[0] for r in rader]
        kontrollera(namn == sorted(namn, key=str.lower), "stigande namnordning")
        kontrollera(
            await page.locator("th[aria-sort]").get_attribute("aria-sort") == "ascending",
            "rubriken bär aria-sort=ascending",
        )
        for n, (person, _) in personer.items():
            rad = next((r for r in rader if r[0].startswith(person)), None)
            kontrollera(rad is not None, f"{person} finns i listan")
            print("    rad:", rad)
            kontrollera("Saknas" not in rad[3], f"{person} har matchats mot en pålysning")
        await panel.screenshot(path=f"{arg.ut}/avstamning-{arg.bredd}-sorterad.png")
        await (await rubrik(page, "Avliden")).click()
        await page.wait_for_timeout(300)
        rader = await tabell(page)
        namn = [r[0] for r in rader]
        kontrollera(namn == sorted(namn, key=str.lower, reverse=True), "fallande namnordning")
        await (await rubrik(page, "Avliden")).click()
        await page.wait_for_timeout(300)
        kontrollera(await page.locator("th[aria-sort]").count() == 0, "tredje klicket tar bort sorteringen")

        print("3. Sortering på Dödsdatum lägger tomma sist")
        await (await rubrik(page, "Dödsdatum")).click()
        await page.wait_for_timeout(300)
        datum = [r[1] for r in await tabell(page)]
        ifyllda = [d for d in datum if d]
        kontrollera(datum[:len(ifyllda)] == sorted(ifyllda), "ifyllda dödsdatum först, stigande")

        print("4. Visa alla och Visa sidvis")
        knapp = page.locator('button:has-text("Visa alla")')
        kontrollera(await knapp.inner_text() == f"Visa alla ({ANTAL})", "knappen visar antalet")
        await knapp.click()
        await page.wait_for_timeout(500)
        kontrollera(len(await tabell(page)) == ANTAL, "alla rader visas")
        kontrollera(await page.locator(".svk-kbok-paginering").count() == 0, "foten är dold")
        sidvis = page.locator('button:has-text("Visa sidvis")')
        kontrollera(await sidvis.count() == 1, "knappen heter Visa sidvis")
        await panel.screenshot(path=f"{arg.ut}/avstamning-{arg.bredd}-alla.png")
        await sidvis.click()
        await page.wait_for_timeout(500)
        kontrollera(len(await tabell(page)) == 50, "sidvis igen efter Visa sidvis")
        kontrollera(await page.locator(".svk-kbok-paginering").count() == 1, "foten är tillbaka")

        await webblasare.close()
    print(f"Klart. Skärmdumpar i {arg.ut}")


def main():
    tolk = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    tolk.add_argument("--person", action="append", default=[],
                      help='"Efternamn, Förnamn=ÅÅÅÅMMDD-NNNN" med dödsfallspålysning i miljön, upprepas')
    tolk.add_argument("--bredd", type=int, default=1440)
    tolk.add_argument("--ta-over", action="store_true")
    tolk.add_argument("--ut", default="/tmp/kbok-enhancements-shots")
    arg = tolk.parse_args()
    asyncio.run(kor(arg))


if __name__ == "__main__":
    main()
