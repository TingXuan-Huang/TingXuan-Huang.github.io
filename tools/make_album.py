#!/usr/bin/env python3
"""Pick photos for each place on the travel map and make web copies of them.

    python3 tools/make_album.py ~/Desktop/personal-web/travel-photos            # show the plan
    python3 tools/make_album.py ~/Desktop/personal-web/travel-photos --write    # do it
    python3 tools/make_album.py --pages ~/Desktop/personal-web/site-photos --write
                                    # the front-page and About photos: files named home.* and about.*

Which photos go to which place:
  1. photos inside a folder named like a place ("Hangzhou", "杭州", "hangzhou-cn")
     belong to that place, wherever they were taken;
  2. every other photo goes to the nearest pin within --radius-km of where it
     was taken (province / state pins reach further).
Up to --per-place photos are kept for each place, spread across the dates.

What is written (only with --write):
  photos/<place-id>/<name>.jpg     at most 1600 px, for the full view
  photos/<place-id>/<name>-s.jpg   at most 480 px, for the thumbnails
  photos.js                        the list the travel page reads
  stories.md                       a "## Photos" list per place, one empty
                                   caption line per new photo

The copies carry NO location, date or camera data: everything except the
picture itself is removed, so publishing them does not reveal where exactly a
photo was taken. Your originals are never changed.

To take a photo out of an album, delete its two files from photos/<place-id>/
and run this again: it is remembered in photos/skip.txt and not added back.

Needs macOS (it uses the built-in "sips" to resize) and Python 3.9+.
"""
import argparse
import json
import os
import re
import shutil
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import photos_to_places as P  # noqa: E402  (the EXIF reader and helpers live there)

DEMO = os.path.dirname(HERE)
FULL, THUMB = 1600, 480
REGION_RADIUS_KM = 300      # how far a province / state pin reaches


def norm(text):
    return re.sub(r'[^a-z0-9]', '', str(text).lower())


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-') or 'photo'


# ------------------------------------------------------------ which place
def place_for_folder(path, roots, places):
    """A photo in a folder named like a place belongs to that place."""
    folder = os.path.dirname(os.path.abspath(path))
    root = next((r for r in roots if folder == r or folder.startswith(r + os.sep)), None)
    while folder and folder != root and len(folder) > 1:
        name = os.path.basename(folder)
        for p in places:
            if norm(name) and norm(name) in (norm(p['name']), norm(p['id'])):
                return p
            if p.get('local') and name.strip() == p['local']:
                return p
        folder = os.path.dirname(folder)
    return None


def place_for_position(lat, lon, places, radius_km):
    best, best_d = None, None
    for region in (False, True):            # a city pin wins over a province pin
        for p in places:
            if (p.get('level') == 'region') != region:
                continue
            d = P.km(lat, lon, p['lat'], p['lon'])
            if d <= (REGION_RADIUS_KM if region else radius_km) and (best is None or d < best_d):
                best, best_d = p, d
        if best:
            return best
    return None


def spread(items, k):
    """k items spread evenly across a list already in date order."""
    if k <= 0:
        return []
    if len(items) <= k:
        return list(items)
    if k == 1:
        return items[:1]
    return [items[round(i * (len(items) - 1) / (k - 1))] for i in range(k)]


# ------------------------------------------------------------ web copies
def sips_size(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path],
                         capture_output=True, text=True).stdout
    w = re.search(r'pixelWidth:\s*(\d+)', out)
    h = re.search(r'pixelHeight:\s*(\d+)', out)
    return (int(w.group(1)), int(h.group(1))) if w and h else None


def jpeg_orientation(data):
    """The EXIF orientation (1-8) of a JPEG, 1 when there is none."""
    pos = 2
    while pos + 4 <= len(data) and data[pos] == 0xFF:
        marker = data[pos + 1]
        if marker in (0xD9, 0xDA):
            break
        size = struct.unpack_from('>H', data, pos + 2)[0]
        if marker == 0xE1 and data[pos + 4:pos + 10] == b'Exif\x00\x00':
            base = pos + 10
            try:
                e = '<' if data[base:base + 2] == b'II' else '>'
                off = struct.unpack_from(e + 'I', data, base + 4)[0]
                for i in range(struct.unpack_from(e + 'H', data, base + off)[0]):
                    at = base + off + 2 + i * 12
                    if struct.unpack_from(e + 'H', data, at)[0] == 0x0112:
                        v = struct.unpack_from(e + 'H', data, at + 8)[0]
                        return v if 1 <= v <= 8 else 1
            except struct.error:
                pass
            return 1
        pos += 2 + size
    return 1


def strip_jpeg(path):
    """Remove everything but the picture from a JPEG: location, date, camera,
    comments, embedded previews. Only "which way is up" is kept, so the photo
    still displays the right way round. Returns that orientation (1-8)."""
    with open(path, 'rb') as f:
        data = f.read()
    if data[:2] != b'\xff\xd8':
        raise ValueError('not a JPEG: ' + path)
    orientation = jpeg_orientation(data)
    out = [b'\xff\xd8']
    if orientation != 1:        # a minimal EXIF block holding only the orientation
        tiff = (b'MM\x00*' + struct.pack('>I', 8) + struct.pack('>H', 1) +
                struct.pack('>HHIHH', 0x0112, 3, 1, orientation, 0) + struct.pack('>I', 0))
        payload = b'Exif\x00\x00' + tiff
        out.append(b'\xff\xe1' + struct.pack('>H', len(payload) + 2) + payload)
    pos = 2
    while pos + 4 <= len(data) and data[pos] == 0xFF:
        marker = data[pos + 1]
        if marker == 0xDA:                              # the picture data: keep the rest as is
            out.append(data[pos:])
            break
        size = struct.unpack_from('>H', data, pos + 2)[0]
        seg = data[pos:pos + 2 + size]
        keep = True
        if marker == 0xFE or marker == 0xE1 or 0xE3 <= marker <= 0xED or marker == 0xEF:
            keep = False                                # comments, EXIF / XMP, maker data, IPTC
        elif marker == 0xE2 and not seg[4:].startswith(b'ICC_PROFILE'):
            keep = False                                # keep the colour profile, drop the rest
        if keep:
            out.append(seg)
        pos += 2 + size
    with open(path, 'wb') as f:
        f.write(b''.join(out))
    return orientation


def make_copy(src, dst, limit):
    """Write a metadata-free JPEG copy of src, at most `limit` px on its long side.
    Returns (width, height) as displayed, or None if the photo could not be read."""
    size = sips_size(src)
    if not size:
        return None
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cmd = ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82']
    if max(size) > limit:
        cmd += ['-Z', str(limit)]
    done = subprocess.run(cmd + [src, '--out', dst], capture_output=True, text=True)
    if done.returncode != 0 or not os.path.exists(dst):
        return None
    orientation = strip_jpeg(dst)
    w, h = sips_size(dst) or (0, 0)
    leftover = P.read_exif(dst) or {}
    if 'lat' in leftover or 'date' in leftover:         # never publish a copy that still has them
        os.remove(dst)
        raise RuntimeError('could not remove the location data from ' + src)
    return (h, w) if orientation >= 5 else (w, h)


# ------------------------------------------------------------ photos.js
def load_manifest(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        m = re.search(r'window\.PHOTOS\s*=\s*(\{.*\})\s*;', f.read(), re.S)
    return json.loads(m.group(1)) if m else {}


def save_manifest(path, manifest):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* The photo albums on the travel page. Written by tools/make_album.py:\n'
                '   run it again rather than editing this by hand. The captions are in\n'
                '   stories.md, under "## Photos" for each place. */\n'
                'window.PHOTOS = ' + json.dumps(manifest, indent=2, ensure_ascii=False) + ';\n')


def load_skips(path):
    if not os.path.exists(path):
        return set()
    with open(path, encoding='utf-8') as f:
        return {line.strip() for line in f if line.strip() and not line.startswith('#')}


# ------------------------------------------------------------ stories.md
def add_caption_lines(stories_path, places, new_files):
    """Give each new photo an empty caption line under its place's "## Photos"."""
    if not os.path.exists(stories_path):
        return 0
    with open(stories_path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    by_id = {p['id']: p for p in places}
    added = 0
    for pid, files in new_files.items():
        p = by_id[pid]
        start = next((i for i, l in enumerate(lines)
                      if re.match(r'#[ \t]+', l) and norm(l[1:]) in (norm(p['name']), norm(p['id']))), None)
        if start is None:
            continue
        end = next((i for i in range(start + 1, len(lines)) if re.match(r'#[ \t]+', lines[i])), len(lines))
        while end > start + 1 and not lines[end - 1].strip():
            end -= 1                                    # the last line of this place's section
        head = next((i for i in range(start + 1, end)
                     if re.match(r'##[ \t]+(photos|照片|相册)\s*$', lines[i], re.I)), None)
        if head is None:
            lines[end:end] = ['', '## Photos']
            head, end = end + 1, end + 2
            at = end
        else:
            at = next((i for i in range(head + 1, end) if re.match(r'##[ \t]+', lines[i])), end)
            while at > head + 1 and not lines[at - 1].strip():
                at -= 1
        have = {l.split(':', 1)[0].strip() for l in lines[head + 1:at] if ':' in l}
        fresh = [f for f in files if f not in have]
        lines[at:at] = [f + ':' for f in fresh]
        added += len(fresh)
    if added:
        shutil.copyfile(stories_path, stories_path + '.bak')
        with open(stories_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    return added


# ------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description='Make the photo albums for the travel page.')
    ap.add_argument('folders', nargs='*', help='folders of photos (trips, or folders named like a place)')
    ap.add_argument('--write', action='store_true', help='make the copies (without this, only show the plan)')
    ap.add_argument('--per-place', type=int, default=12, help='most photos to keep per place (default 12)')
    ap.add_argument('--radius-km', type=float, default=40, help='how near a pin a photo must be (default 40)')
    ap.add_argument('--home', metavar='PHOTO', help='make this photo the front-page photo (photos/home.jpg)')
    ap.add_argument('--about', metavar='PHOTO', help='make this photo the About-page photo (photos/about.jpg)')
    ap.add_argument('--pages', metavar='FOLDER', help='a folder holding a photo named "home" and/or "about"')
    ap.add_argument('--site', default=DEMO, help=argparse.SUPPRESS)       # where photos/ and photos.js go
    args = ap.parse_args()

    if not shutil.which('sips'):
        sys.exit('This tool needs "sips", which comes with macOS.')
    if not (args.folders or args.home or args.about or args.pages):
        ap.error('give a folder of trip photos, or --pages FOLDER, --home PHOTO or --about PHOTO')
    site = os.path.abspath(args.site)
    out_dir = os.path.join(site, 'photos')

    # the single photos on the front page and the About page
    singles = []                                        # (which page, the photo)
    if args.pages:
        folder = os.path.abspath(os.path.expanduser(args.pages))
        if not os.path.isdir(folder):
            sys.exit('No such folder: ' + folder)
        for name in sorted(os.listdir(folder)):
            stem, ext = os.path.splitext(name)
            if stem.lower() in ('home', 'about') and ext.lower() in P.IMAGE_EXT:
                singles.append((stem.lower(), os.path.join(folder, name)))
        if not singles:
            print('No photo called "home" or "about" in ' + folder)
    for page, photo in (('home', args.home), ('about', args.about)):
        if photo:
            singles.append((page, os.path.abspath(os.path.expanduser(photo))))
    for page, src in singles:
        if not os.path.isfile(src):
            sys.exit('No such photo: ' + src)
        label = 'front page' if page == 'home' else 'About page'
        if args.write:
            if not make_copy(src, os.path.join(out_dir, page + '.jpg'), FULL):
                sys.exit('Could not read ' + src)
            print('%s is now the %s photo: photos/%s.jpg (location data removed).' % (os.path.basename(src), label, page))
        else:
            print('Would make %s the %s photo. Add --write to do it.' % (os.path.basename(src), label))
    if not args.folders:
        return

    places = [p for p in P.load_places(os.path.join(site, 'places.js')) if not p.get('example')]
    roots = [os.path.abspath(os.path.expanduser(r)) for r in args.folders]
    for r in roots:
        if not os.path.exists(r):
            sys.exit('No such folder: ' + r)
    paths = [path for path, _trip in P.find_images(roots)]
    if not paths:
        sys.exit('No photos found in: ' + ', '.join(roots))
    print('Reading %d photos...' % len(paths), file=sys.stderr)
    meta = P.read_metadata(paths)

    # 1. which place each photo belongs to
    by_place, unplaced = {}, 0
    for path in paths:
        rec = meta[path]
        p = place_for_folder(path, roots, places)
        if not p and 'lat' in rec:
            p = place_for_position(rec['lat'], rec['lon'], places, args.radius_km)
        if not p:
            unplaced += 1
            continue
        by_place.setdefault(p['id'], []).append((str(rec.get('date') or ''), path))

    # 2. what is already in the albums, and what was taken out by hand
    manifest_path = os.path.join(site, 'photos.js')
    manifest = load_manifest(manifest_path)
    skip_path = os.path.join(out_dir, 'skip.txt')
    skips = load_skips(skip_path)
    for pid, items in list(manifest.items()):
        kept = []
        for it in items:
            if os.path.exists(os.path.join(out_dir, pid, it['file'])):
                kept.append(it)
            else:
                skips.add(pid + '/' + it['file'])         # deleted by hand: do not add it back
        manifest[pid] = kept

    # 3. choose
    plan = {}
    for p in places:
        found = sorted(by_place.get(p['id'], []))
        if not found:
            continue
        have = {it['file'] for it in manifest.get(p['id'], [])}
        room = args.per_place - len(have)
        fresh, used = [], set(have)
        for date, path in found:
            name = slug(os.path.splitext(os.path.basename(path))[0]) + '.jpg'
            if name in used or p['id'] + '/' + name in skips:
                continue
            used.add(name)
            fresh.append((date, path, name))
        plan[p['id']] = (p, len(found), len(have), spread(fresh, max(room, 0)))

    print('')
    for pid, (p, found, have, chosen) in plan.items():
        label = p['name'] + (' ' + p['local'] if p.get('local') else '')
        print('  %-22s %4d photos found, %2d already in the album, %2d to add' % (label, found, have, len(chosen)))
    if unplaced:
        print('  %d photos are not near any pin and are not in a folder named like a place.' % unplaced)
    total = sum(len(c[3]) for c in plan.values())
    if not total:
        print('\nNothing new to add.')
    if not args.write:
        if total:
            print('\nNothing written yet. Run again with --write to make the %d copies.' % total)
        return

    # 4. make the copies
    new_files, failed = {}, 0
    for pid, (p, _found, _have, chosen) in plan.items():
        for date, path, name in chosen:
            full = os.path.join(out_dir, pid, name)
            size = make_copy(path, full, FULL)
            if size and make_copy(path, full[:-4] + '-s.jpg', THUMB):
                entry = {'file': name, 'w': size[0], 'h': size[1]}
                manifest.setdefault(pid, []).append(entry)
                new_files.setdefault(pid, []).append(name)
            else:
                failed += 1
                print('  could not read %s' % path, file=sys.stderr)
    manifest = {pid: items for pid, items in manifest.items() if items}
    os.makedirs(out_dir, exist_ok=True)
    save_manifest(manifest_path, manifest)
    if skips:
        with open(skip_path, 'w', encoding='utf-8') as f:
            f.write('# Photos taken out of an album by hand. make_album.py will not add them back.\n')
            f.write('\n'.join(sorted(skips)) + '\n')
    captions = add_caption_lines(os.path.join(site, 'content', 'stories.md'), places, new_files)

    made = sum(len(v) for v in new_files.values())
    if made:
        print('\nMade %d photo(s) for %d place(s); location data removed from every copy.' % (made, len(new_files)))
    if captions:
        print('Added %d empty caption line(s) under "## Photos" in stories.md (old version kept as stories.md.bak).' % captions)
    if failed:
        print('%d photo(s) could not be read and were left out.' % failed)
    if made:
        print('Look through photos/ before you publish: these copies become public with the site.')


if __name__ == '__main__':
    main()
