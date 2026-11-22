#!/usr/bin/env python3
"""Turn folders of travel photos into pins for the travel page.

    python3 tools/photos_to_places.py  ~/Desktop/personal-web/travel-photos
    python3 tools/photos_to_places.py  ~/Desktop/personal-web/travel-photos  --write

What it does
  1. Finds every photo under the folders you give it.
  2. Reads the GPS position and date stored inside each photo, straight from
     the file on this computer. The photos are never uploaded anywhere.
  3. Groups the photos by city and prints what it found.
  4. With --write, adds the new cities to ../places.js as "visited" pins.

What it never does
  - It never changes a place you already have: your notes, stories and
    lived/visited choices are yours. It only adds places that are missing and
    refreshes the photo count.
  - It never publishes exact photo positions. A pin sits on the city's
    centre, not on the spot where a photo was taken.

Naming places needs a list of the world's cities. Run once with
--download-cities to fetch the public GeoNames list (about 3 MB) into
tools/data/. Without it the script still works, but calls each group
"Unnamed place" for you to rename.
"""
import argparse
import collections
import datetime
import io
import json
import math
import mmap
import os
import re
import shutil
import struct
import subprocess
import sys
import unicodedata
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
DEFAULT_PLACES = os.path.normpath(os.path.join(HERE, '..', 'places.js'))
GEONAMES = 'https://download.geonames.org/export/dump/'
IMAGE_EXT = {'.jpg', '.jpeg', '.heic', '.heif', '.png', '.tif', '.tiff',
             '.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2'}
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December']

HEADER = '''/* The places on the travel page.

   Edit this file by hand, or let tools/photos_to_places.py add places from
   your photo folders. The part after "window.PLACES =" must stay valid JSON
   (double quotes, no trailing commas) so the tool can read it back.

   local   optional: the name in the local language, shown beside the name
   level   "region" when the pin is a whole province or state, not a city
   kind    "lived" (peach pin) or "visited" (white pin)
   when    shown in the story card, e.g. "2023 - now" or "April 2025"
   year    optional: the year of the trip (visited places are listed by country,
           the last part of "region")
   when, note, story
           the words for a place now live in stories.md (English and 中文).
           Anything left here is only used when stories.md has nothing.
   zoom    optional: how close the map goes when the place is selected
   photos  filled in by the tool: how many photos were taken there
   auto    true while an entry is exactly as the tool wrote it
   example true for made-up sample entries */
'''


# ----------------------------------------------------------------- photos
def find_images(roots):
    found = []
    for root in roots:
        root = os.path.abspath(os.path.expanduser(root))
        if os.path.isfile(root):
            found.append((root, os.path.basename(os.path.dirname(root))))
            continue
        for folder, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
            rel = os.path.relpath(folder, root)
            # the trip is the first folder level under the one you passed in
            trip = os.path.basename(root) if rel == '.' else rel.split(os.sep)[0]
            for name in sorted(files):
                if name.startswith('.'):
                    continue
                if os.path.splitext(name)[1].lower() in IMAGE_EXT:
                    found.append((os.path.join(folder, name), trip))
    return found


# --- reading the position and date out of a photo (EXIF), with no extra software
_SIZES = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}


def _tiff(buf, base):
    """Parse the TIFF block that holds EXIF, starting at byte `base` of `buf`."""
    order = buf[base:base + 2]
    if order == b'II':
        e = '<'
    elif order == b'MM':
        e = '>'
    else:
        return None
    if struct.unpack_from(e + 'H', buf, base + 2)[0] != 42:
        return None

    def ifd(offset):
        tags = {}
        pos = base + offset
        if pos + 2 > len(buf):
            return tags
        count = struct.unpack_from(e + 'H', buf, pos)[0]
        for i in range(min(count, 512)):
            at = pos + 2 + i * 12
            if at + 12 > len(buf):
                break
            tag, kind, n = struct.unpack_from(e + 'HHI', buf, at)
            size = _SIZES.get(kind, 0) * n
            if not size or size > 65536:
                continue
            start = at + 8 if size <= 4 else base + struct.unpack_from(e + 'I', buf, at + 8)[0]
            if start + size > len(buf):
                continue
            raw = buf[start:start + size]
            if kind == 2:
                tags[tag] = raw.split(b'\x00')[0].decode('ascii', 'replace')
            elif kind in (5, 10):
                pairs = struct.unpack(e + ('II' if kind == 5 else 'ii') * n, raw)
                tags[tag] = [pairs[k] / pairs[k + 1] if pairs[k + 1] else 0.0 for k in range(0, len(pairs), 2)]
            elif kind in (3, 4):
                tags[tag] = struct.unpack(e + ('H' if kind == 3 else 'I') * n, raw)
        return tags

    try:
        first = ifd(struct.unpack_from(e + 'I', buf, base + 4)[0])
        out = {}
        date = first.get(0x0132)
        if 0x8769 in first:
            date = ifd(first[0x8769][0]).get(0x9003) or date
        if date:
            out['date'] = date
        if 0x8825 in first:
            gps = ifd(first[0x8825][0])
            lat, lon = gps.get(2), gps.get(4)
            if lat and lon and len(lat) == 3 and len(lon) == 3:
                la = lat[0] + lat[1] / 60 + lat[2] / 3600
                lo = lon[0] + lon[1] / 60 + lon[2] / 3600
                out['lat'] = -la if str(gps.get(1, 'N')).upper().startswith('S') else la
                out['lon'] = -lo if str(gps.get(3, 'E')).upper().startswith('W') else lo
        return out
    except (struct.error, IndexError, ZeroDivisionError):
        return None


def read_exif(path):
    """{'lat','lon','date'} as far as the file has them; None if it cannot be read."""
    try:
        with open(path, 'rb') as f:
            if os.fstat(f.fileno()).st_size < 16:
                return None
            buf = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    except (OSError, ValueError):
        return None
    try:
        head = buf[:4]
        if head[:2] == b'\xff\xd8':                      # JPEG: walk the segments to APP1
            pos = 2
            while pos + 4 <= len(buf) and buf[pos] == 0xFF:
                marker = buf[pos + 1]
                if marker in (0xD9, 0xDA):
                    break
                size = struct.unpack_from('>H', buf, pos + 2)[0]
                if marker == 0xE1 and buf[pos + 4:pos + 10] == b'Exif\x00\x00':
                    return _tiff(buf, pos + 10) or {}
                pos += 2 + size
            return {}
        if head in (b'II*\x00', b'MM\x00*'):              # TIFF, DNG and most camera RAW
            return _tiff(buf, 0) or {}
        best, pos = {}, 0                                 # HEIC and others: find the EXIF block
        while True:
            pos = buf.find(b'Exif\x00\x00', pos)
            if pos < 0:
                return best
            found = _tiff(buf, pos + 6)
            if found and 'lat' in found:
                return found
            if found and not best:
                best = found
            pos += 6
    finally:
        buf.close()


def read_spotlight(path):
    """Second opinion from macOS for formats the reader above could not place."""
    try:
        raw = subprocess.run(['mdls', '-raw', '-name', 'kMDItemLatitude', '-name', 'kMDItemLongitude',
                              '-name', 'kMDItemContentCreationDate', path],
                             capture_output=True, text=True, timeout=10).stdout.split('\x00')
        lat, lon = float(raw[0]), float(raw[1])
        return {'lat': lat, 'lon': lon, 'date': raw[2] if len(raw) > 2 else None}
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return None


def read_metadata(paths):
    out = {}
    use_spotlight = bool(shutil.which('mdls'))
    for n, path in enumerate(paths, 1):
        rec = read_exif(path)
        if rec is None:
            rec = {'error': True}
        if 'lat' not in rec and use_spotlight and os.path.splitext(path)[1].lower() not in ('.jpg', '.jpeg'):
            extra = read_spotlight(path)
            if extra:
                extra['date'] = rec.get('date') or extra.get('date')
                rec = extra
        rec['path'] = path
        out[path] = rec
        if n % 500 == 0:
            print('  read %d of %d photos' % (n, len(paths)), file=sys.stderr)
    return out


def parse_date(text):
    m = re.match(r'(\d{4})[:\-](\d{2})[:\-](\d{2})', text or '')
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


# ----------------------------------------------------------------- cities
def download_cities():
    os.makedirs(DATA, exist_ok=True)
    for name in ('cities15000.zip', 'countryInfo.txt', 'admin1CodesASCII.txt'):
        print('Downloading', GEONAMES + name)
        with urllib.request.urlopen(GEONAMES + name, timeout=60) as r:
            blob = r.read()
        if name.endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(blob)) as z:
                z.extract('cities15000.txt', DATA)
        else:
            with open(os.path.join(DATA, name), 'wb') as f:
                f.write(blob)
    print('City list saved in', DATA)


class Cities:
    """Nearest-city lookup over the GeoNames list, held in one-degree cells."""

    def __init__(self, folder):
        self.cells = collections.defaultdict(list)
        self.countries, self.regions = {}, {}
        path = os.path.join(folder, 'cities15000.txt')
        self.ok = os.path.exists(path)
        if not self.ok:
            return
        for name, table, key, value in (('countryInfo.txt', self.countries, 0, 4),
                                        ('admin1CodesASCII.txt', self.regions, 0, 1)):
            p = os.path.join(folder, name)
            if os.path.exists(p):
                with open(p, encoding='utf-8') as f:
                    for line in f:
                        if line.startswith('#'):
                            continue
                        cols = line.rstrip('\n').split('\t')
                        if len(cols) > value:
                            table[cols[key]] = cols[value]
        with open(path, encoding='utf-8') as f:
            for line in f:
                c = line.rstrip('\n').split('\t')
                if len(c) < 15:
                    continue
                try:
                    lat, lon, pop = float(c[4]), float(c[5]), int(c[14] or 0)
                except ValueError:
                    continue
                city = {'name': c[1], 'ascii': c[2] or c[1], 'lat': lat, 'lon': lon,
                        'country': c[8], 'admin1': c[10], 'pop': pop}
                self.cells[(math.floor(lat), math.floor(lon))].append(city)

    def near(self, lat, lon, reach_km):
        dlat = int(reach_km // 111) + 1
        dlon = min(180, int(reach_km // (111 * max(0.05, math.cos(math.radians(lat))))) + 1)
        la, lo = math.floor(lat), math.floor(lon)
        for i in range(la - dlat, la + dlat + 1):
            for j in range(lo - dlon, lo + dlon + 1):
                for city in self.cells.get((i, (j + 180) % 360 - 180), ()):
                    d = km(lat, lon, city['lat'], city['lon'])
                    if d <= reach_km:
                        yield d, city

    def pick(self, lat, lon, radius_km):
        """The biggest city within radius_km, so suburbs fold into their metro;
        failing that, the nearest city within 120 km."""
        close = list(self.near(lat, lon, radius_km))
        if close:
            return max(close, key=lambda dc: dc[1]['pop'])[1]
        far = list(self.near(lat, lon, 120))
        return min(far, key=lambda dc: dc[0])[1] if far else None

    def region(self, city):
        country = self.countries.get(city['country'], city['country'])
        state = self.regions.get(city['country'] + '.' + city['admin1'], '')
        if state and state != city['name']:
            return state + ', ' + country
        return country


def km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2 +
         math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(min(1, math.sqrt(a)))


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


# ----------------------------------------------------------------- grouping
def when_text(dates):
    months = sorted({(d.year, d.month) for d in dates})
    if not months:
        return '', None
    years = sorted({y for y, _ in months})
    if len(years) > 1:
        return '%d - %d' % (years[0], years[-1]), years[-1]
    if len(months) == 1:
        return '%s %d' % (MONTHS[months[0][1] - 1], years[0]), years[0]
    return '%s - %s %d' % (MONTHS[months[0][1] - 1], MONTHS[months[-1][1] - 1], years[0]), years[0]


def group(photos, cities, radius_km):
    groups = {}
    for ph in photos:
        city = cities.pick(ph['lat'], ph['lon'], radius_km) if cities.ok else None
        if city:
            key = slug(city['ascii'] + '-' + city['country'])
            g = groups.setdefault(key, {
                'id': key, 'name': city['name'], 'region': cities.region(city),
                'lon': round(city['lon'], 4), 'lat': round(city['lat'], 4)})
        else:
            # no city list (or nowhere near a city): a half-degree cell, about 50 km
            la, lo = round(ph['lat'] * 2) / 2, round(ph['lon'] * 2) / 2
            key = 'place-%s-%s' % (str(la).replace('-', 's').replace('.', '_'),
                                   str(lo).replace('-', 'w').replace('.', '_'))
            g = groups.setdefault(key, {
                'id': key, 'name': 'Unnamed place', 'region': '%.1f, %.1f' % (la, lo),
                'lon': lo, 'lat': la})
        g.setdefault('_dates', [])
        g.setdefault('_trips', collections.Counter())
        g['photos'] = g.get('photos', 0) + 1
        if ph['date']:
            g['_dates'].append(ph['date'])
        g['_trips'][ph['trip']] += 1
    out = []
    for g in groups.values():
        g['when'], g['year'] = when_text(g['_dates'])
        g['_months'] = len({(d.year, d.month) for d in g['_dates']})
        g['from'] = [t for t, _ in g['_trips'].most_common(3)]
        out.append(g)
    out.sort(key=lambda g: (-(g['year'] or 0), -g['photos']))
    return out


# ----------------------------------------------------------------- places.js
def load_places(path):
    if not os.path.exists(path):
        return []
    text = open(path, encoding='utf-8').read()
    m = re.search(r'window\.PLACES\s*=\s*(\[.*\])\s*;?\s*$', text, re.S)
    if not m:
        sys.exit('Could not find "window.PLACES = [ ... ];" in ' + path)
    try:
        return json.loads(m.group(1))
    except ValueError as e:
        sys.exit('%s is not valid JSON after "window.PLACES =" (%s).\n'
                 'Check for single quotes, comments or a trailing comma.' % (path, e))


def save_places(path, places):
    if os.path.exists(path):
        shutil.copyfile(path, path + '.bak')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(HEADER + 'window.PLACES = ' +
                json.dumps(places, indent=2, ensure_ascii=False) + ';\n')


def merge(existing, found, drop_examples):
    places = [p for p in existing if not (drop_examples and p.get('example'))]
    added, updated = [], []
    for g in found:
        match = None
        for p in places:
            if p.get('example'):
                continue
            if p.get('id') == g['id'] or km(p['lat'], p['lon'], g['lat'], g['lon']) < 30:
                match = p
                break
        if match:
            match['photos'] = g['photos']
            if match.get('auto'):          # still untouched by hand: keep the dates current
                match['when'], match['year'] = g['when'], g['year']
            updated.append(match)
        else:
            new = {'id': g['id'], 'name': g['name'], 'region': g['region'],
                   'lon': g['lon'], 'lat': g['lat'], 'kind': 'visited',
                   'when': g['when'], 'year': g['year'], 'note': '', 'story': [],
                   'photos': g['photos'], 'from': g['from'], 'auto': True}
            places.append(new)
            added.append(new)
    return places, added, updated


def inside_git_repo(path):
    path = os.path.abspath(os.path.expanduser(path))
    while True:
        if os.path.isdir(os.path.join(path, '.git')):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return None
        path = parent


# ----------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description='Turn folders of travel photos into pins for the travel page.')
    ap.add_argument('folders', nargs='*', help='photo folders; each sub-folder is treated as one trip')
    ap.add_argument('--write', action='store_true', help='add what was found to places.js (default: only show it)')
    ap.add_argument('--places', default=DEFAULT_PLACES, help='the places file to update')
    ap.add_argument('--min-photos', type=int, default=2, help='ignore places with fewer photos than this (default 2)')
    ap.add_argument('--radius-km', type=float, default=30, help='fold photos into the biggest city within this distance (default 30)')
    ap.add_argument('--drop-examples', action='store_true', help='remove the made-up example places when writing')
    ap.add_argument('--download-cities', action='store_true', help='fetch the public GeoNames city list (about 3 MB), then continue')
    args = ap.parse_args()

    if args.download_cities:
        download_cities()
    if not args.folders:
        if args.download_cities:
            return
        ap.error('give at least one photo folder')

    for folder in args.folders:
        repo = inside_git_repo(folder)
        if repo:
            print('WARNING: %s is inside the git repository %s.\n'
                  '         Photos kept there could be published with the site, position data and all.\n'
                  '         Keep them outside the repository.\n' % (folder, repo))

    cities = Cities(DATA)
    if not cities.ok:
        print('No city list yet, so places cannot be named. Run once with --download-cities.\n')

    images = find_images(args.folders)
    meta = read_metadata([p for p, _ in images])
    photos, no_gps, unreadable = [], 0, 0
    for path, trip in images:
        rec = meta.get(path)
        if not rec or rec.get('error'):
            unreadable += 1
        elif 'lat' not in rec or (rec['lat'] == 0 and rec['lon'] == 0):
            no_gps += 1
        else:
            photos.append({'lat': rec['lat'], 'lon': rec['lon'],
                           'date': parse_date(rec.get('date')), 'trip': trip})

    print('%d photos found: %d with a position, %d without, %d unreadable.\n'
          % (len(images), len(photos), no_gps, unreadable))
    if not photos:
        print('Nothing to add. Photos sent through chat apps or exported "without location" lose their position.')
        return

    found = group(photos, cities, args.radius_km)
    kept = [g for g in found if g['photos'] >= args.min_photos]
    skipped = len(found) - len(kept)

    print('%-26s %-34s %7s  %-22s %s' % ('Place', 'Region', 'Photos', 'When', 'From folder'))
    for g in kept:
        hint = '   (photos in %d different months: maybe "lived"?)' % g['_months'] if g['_months'] >= 6 else ''
        print('%-26s %-34s %7d  %-22s %s%s' % (g['name'][:26], g['region'][:34], g['photos'],
                                              g['when'], ', '.join(g['from']), hint))
    if skipped:
        print('\n%d place(s) with fewer than %d photos left out (change with --min-photos).' % (skipped, args.min_photos))

    existing = load_places(args.places)
    places, added, updated = merge(existing, kept, args.drop_examples)
    print('\n%d new, %d already on the map.' % (len(added), len(updated)))
    if not args.write:
        print('Nothing was changed. Run again with --write to add the new places to', args.places)
        return
    save_places(args.places, places)
    print('Wrote %s (the previous version is saved next to it as places.js.bak).' % args.places)
    if added:
        print('New places start as "visited" with an empty note and story. Open the file to write those,\n'
              'and change "kind" to "lived" where that fits.')


if __name__ == '__main__':
    main()
