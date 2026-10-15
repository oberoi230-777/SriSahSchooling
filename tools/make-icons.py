"""Render the SriSah violet app icon to PNG without any external image library.

Draws polygons and rounded rectangles with 4x supersampled anti-aliasing, then writes
a truecolour PNG using zlib. Run:  python3 tools/make-icons.py
"""
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'icons')
SS = 4  # supersample factor

VIOLET_STOPS = [(0.0, (0x7A, 0x4C, 0xE0)), (0.55, (0x5B, 0x2F, 0xC0)), (1.0, (0x3C, 0x1F, 0x7A))]


def lerp(a, b, t):
    return a + (b - a) * t


def gradient_color(t):
    t = min(max(t, 0.0), 1.0)
    for i in range(len(VIOLET_STOPS) - 1):
        t0, c0 = VIOLET_STOPS[i]
        t1, c1 = VIOLET_STOPS[i + 1]
        if t <= t1:
            k = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(lerp(c0[j], c1[j], k) for j in range(3))
    return VIOLET_STOPS[-1][1]


def bezier(p0, p1, p2, p3, steps=24):
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]
        y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
        points.append((x, y))
    return points


def point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > y) != (y1 > y):
            xint = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
            if x < xint:
                inside = not inside
    return inside


def dist_to_polyline(x, y, points):
    best = 1e9
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        dx, dy = x1 - x0, y1 - y0
        length = dx * dx + dy * dy
        t = 0 if length == 0 else max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / length))
        px, py = x0 + t * dx, y0 + t * dy
        best = min(best, ((x - px) ** 2 + (y - py) ** 2) ** 0.5)
    return best


def rounded_rect_inside(x, y, w, h, r):
    if x < 0 or y < 0 or x > w or y > h:
        return False
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size, pad_ratio=0.0, background=None):
    """Render the icon at `size` px. pad_ratio>0 insets the artwork (maskable icons)."""
    scale = size / 512.0
    inner = size * (1 - 2 * pad_ratio)
    off = size * pad_ratio

    def T(px, py):
        return (off + px * scale * (1 - 2 * pad_ratio), off + py * scale * (1 - 2 * pad_ratio))

    # --- geometry (source coordinates in a 512x512 space) ---------------------------
    radius = 116
    # Left page: outer top -> spine top -> spine bottom -> outer bottom -> close.
    left_page = (
        bezier((104, 150), (160, 132), (214, 144), (248, 182), 22)
        + [(248, 404)]
        + bezier((248, 404), (206, 372), (150, 356), (104, 372), 22)
    )
    # Right page mirrored around the spine at x = 256.
    right_page = (
        bezier((408, 150), (352, 132), (298, 144), (264, 182), 22)
        + [(264, 404)]
        + bezier((264, 404), (306, 372), (362, 356), (408, 372), 22)
    )
    spine = [(256, 184), (256, 402)]
    bookmark = [(296, 322), (332, 322), (332, 402), (314, 384), (296, 402)]
    page_lines = []
    for i in range(3):
        y = 224 + i * 40
        page_lines.append(([(140, y), (226, y + 20)], 12))
        page_lines.append(([(372, y), (286, y + 20)], 12))

    fills = []

    def sample(px, py):
        """Return the composited RGB colour for a source-space point."""
        if background is None and not rounded_rect_inside(px, py, 512, 512, radius):
            return None
        base = gradient_color((px / 512.0) * 0.65 + (py / 512.0) * 0.35)
        color = background if background is not None else base
        # Book pages
        if point_in_polygon(px, py, left_page):
            color = (0xF4, 0xEE, 0xFF)
        if point_in_polygon(px, py, right_page):
            color = (0xE4, 0xD6, 0xFF)
        # Bookmark sits on the right page
        if point_in_polygon(px, py, bookmark):
            color = (0xC9, 0xA7, 0xFF)
        # Page rules
        for line, width in page_lines:
            if dist_to_polyline(px, py, line) <= width / 2:
                color = (0x8F, 0x5C, 0xF0)
        # Spine
        if dist_to_polyline(px, py, spine) <= 6:
            color = (0xB9, 0x8C, 0xFF)
        return color

    rows = []
    step = 1.0 / SS
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    px = ((x + (sx + 0.5) * step) - off) / max(inner / 512.0, 1e-6)
                    py = ((y + (sy + 0.5) * step) - off) / max(inner / 512.0, 1e-6)
                    c = sample(px, py)
                    if c is not None:
                        r += c[0]
                        g += c[1]
                        b += c[2]
                        a += 1
            total = SS * SS
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes((int(round(r / a)), int(round(g / a)), int(round(b / a)), int(round(255 * a / total))))
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size, height=None):
    height = height or size
    raw = b''.join(b'\x00' + row for row in rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as handle:
        handle.write(png)


ANDROID_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'android', 'app', 'src', 'main', 'res')
DENSITIES = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}
LAUNCHER_DP = 48        # legacy launcher icon size
ADAPTIVE_DP = 108       # adaptive icon canvas; the safe zone is the inner 72dp
SPLASH_PORT = (320, 480)
SPLASH_LAND = (480, 320)
SPLASH_LOGO_RATIO = 0.34


def main():
    only = os.environ.get('ONLY')
    web_targets = [
        ('icon-512.png', 512, 0.0),
        ('icon-192.png', 192, 0.0),
        ('apple-touch-icon.png', 180, 0.0),
        ('icon-maskable-512.png', 512, 0.12),
        ('icon-maskable-192.png', 192, 0.12),
    ]
    for name, size, pad in web_targets:
        if only and only != 'web':
            continue
        write_png(os.path.join(OUT_DIR, name), render(size, pad_ratio=pad), size)
        print('wrote', name, size)

    if not os.path.isdir(ANDROID_DIR):
        print('android/ project not found — skipping native assets')
        return

    for density, factor in DENSITIES.items():
        folder = os.path.join(ANDROID_DIR, f'mipmap-{density}')
        os.makedirs(folder, exist_ok=True)
        launcher = int(round(LAUNCHER_DP * factor))
        adaptive = int(round(ADAPTIVE_DP * factor))
        if only not in ('', 'mipmaps'):
            pass
        else:
            square = render(launcher)
            write_png(os.path.join(folder, 'ic_launcher.png'), square, launcher)
            write_png(os.path.join(folder, 'ic_launcher_round.png'), square, launcher)
        # Adaptive foreground: artwork fills the inner 72dp safe zone of the 108dp canvas.
        if only in ('', 'mipmaps', 'foreground'):
            write_png(os.path.join(folder, 'ic_launcher_foreground.png'), render(adaptive, pad_ratio=18 / 108), adaptive)
        print('wrote mipmap-' + density, launcher, adaptive)

    def splash(width, height):
        rows = []
        for y in range(height):
            row = bytearray()
            for x in range(width):
                # Diagonal violet wash, matching the app theme.
                t = (x / width) * 0.6 + (y / height) * 0.4
                colour = gradient_color(t)
                row += bytes((int(colour[0]), int(colour[1]), int(colour[2]), 255))
            rows.append(bytes(row))
        logo = render(int(min(width, height) * SPLASH_LOGO_RATIO), pad_ratio=0.02)
        logo_size = len(logo)
        x0 = (width - logo_size) // 2
        y0 = (height - logo_size) // 2
        for index, logo_row in enumerate(logo):
            target = bytearray(rows[y0 + index])
            for px in range(logo_size):
                alpha = logo_row[px * 4 + 3] / 255.0
                if alpha == 0:
                    continue
                offset = (x0 + px) * 4
                for channel in range(3):
                    target[offset + channel] = int(logo_row[px * 4 + channel] * alpha + target[offset + channel] * (1 - alpha))
                target[offset + 3] = 255
            rows[y0 + index] = bytes(target)
        return rows

    variants = {
        'drawable': (480, 320),
        'drawable-port-mdpi': (SPLASH_PORT[0], SPLASH_PORT[1]),
        'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280),
        'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
        'drawable-land-mdpi': (SPLASH_LAND[0], SPLASH_LAND[1]),
        'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720),
        'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
    }
    for folder, (width, height) in variants.items():
        if only and only != 'splash':
            continue
        path = os.path.join(ANDROID_DIR, folder)
        os.makedirs(path, exist_ok=True)
        write_png(os.path.join(path, 'splash.png'), splash(width, height), width, height)
        print('wrote', folder + '/splash.png', f'{width}x{height}')


if __name__ == '__main__':
    main()
