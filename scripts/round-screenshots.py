#!/usr/bin/env python3
"""
Round the corners of README screenshots.

GitHub strips CSS from READMEs, so the rounding has to live in the PNG itself
as transparency. Originals are copied to docs/images/.raw/ on first run and are
always used as the source, so this is safe to re-run and never compounds.

Requires Pillow:  pip install Pillow
Usage:            python scripts/round-screenshots.py
"""

from __future__ import annotations

import pathlib
import shutil
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

IMAGES = pathlib.Path("docs/images")
RAW = IMAGES / ".raw"

RADIUS = 14
SUPERSAMPLE = 4

# A hairline so the shot doesn't bleed into the page. Light on dark shots,
# dark on light shots, both barely there.
BORDER = {"dark": (255, 255, 255, 28), "light": (0, 0, 0, 30)}


def theme_of(path: pathlib.Path) -> str:
    return "dark" if path.stem.endswith("-dark") else "light"


def round_image(path: pathlib.Path) -> None:
    backup = RAW / path.name
    if not backup.exists():
        shutil.copy2(path, backup)

    source = Image.open(backup).convert("RGBA")
    width, height = source.size
    big = (width * SUPERSAMPLE, height * SUPERSAMPLE)
    radius = RADIUS * SUPERSAMPLE

    mask = Image.new("L", big, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big[0] - 1, big[1] - 1], radius=radius, fill=255
    )

    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    out.paste(source, (0, 0), mask.resize(source.size, Image.LANCZOS))

    inset = SUPERSAMPLE // 2
    edge = Image.new("RGBA", big, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        [inset, inset, big[0] - 1 - inset, big[1] - 1 - inset],
        radius=radius,
        outline=BORDER[theme_of(path)],
        width=SUPERSAMPLE,
    )

    out = Image.alpha_composite(out, edge.resize(source.size, Image.LANCZOS))
    out.save(path)
    print(f"  {path.name} ({width}x{height})")


def main() -> None:
    if not IMAGES.is_dir():
        sys.exit(f"{IMAGES} not found - run this from the plugin root.")

    RAW.mkdir(exist_ok=True)

    images = sorted(IMAGES.glob("*.png"))
    if not images:
        sys.exit(f"No PNGs in {IMAGES}.")

    for image in images:
        round_image(image)

    print(f"\n{len(images)} rounded. Originals in {RAW}/")


if __name__ == "__main__":
    main()
