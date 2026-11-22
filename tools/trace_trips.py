#!/usr/bin/env python3
"""Make the road-trip lines on the travel map follow the actual roads.

    python3 tools/trace_trips.py            # show which trips need tracing
    python3 tools/trace_trips.py --write    # trace them and save trips.js

For each trip in trips.md this asks a public routing service for the driving
route through the trip's stops, in order, and saves the path in trips.js,
which the travel page reads. A trip whose stops have not changed since it was
traced is left alone, so the service is only asked about new or edited trips.

WHAT LEAVES YOUR COMPUTER: only the positions (latitude, longitude) of the
stops of the trips being traced, sent to router.project-osrm.org (the OSRM
project's public demo server). No names, no dates, no text. Nothing is sent
without --write.

If no driving route exists (an island, a typo in a position) the trip keeps
its straight lines and the tool says so.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
SERVICE = 'https://router.project-osrm.org/route/v1/driving/'
TOLERANCE = 0.0015          # degrees, about 150 m: how closely the saved line follows the road


def norm(text):
    return re.sub(r'[^a-z0-9]', '', str(text).lower())


def load_places(path):
    with open(path, encoding='utf-8') as f:
        m = re.search(r'window\.PLACES\s*=\s*(\[.*\])\s*;?\s*$', f.read(), re.S)
    return json.loads(m.group(1)) if m else []


def match_place(name, places):
    n = norm(name)
    for p in places:
        if n and n in (norm(p['name']), norm(p['id'])):
            return p
        if p.get('local') and name.strip() == p['local']:
            return p
    return None


def read_trips(path, places):
    """The trips in trips.md: [{'id', 'title', 'stops': [[lon, lat], ...], 'missing': [...]}].
    This mirrors how the travel page reads the file, so the ids match."""
    with open(path, encoding='utf-8') as f:
        text = re.sub(r'<!--.*?-->', '', f.read(), flags=re.S)
    trips, trip, in_story = [], None, False
    for line in text.splitlines():
        m = re.match(r'#[ \t]+(.+?)\s*$', line)
        if m:
            title = m.group(1).split('|')[0].strip()
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-') or str(len(trips) + 1)
            trip = {'id': 'trip-' + slug, 'title': title, 'stops': [], 'missing': []}
            trips.append(trip)
            in_story = False
            continue
        if trip is None:
            continue
        if re.match(r'##[ \t]+', line):
            in_story = True
            continue
        if in_story:
            continue
        m = re.match(r'\s*([^\s:：]+)\s*[:：]\s*(.*)$', line)
        if not m or not re.match(r'(stops|route|路线|站点)$', m.group(1), re.I):
            continue
        for raw in re.split(r'\s*(?:->|>|→)\s*', m.group(2)):
            raw = raw.strip()
            if not raw:
                continue
            at = re.match(r'(.*?)\s*@\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$', raw)
            if at:
                trip['stops'].append([float(at.group(3)), float(at.group(2))])
                continue
            name = raw.split('|')[0].strip()      # "Name | 中文名": the page shows the second one in Chinese
            p = match_place(name, places)
            if p:
                trip['stops'].append([p['lon'], p['lat']])
            else:
                trip['missing'].append(name)
    return trips


def same_stops(a, b):
    return len(a) == len(b) and all(abs(x[0] - y[0]) < 1e-4 and abs(x[1] - y[1]) < 1e-4 for x, y in zip(a, b))


def simplify(points, tolerance):
    """Douglas-Peucker: drop points that sit within `tolerance` of the line."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        worst, at = 0.0, None
        for i in range(a + 1, b):
            px, py = points[i]
            if length2:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            else:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            if d2 > worst:
                worst, at = d2, i
        if at is not None and worst > tolerance * tolerance:
            keep[at] = True
            stack.append((a, at))
            stack.append((at, b))
    return [p for p, k in zip(points, keep) if k]


def fetch_json(url):
    """GET a URL and parse the JSON reply. Python's own HTTPS is tried first;
    the Python that ships with macOS is too old for some servers, so curl is
    the fallback."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'trace-trips/1.0'})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:              # the server answered: read its reason
        try:
            return json.loads(e.read().decode('utf-8'))
        except ValueError:
            raise RuntimeError(str(e))
    except (urllib.error.URLError, OSError, ValueError) as first:
        if not shutil.which('curl'):
            raise RuntimeError('could not reach the routing service (%s)' % first)
    done = subprocess.run(['curl', '-sS', '--max-time', '90', '-A', 'trace-trips/1.0', url],
                          capture_output=True, text=True)
    if done.returncode != 0:
        raise RuntimeError('could not reach the routing service (%s)' % done.stderr.strip())
    try:
        return json.loads(done.stdout)
    except ValueError:
        raise RuntimeError('the routing service sent an unexpected reply')


def trace(stops):
    """Ask the routing service for the driving route through the stops.
    Returns (line, km) or raises RuntimeError with a readable reason."""
    coords = ';'.join('%.5f,%.5f' % (lon, lat) for lon, lat in stops)
    url = SERVICE + coords + '?overview=full&geometries=geojson&steps=false'
    data = fetch_json(url)
    if data.get('code') != 'Ok' or not data.get('routes'):
        raise RuntimeError(data.get('message') or data.get('code') or 'no route found')
    route = data['routes'][0]
    line = [[round(x, 5), round(y, 5)] for x, y in route['geometry']['coordinates']]
    return simplify(line, TOLERANCE), round(route['distance'] / 1000)


def load_routes(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        m = re.search(r'window\.TRIP_ROUTES\s*=\s*(\{.*\})\s*;', f.read(), re.S)
    return json.loads(m.group(1)) if m else {}


def save_routes(path, routes):
    body = ',\n'.join('  %s: %s' % (json.dumps(k), json.dumps(v, separators=(',', ':'))) for k, v in routes.items())
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* The roads each trip in trips.md follows. Written by tools/trace_trips.py:\n'
                '   run it again after changing a trip\'s stops rather than editing this.\n'
                '   stops = the stops the path was traced for, km = driving distance,\n'
                '   line = the path as [longitude, latitude] points. */\n'
                'window.TRIP_ROUTES = {\n' + body + '\n};\n')


def main():
    ap = argparse.ArgumentParser(description='Make road-trip lines follow the roads.')
    ap.add_argument('--write', action='store_true', help='ask the routing service and save trips.js')
    ap.add_argument('--again', action='store_true', help='trace every trip again, even unchanged ones')
    ap.add_argument('--site', default=DEMO, help=argparse.SUPPRESS)
    args = ap.parse_args()

    site = os.path.abspath(args.site)
    trips_md = os.path.join(site, 'content', 'trips.md')
    if not os.path.exists(trips_md):
        sys.exit('No content/trips.md in ' + site)
    trips = read_trips(trips_md, load_places(os.path.join(site, 'places.js')))
    out_path = os.path.join(site, 'trips.js')
    routes = load_routes(out_path)

    todo = []
    for t in trips:
        have = routes.get(t['id'])
        if t['missing']:
            print('  %-40s stops not found: %s (add "Name @ lat, lon")' % (t['title'], ', '.join(t['missing'])))
        if len(t['stops']) < 2:
            print('  %-40s needs at least two stops' % t['title'])
        elif have and same_stops(have.get('stops', []), t['stops']) and not args.again:
            print('  %-40s already traced (%s km)' % (t['title'], have.get('km', '?')))
        else:
            print('  %-40s %d stops, to trace' % (t['title'], len(t['stops'])))
            todo.append(t)
    gone = [k for k in routes if k not in {t['id'] for t in trips}]

    if not args.write:
        if todo:
            print('\nNothing sent yet. --write will send the positions of %d stop(s) to router.project-osrm.org.'
                  % sum(len(t['stops']) for t in todo))
        else:
            print('\nEvery trip is traced.')
        return

    failed = 0
    for n, t in enumerate(todo):
        if n:
            time.sleep(1.2)                 # the public server asks for at most one request a second
        try:
            line, km = trace(t['stops'])
        except RuntimeError as e:
            failed += 1
            routes.pop(t['id'], None)
            print('  %s: no road route (%s). It keeps its straight lines.' % (t['title'], e))
            continue
        routes[t['id']] = {'stops': [[round(x, 5), round(y, 5)] for x, y in t['stops']], 'km': km, 'line': line}
        print('  %s: traced, %d km by road, %d points' % (t['title'], km, len(line)))
    for k in gone:
        del routes[k]
    save_routes(out_path, routes)
    print('\nSaved trips.js (%d trip(s) traced%s).' % (len(routes), ', %d without a road route' % failed if failed else ''))


if __name__ == '__main__':
    main()
