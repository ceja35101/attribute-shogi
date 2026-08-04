#!/usr/bin/env python3
"""Validate versioning, store assets, and the generated itch.io package."""

from __future__ import annotations

import argparse
import re
import struct
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE_FILES = {
    "index.html", "styles.css", "app.js", "game-core.js", "attributes.json",
    "service-worker.js", "manifest.webmanifest", "app-icon.svg", "icon-192.png",
    "icon-512.png", "fire-realistic-v1.png", "water-realistic-v1.png",
    "wind-realistic-v1.png", "RULES.md", "RULES_EN.md", "PRIVACY.md",
    "PRIVACY_EN.md", "LICENSE", "LICENSES.md", "BETA_TEST_GUIDE.md",
    "BETA_TEST_GUIDE_EN.md", "supabase-config.js", "online-client.js",
}


class ValidationError(RuntimeError):
    pass


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.is_file():
        raise ValidationError(f"Missing required file: {path}")
    return file_path.read_text(encoding="utf-8")


def image_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data.startswith(b"\xff\xd8"):
        offset = 2
        sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            offset += 2
            if marker in {0xD8, 0xD9}:
                continue
            if offset + 2 > len(data):
                break
            length = int.from_bytes(data[offset : offset + 2], "big")
            if marker in sof_markers:
                if offset + 7 > len(data):
                    break
                height = int.from_bytes(data[offset + 3 : offset + 5], "big")
                width = int.from_bytes(data[offset + 5 : offset + 7], "big")
                return width, height
            if length < 2:
                break
            offset += length
    raise ValidationError(f"Unsupported or damaged image: {path.relative_to(ROOT)}")


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def validate_source(version: str) -> None:
    app = read("app.js")
    index = read("index.html")
    worker = read("service-worker.js")
    match = re.search(r'const APP_VERSION="([^"]+)"', app)
    expect(bool(match), "APP_VERSION was not found in app.js")
    expect(match.group(1) == version, f"VERSION ({version}) and APP_VERSION ({match.group(1)}) differ")
    expect(index.count(version) >= 2, "Visible version labels in index.html are not synchronized")

    for asset in ("styles.css", "game-core.js", "app.js"):
        asset_match = re.search(rf'(?:href|src)="({re.escape(asset)}\?v=\d+)"', index)
        expect(bool(asset_match), f"Cache-busted reference for {asset} is missing from index.html")
        expect(f'"./{asset_match.group(1)}"' in worker, f"Service Worker does not cache {asset_match.group(1)}")

    for path in PACKAGE_FILES:
        expect((ROOT / path).is_file(), f"Package source file is missing: {path}")

    cover = ROOT / "itch-cover-630x500-v2.jpg"
    expect(cover.is_file(), "itch.io cover image is missing")
    expect(image_size(cover) == (630, 500), "itch.io cover must be exactly 630x500")
    screenshots = sorted((ROOT / "itch-screenshots").glob("*.png"))
    expect(len(screenshots) >= 4, "At least four itch.io screenshots are required")
    for screenshot in screenshots:
        width, height = image_size(screenshot)
        expect(width >= 1200 and height >= 675, f"Screenshot is too small: {screenshot.name} ({width}x{height})")

    expect("感想を募集しています" in read("ITCH_PAGE.md"), "Japanese store page is missing the feedback section")
    expect("Feedback Wanted" in read("ITCH_PAGE_EN.md"), "English store page is missing the feedback section")


def validate_archive(version: str, archive_arg: str | None) -> Path:
    archive = Path(archive_arg).resolve() if archive_arg else ROOT / "dist" / f"attribute-shogi-{version}-itch.zip"
    expect(archive.is_file(), f"Generated itch.io archive is missing: {archive}")
    with zipfile.ZipFile(archive) as package:
        names = {name.rstrip("/") for name in package.namelist() if not name.endswith("/")}
        missing = sorted(PACKAGE_FILES - names)
        expect(not missing, f"Archive is missing: {', '.join(missing)}")
        expect("index.html" in names, "index.html must be at the ZIP root")
        expect(not any(name.startswith("/") or ".." in Path(name).parts for name in names), "Archive contains an unsafe path")
    return archive


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", nargs="?", const="", help="also validate the generated ZIP")
    args = parser.parse_args()
    version = read("VERSION").strip()
    expect(bool(re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", version)), f"Invalid VERSION: {version}")
    validate_source(version)
    print(f"PASS source and store assets: {version}")
    if args.archive is not None:
        archive = validate_archive(version, args.archive or None)
        print(f"PASS itch.io archive: {archive}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
