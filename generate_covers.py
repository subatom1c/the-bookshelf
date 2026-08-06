"""Render the first page of every PDF in books/ to a PNG in covers/.

Run inside the venv:  python generate_covers.py
Skips books that already have a cover; pass --force to regenerate all.
"""

import sys
from pathlib import Path

import pymupdf

BASE_DIR = Path(__file__).resolve().parent
BOOKS_DIR = BASE_DIR / "books"
COVERS_DIR = BASE_DIR / "covers"

# 2x zoom for a sharper thumbnail
ZOOM = pymupdf.Matrix(2, 2)


def main():
    force = "--force" in sys.argv
    COVERS_DIR.mkdir(exist_ok=True)

    for pdf in sorted(BOOKS_DIR.glob("*.pdf")):
        cover = COVERS_DIR / f"{pdf.stem}.png"
        if cover.exists() and not force:
            continue

        try:
            with pymupdf.open(pdf) as doc:
                page = doc.load_page(0)
                page.get_pixmap(matrix=ZOOM).save(cover)
            print(f"cover: {pdf.name}")
        except Exception as err:
            print(f"skip:  {pdf.name} ({err})")


if __name__ == "__main__":
    main()
