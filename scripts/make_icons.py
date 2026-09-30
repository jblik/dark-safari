#!/usr/bin/env python3
"""Generate Dark Safari icons (crescent moon on dark disc) as PNGs.

Pure stdlib: writes RGBA PNGs directly with zlib + struct.
"""
import os
import struct
import zlib

SIZES = [48, 96, 128, 256, 512]
BG = (28, 27, 46, 255)       # dark navy disc
MOON = (245, 240, 220, 255)  # pale crescent
OUT = os.path.join(os.path.dirname(__file__), "..", "extension", "icons")


def png_chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data)))


def write_png(path, size, pixels):
    raw = b"".join(b"\x00" + bytes(p for px in row for p in px) for row in pixels)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)))
        f.write(png_chunk(b"IDAT", zlib.compress(raw)))
        f.write(png_chunk(b"IEND", b""))


def icon_pixels(size):
    c = size / 2
    disc_r = size * 0.47
    moon_r = size * 0.30
    # Crescent = moon circle minus an offset "bite" circle.
    bite_cx, bite_cy, bite_r = c + size * 0.12, c - size * 0.10, size * 0.26
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x + 0.5 - c, y + 0.5 - c
            if dx * dx + dy * dy > disc_r * disc_r:
                row.append((0, 0, 0, 0))
                continue
            in_moon = dx * dx + dy * dy <= moon_r * moon_r
            bx, by = x + 0.5 - bite_cx, y + 0.5 - bite_cy
            in_bite = bx * bx + by * by <= bite_r * bite_r
            row.append(MOON if in_moon and not in_bite else BG)
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT, f"icon-{size}.png")
        write_png(path, size, icon_pixels(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
