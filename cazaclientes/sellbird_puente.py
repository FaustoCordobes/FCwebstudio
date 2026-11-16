"""Puente Cazaclientes -> Sellbird.

Carga en Sellbird los locales que exportaste desde Cazaclientes (pestaña Ventas,
"Exportar para Sellbird"). Así Sellbird lee sus webs, busca a quién escribirle,
verifica los mails y arma la campaña.

Uso, dentro de la carpeta de Sellbird y con su entorno activado:
    python sellbird_puente.py cazaclientes-para-sellbird.json

Después:
    sellbird profile      (lee las webs, gratis)
    sellbird dashboard    (revisás y aprobás en el panel)
"""
import asyncio
import json
import sys
from urllib.parse import urlparse


def dominio(web: str) -> str:
    if not web:
        return ""
    host = urlparse(web if "://" in web else "https://" + web).hostname or ""
    return host[4:] if host.startswith("www.") else host


async def main(ruta: str) -> None:
    try:
        from sellbird.models.company import Company
        from sellbird.state import StateManager
    except ImportError:
        sys.exit("No encuentro Sellbird. Corré esto dentro de la carpeta de Sellbird con su entorno activado (.venv).")

    with open(ruta, encoding="utf-8") as f:
        datos = json.load(f)
    locales = datos.get("locales", [])
    if not locales:
        sys.exit("El archivo no tiene locales. Exportalo de nuevo desde Cazaclientes.")

    estado = StateManager()
    await estado.init_db()
    for x in locales:
        web = x.get("web") or ""
        empresa = Company(
            name=x.get("nombre", ""),
            domain=dominio(web),
            website=web,
            industry=x.get("rubro", ""),
            location=x.get("ciudad", ""),
            phone=x.get("tel", ""),
            source="cazaclientes",
            source_url=x.get("maps", ""),
            external_id="cazaclientes:" + str(x.get("id", "")),
            description=x.get("hallazgo", ""),
            notes=x.get("notas", ""),
        )
        await estado.add_company(empresa)
    print(f"Listo: {len(locales)} locales enviados a Sellbird (los repetidos se ignoran).")
    print("Ahora corré:  sellbird profile   y después   sellbird dashboard")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python sellbird_puente.py cazaclientes-para-sellbird.json")
    asyncio.run(main(sys.argv[1]))
