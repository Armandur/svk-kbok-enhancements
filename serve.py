#!/usr/bin/env python3
"""Installationssida för userscripten.

Servar README som en läsbar sida med en installationsknapp, och skriptet
självt på /svk-kbok-enhancements.user.js. Tampermonkey och Greasemonkey
fångar upp navigering till filer som slutar på .user.js och visar sin egen
installationsdialog - därför räcker en vanlig länk, ingen knapp-logik
behövs på vår sida.

Ren stdlib, ingen pip. Markdownrenderaren nedan täcker det README faktiskt
använder (rubriker, tabeller, listor, kodspann, fetstil, länkar) och är
inte tänkt att vara komplett.

Körs:  python3 serve.py [port]
"""

import html
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROT = Path(__file__).resolve().parent
SKRIPT = ROT / "svk-kbok-enhancements.user.js"
README = ROT / "README.md"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8003


def infoga(text):
    """Kodspann, fetstil och länkar - i den ordningen, så att kodspann
    skyddas från att tolkas vidare."""
    bitar = []

    def spara_kod(m):
        bitar.append(f"<code>{html.escape(m.group(1))}</code>")
        return f"\x00{len(bitar) - 1}\x00"

    text = re.sub(r"`([^`]+)`", spara_kod, text)
    text = html.escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return re.sub(r"\x00(\d+)\x00", lambda m: bitar[int(m.group(1))], text)


def markdown(text):
    ut, i, rader = [], 0, text.splitlines()
    while i < len(rader):
        rad = rader[i]

        if not rad.strip():
            i += 1
            continue

        rubrik = re.match(r"^(#{1,6})\s+(.*)$", rad)
        if rubrik:
            n = len(rubrik.group(1))
            ut.append(f"<h{n}>{infoga(rubrik.group(2))}</h{n}>")
            i += 1
            continue

        # Tabell: rad med | följt av avgränsarrad
        if rad.lstrip().startswith("|") and i + 1 < len(rader) and re.match(
                r"^\s*\|[\s:|-]+\|\s*$", rader[i + 1]):
            celler = [c.strip() for c in rad.strip().strip("|").split("|")]
            ut.append("<table><thead><tr>"
                      + "".join(f"<th>{infoga(c)}</th>" for c in celler)
                      + "</tr></thead><tbody>")
            i += 2
            while i < len(rader) and rader[i].lstrip().startswith("|"):
                celler = [c.strip() for c in rader[i].strip().strip("|").split("|")]
                ut.append("<tr>" + "".join(f"<td>{infoga(c)}</td>" for c in celler) + "</tr>")
                i += 1
            ut.append("</tbody></table>")
            continue

        if re.match(r"^\s*[-*]\s+", rad):
            ut.append("<ul>")
            while i < len(rader) and (re.match(r"^\s*[-*]\s+", rader[i])
                                      or (rader[i].startswith("  ") and rader[i].strip())):
                if re.match(r"^\s*[-*]\s+", rader[i]):
                    ut.append(f"<li>{infoga(re.sub(r'^\s*[-*]\s+', '', rader[i]))}")
                else:
                    ut.append(" " + infoga(rader[i].strip()))
                i += 1
            ut.append("</ul>")
            continue

        stycke = []
        while i < len(rader) and rader[i].strip() and not re.match(
                r"^(#{1,6}\s|\s*[-*]\s|\s*\|)", rader[i]):
            stycke.append(rader[i].strip())
            i += 1
        if stycke:
            ut.append(f"<p>{infoga(' '.join(stycke))}</p>")
    return "\n".join(ut)


SIDA = """<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>svk-kbok-enhancements</title>
<style>
 :root {{ --bg:#fdfdfc; --fg:#1c1b19; --dim:#6b6862; --line:#e3e0da; --kbok:#7d0037; --kod:#f0ede7; }}
 @media (prefers-color-scheme: dark) {{
   :root {{ --bg:#17161a; --fg:#e8e6e1; --dim:#9a958c; --line:#33313a; --kbok:#e0a3b0; --kod:#2b2930; }} }}
 * {{ box-sizing:border-box }}
 body {{ margin:0; padding:2rem 1.1rem 5rem; background:var(--bg); color:var(--fg);
        font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif }}
 .wrap {{ max-width:52rem; margin:0 auto }}
 h1 {{ font-size:1.5rem; margin:0 0 .3rem }}
 h2 {{ font-size:1.15rem; margin:2.4rem 0 .6rem; padding-top:1.2rem; border-top:1px solid var(--line) }}
 h3 {{ font-size:1rem; margin:1.6rem 0 .4rem }}
 p, li {{ color:var(--fg) }}
 code {{ background:var(--kod); padding:.12rem .35rem; border-radius:4px;
         font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.85em }}
 table {{ border-collapse:collapse; width:100%; font-size:.92rem; margin:.8rem 0; display:block; overflow-x:auto }}
 th,td {{ text-align:left; padding:.45rem .6rem; border-bottom:1px solid var(--line); vertical-align:top }}
 th {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--dim) }}
 a {{ color:var(--kbok) }}
 .install {{ background:var(--kod); border:1px solid var(--line); border-radius:10px;
             padding:1.2rem 1.3rem; margin:1.5rem 0 2rem }}
 .install h2 {{ margin:0 0 .5rem; padding:0; border:none; font-size:1.05rem }}
 .knapp {{ display:inline-block; background:var(--kbok); color:#fff; text-decoration:none;
           padding:.7rem 1.4rem; border-radius:999px; font-weight:600; margin-top:.4rem }}
 .knapp:hover {{ opacity:.9 }}
 .dim {{ color:var(--dim); font-size:.9rem }}
</style></head><body><div class="wrap">
<div class="install">
  <h2>Installera</h2>
  <p class="dim">Kräver Tampermonkey eller Greasemonkey i webbläsaren. Knappen
  öppnar skriptet, och tillägget visar sin egen installationsdialog.</p>
  <a class="knapp" href="/{filnamn}">Installera userscript</a>
  <p class="dim" style="margin-bottom:0">Fungerar inget: högerklicka länken, spara filen,
  och dra den till Tampermonkeys instrumentpanel.</p>
</div>
{innehall}
</div></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/" + SKRIPT.name):
            kropp = SKRIPT.read_bytes()
            self.send_response(200)
            # text/javascript gör att Tampermonkey fångar upp filen i stället
            # för att webbläsaren laddar ner den.
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(kropp)))
            self.end_headers()
            self.wfile.write(kropp)
            return

        if self.path in ("/", "/index.html"):
            sida = SIDA.format(filnamn=SKRIPT.name, innehall=markdown(README.read_text()))
            kropp = sida.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(kropp)))
            self.end_headers()
            self.wfile.write(kropp)
            return

        self.send_error(404)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    print(f"Servar {SKRIPT.name} på port {PORT}", flush=True)
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
