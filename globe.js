/* Travel page: a real map on a globe (MapLibre GL + OpenFreeMap tiles) with a
   pin per place, a story card for the selected place, and two lists (lived,
   visited by country) that drive the map.

   The words come from content/stories.md: one section per place, with an English and a
   中文 part. The page reads that file directly, so writing there and reloading
   is all it takes. places.js holds only where each pin is.

   The map zooms like any map app: double-click or double-tap a spot, pinch, or
   hold Ctrl/Cmd and scroll. Selecting a place flies there and zooms in far
   enough to see rivers, lakes and streets. */
(function () {
  'use strict';
  var PLACES = window.PLACES || [];
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WORLD_ZOOM = 1.35;                           // the whole globe in view
  var PLACE_ZOOM = { lived: 9.5, visited: 8 };     // how close a selected place gets

  // Countries whose visited places are listed under a province / state title.
  var SUBDIVIDED = { 'China': true, 'United States': true };
  // Chinese names for the province titles.
  var AREA_ZH = {
    'Anhui': '安徽', 'Beijing': '北京', 'Chongqing': '重庆', 'Fujian': '福建', 'Gansu': '甘肃',
    'Guangdong': '广东', 'Guangxi': '广西', 'Guizhou': '贵州', 'Hainan': '海南', 'Hebei': '河北',
    'Heilongjiang': '黑龙江', 'Henan': '河南', 'Hong Kong': '香港', 'Hubei': '湖北', 'Hunan': '湖南',
    'Inner Mongolia': '内蒙古', 'Jiangsu': '江苏', 'Jiangxi': '江西', 'Jilin': '吉林', 'Liaoning': '辽宁',
    'Macau': '澳门', 'Ningxia': '宁夏', 'Qinghai': '青海', 'Shaanxi': '陕西', 'Shandong': '山东',
    'Shanghai': '上海', 'Shanxi': '山西', 'Sichuan': '四川', 'Taiwan': '台湾', 'Tianjin': '天津',
    'Tibet': '西藏', 'Xinjiang': '新疆', 'Yunnan': '云南', 'Zhejiang': '浙江'
  };

  // The few fixed words on the story card, in both languages.
  var WORDS = {
    en: { lived: 'Lived', visited: 'Visited', photos: function (n) { return n + (n === 1 ? ' photo' : ' photos'); },
          todo: 'Nothing written here yet.',
          food: function (name, n) { return 'Good food in ' + name + ' (' + n + ')'; },
          trip: 'Road trip', tripTodo: 'Nothing written here yet.',
          missing: function (names) { return 'Not on the line yet: ' + names + '. Give it a position in trips.md, like "Name @ 40.71, -74.00".'; } },
    zh: { lived: '住过', visited: '去过', photos: function (n) { return n + ' 张照片'; },
          todo: '这里还没有写。',
          food: function (name, n) { return name + '的好吃的（' + n + '）'; },
          trip: '自驾', tripTodo: '这里还没有写。',
          missing: function (names) { return '还没有画上：' + names + '。在 trips.md 里给它一个位置，比如 “Name @ 40.71, -74.00”。'; } }
  };
  var S = window.Site, el = S.el;      // shared with the food page: common.js
  var lang = S.getLang();

  // The map's colours, taken from the site palette.
  var C = {
    land: '#E8D6AE', ocean: '#3A8BC8', oceanDeep: '#22608F',
    park: '#C5D3A2', wood: '#BACB9A', ice: '#F7F6F0', town: '#E0CCA0',
    building: '#D6C290', buildingEdge: '#C4AF7C',
    road: '#FFF9E8', roadMinor: '#F3E8CB', casing: '#CBB684',
    border: 'rgba(28,26,58,.42)', ink: '#1C1A3A', muted: '#5F563F',
    trip: '#CDEFB0', tripEdge: '#3E6B3C', tripGlow: '#F4FFE4'      // road trips: light green, edged so it reads on sand
  };

  function byId(id) {
    for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i];
    return null;
  }
  // a name in Chinese, e.g. 杭州 beside Hangzhou
  function localSpan(text) {
    var n = el('span', 'local', text);
    n.lang = 'zh-Hans';
    return n;
  }
  function regionParts(p) {
    return String(p.region || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  // visited places are listed by country: the last part of "region"
  function country(p) {
    var parts = regionParts(p);
    return parts[parts.length - 1] || 'Elsewhere';
  }
  // the province / state a place belongs to, or '' when the place is one itself
  // (Gansu, Beijing, Hong Kong ...)
  function area(p) {
    var parts = regionParts(p);
    if (p.level === 'region' || parts.length < 2) return '';
    var a = parts[parts.length - 2].replace(/\s+SAR$/, '');
    return a === p.name ? '' : a;
  }

  /* ---------- stories.md ---------- */
  var STORIES = {};   // place id -> { en: {when, note, body}, zh: {when, note, body} }
  var FOOD = {};      // place id -> how many restaurants food.md lists for it

  function placeForHeading(text) { return S.matchPlace(text, PLACES); }
  var META = { when: 'when', note: 'note', '时间': 'when', '一句话': 'note' };

  function parseStories(src) {
    var out = {}, place = null, sec = null;
    S.stripComments(src).split(/\r?\n/).forEach(function (line) {
      var m;
      if ((m = /^#[ \t]+(.+?)\s*$/.exec(line))) {
        place = placeForHeading(m[1]); sec = null;
        if (!place && window.console) console.warn('stories.md: no place called "' + m[1] + '"');
        return;
      }
      if ((m = /^##[ \t]+(.+?)\s*$/.exec(line))) {
        sec = null;
        if (!place) return;
        if (/^(photos|照片|相册)$/i.test(m[1].trim())) {      // "file.jpg: caption | 中文说明" lines
          sec = { captions: (out[place.id] = out[place.id] || {}).captions = (out[place.id].captions || {}) };
          return;
        }
        var l = S.isChineseHeading(m[1]) ? 'zh' : 'en';
        sec = { when: '', note: '', lines: [], head: true };
        (out[place.id] = out[place.id] || {})[l] = sec;
        return;
      }
      if (!sec) return;
      if (sec.captions) {
        m = /^\s*([^:：|]+?\.(?:jpe?g|png|webp))\s*[:：]\s*(.*)$/i.exec(line);
        if (m) {
          var both = m[2].split('|');
          sec.captions[m[1].trim().toLowerCase()] = { en: both[0].trim(), zh: (both[1] || '').trim() };
        }
        return;
      }
      if (sec.head) {                       // "when:" and "note:" lines come first
        if (!line.trim()) return;
        m = /^\s*(when|note|时间|一句话)\s*[:：]\s*(.*)$/i.exec(line);
        if (m) { sec[META[m[1].toLowerCase()]] = m[2].trim(); return; }
        sec.head = false;
      }
      sec.lines.push(line);
    });
    Object.keys(out).forEach(function (id) {
      ['en', 'zh'].forEach(function (l) {
        var s = out[id][l];
        if (s) { s.body = s.lines.join('\n').trim(); delete s.lines; delete s.head; }
      });
    });
    return out;
  }

  // What to show for a place in the current language. If only the other
  // language is written, that one is shown rather than nothing.
  function words(p, key) {
    var s = p.text || STORIES[p.id] || {}, other = lang === 'en' ? 'zh' : 'en';
    var mine = s[lang] && s[lang][key];
    if (mine) return { text: mine, lang: lang };
    var fromPlaces = key === 'body' ? (p.story || []).join('\n\n') : p[key];   // places.js is English
    if (fromPlaces && lang === 'en') return { text: fromPlaces, lang: 'en' };
    var theirs = s[other] && s[other][key];
    if (theirs) return { text: theirs, lang: other };
    if (fromPlaces) return { text: fromPlaces, lang: 'en' };
    return { text: '', lang: lang };
  }
  // the "### City" titles inside a province's story: the cities visited there
  function subTitles(p) {
    var out = [];
    words(p, 'body').text.split('\n').forEach(function (line) {
      var m = /^###[ \t]+(.+?)\s*$/.exec(line);
      if (m) out.push(m[1]);
    });
    return out;
  }

  /* ---------- trips.md: road trips ---------- */
  var TRIPS = [];     // { id, title, titleZh, stops: [{name, lon, lat, place}], missing: [names], text: {en, zh}, example }
  var trip = null;    // the selected trip, when a trip rather than a place is showing
  var mapReady = false;

  function parseTrips(src) {
    var list = [], t = null, sec = null;
    function stops(text) {
      text.split(/\s*(?:>|→|->)\s*/).forEach(function (raw) {
        raw = raw.trim();
        if (!raw) return;
        var m = /^(.*?)\s*@\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/.exec(raw);
        if (m) { t.stops.push({ name: m[1].trim() || raw, lat: +m[2], lon: +m[3], place: null }); return; }
        var p = placeForHeading(raw);
        if (p) t.stops.push({ name: p.name, lat: p.lat, lon: p.lon, place: p });
        else t.missing.push(raw);
      });
    }
    S.stripComments(src).split(/\r?\n/).forEach(function (line) {
      var m;
      if ((m = /^#[ \t]+(.+?)\s*$/.exec(line))) {
        var names = m[1].split('|');
        t = { title: names[0].trim(), titleZh: (names[1] || '').trim(), stops: [], missing: [], text: {}, example: false };
        t.id = 'trip-' + (t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || (list.length + 1));
        list.push(t); sec = null;
        return;
      }
      if (!t) return;
      if ((m = /^##[ \t]+(.+?)\s*$/.exec(line))) {
        sec = t.text[S.isChineseHeading(m[1]) ? 'zh' : 'en'] = { when: '', note: '', lines: [], head: true };
        return;
      }
      if (!sec) {                           // the lines right under the trip's name
        m = /^\s*([^\s:：]+)\s*[:：]\s*(.*)$/.exec(line);
        if (m && /^(stops|route|路线|站点)$/i.test(m[1])) stops(m[2]);
        else if (m && /^example$/i.test(m[1])) t.example = /^(yes|true|1)$/i.test(m[2].trim());
        return;
      }
      if (sec.head) {
        if (!line.trim()) return;
        m = /^\s*(when|note|时间|一句话)\s*[:：]\s*(.*)$/i.exec(line);
        if (m) { sec[META[m[1].toLowerCase()]] = m[2].trim(); return; }
        sec.head = false;
      }
      sec.lines.push(line);
    });
    list.forEach(function (x) {
      ['en', 'zh'].forEach(function (l) {
        var s = x.text[l];
        if (s) { s.body = s.lines.join('\n').trim(); delete s.lines; delete s.head; }
      });
    });
    return list;
  }
  function tripById(id) {
    for (var i = 0; i < TRIPS.length; i++) if (TRIPS[i].id === id) return TRIPS[i];
    return null;
  }
  function tripTitle(t) { return (lang === 'zh' && t.titleZh) || t.title; }

  // The road a trip follows, as traced by tools/trace_trips.py into trips.js.
  // It only counts while the trip still has the stops it was traced for.
  function roadFor(t) {
    var r = (window.TRIP_ROUTES || {})[t.id];
    if (!r || !r.line || !r.stops || r.stops.length !== t.stops.length) return null;
    for (var i = 0; i < t.stops.length; i++) {
      if (Math.abs(r.stops[i][0] - t.stops[i].lon) > 1e-4 || Math.abs(r.stops[i][1] - t.stops[i].lat) > 1e-4) return null;
    }
    return r;
  }

  // The lines on the map: the traced road where there is one, otherwise the
  // stops joined in order by straight lines.
  function drawTrips() {
    if (!map || !mapReady) return;
    var lines = [], dots = [];
    TRIPS.forEach(function (t) {
      if (t.stops.length > 1) {
        lines.push({ type: 'Feature', properties: { id: t.id },
          geometry: { type: 'LineString', coordinates: (roadFor(t) || {}).line || t.stops.map(function (s) { return [s.lon, s.lat]; }) } });
      }
      t.stops.forEach(function (s) {        // stops that have no pin of their own get a small dot
        if (!s.place) dots.push({ type: 'Feature', properties: { id: t.id, name: s.name }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } });
      });
    });
    var data = { type: 'FeatureCollection', features: lines };
    var dotData = { type: 'FeatureCollection', features: dots };
    if (map.getSource('trips')) {
      map.getSource('trips').setData(data);
      map.getSource('trip-stops').setData(dotData);
    } else {
      map.addSource('trips', { type: 'geojson', data: data });
      map.addSource('trip-stops', { type: 'geojson', data: dotData });
      var labels = (map.getStyle().layers.filter(function (l) { return l.type === 'symbol'; })[0] || {}).id;   // keep place names on top
      var round = { 'line-cap': 'round', 'line-join': 'round' };
      var wide = function (a, b) { return ['interpolate', ['linear'], ['zoom'], 1, a, 8, b]; };
      map.addLayer({ id: 'trip-glow', type: 'line', source: 'trips', layout: round, filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': C.tripGlow, 'line-width': wide(9, 16), 'line-opacity': 0.8 } }, labels);
      map.addLayer({ id: 'trip-edge', type: 'line', source: 'trips', layout: round,
        paint: { 'line-color': C.tripEdge, 'line-width': wide(4.2, 7.6) } }, labels);
      map.addLayer({ id: 'trip-line', type: 'line', source: 'trips', layout: round,
        paint: { 'line-color': C.trip, 'line-width': wide(2.8, 5.6) } }, labels);
      map.addLayer({ id: 'trip-stops', type: 'circle', source: 'trip-stops',
        paint: { 'circle-radius': wide(2.5, 5), 'circle-color': C.trip, 'circle-stroke-color': C.tripEdge, 'circle-stroke-width': 1.5 } }, labels);
      map.addLayer({ id: 'trip-hit', type: 'line', source: 'trips', layout: round,     // a wide, invisible line to click
        paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 18 } });
      map.on('click', 'trip-hit', function (e) {
        var f = e.features && e.features[0];
        if (f) selectTrip(f.properties.id);
      });
      map.on('mouseenter', 'trip-hit', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'trip-hit', function () { map.getCanvas().style.cursor = ''; });
    }
    map.setFilter('trip-glow', ['==', ['get', 'id'], trip ? trip.id : '']);
  }

  function paintTrip(t) {
    var W = WORDS[lang];
    var when = words(t, 'when').text;
    var road = roadFor(t);
    $('story-kind').textContent = W.trip + (when ? ' · ' + when : '') +
      (road && road.km ? ' · ' + Number(road.km).toLocaleString('en-US') + ' km' : '');
    var h = $('story-name');
    h.textContent = tripTitle(t);
    h.lang = lang === 'zh' && t.titleZh ? 'zh-Hans' : 'en';
    if (t.example) h.appendChild(el('span', 'badge', 'Example'));
    $('story-region').textContent = t.stops.map(function (s) {
      return lang === 'zh' && s.place && s.place.local ? s.place.local : s.name;
    }).join(' \u2192 ');
    var note = words(t, 'note');
    $('story-note').textContent = note.text;
    $('story-note').lang = note.lang === 'zh' ? 'zh-Hans' : 'en';
    $('story-note').hidden = !note.text;
    var body = words(t, 'body'), box = $('story-body');
    if (body.text) S.render(box, body.text, body.lang);
    else {
      box.textContent = '';
      box.lang = lang === 'zh' ? 'zh-Hans' : 'en';
      box.appendChild(el('p', 'todo', W.tripTodo));
    }
    if (t.missing.length) box.appendChild(el('p', 'todo', W.missing(t.missing.join(', '))));
    $('story-album').hidden = true;
    $('story-food').hidden = true;
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
  }
  function selectTrip(id, opts) {
    opts = opts || {};
    var t = tripById(id);
    if (!t) return;
    trip = t; selected = null;
    paintTrip(t);
    markCurrent();
    if (map && mapReady) {
      map.setFilter('trip-glow', ['==', ['get', 'id'], t.id]);
      if (t.stops.length) {                // bring the whole route into view
        var w = 180, s = 90, e = -180, n = -90;
        t.stops.forEach(function (p) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); });
        map.fitBounds([[w, s], [e, n]], { padding: 56, maxZoom: 9, duration: (opts.instant || reduceMotion) ? 0 : 1600, essential: true });
      }
    }
    if (opts.hash !== false) {
      try { history.replaceState(null, '', '#' + t.id); } catch (err) {}
    }
  }

  /* ---------- photo album ---------- */
  var ALBUM_SHOWN = 8;        // thumbnails on the card; the rest open from the last one
  function album(p) {
    var list = (window.PHOTOS || {})[p.id] || [];
    var caps = (STORIES[p.id] || {}).captions || {};
    var out = [];
    list.forEach(function (it) {
      var c = caps[String(it.file).toLowerCase()] || {};
      if (c.en === '-') return;                              // a caption of "-" hides the photo
      var mine = lang === 'zh' ? c.zh : c.en, other = lang === 'zh' ? c.en : c.zh;
      out.push({
        src: 'photos/' + p.id + '/' + it.file,
        thumb: 'photos/' + p.id + '/' + String(it.file).replace(/\.jpe?g$/i, '-s.jpg'),
        cap: mine || other || '',
        capLang: mine ? lang : (lang === 'zh' ? 'en' : 'zh')
      });
    });
    return out;
  }
  function paintAlbum(p) {
    var box = $('story-album'), shots = album(p);
    box.textContent = '';
    box.hidden = !shots.length;
    shots.slice(0, ALBUM_SHOWN).forEach(function (s, i) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('data-shot', i);
      var img = el('img');
      img.src = s.thumb; img.loading = 'lazy'; img.alt = s.cap || (p.name + ', photo ' + (i + 1));
      b.appendChild(img);
      if (i === ALBUM_SHOWN - 1 && shots.length > ALBUM_SHOWN) {
        b.appendChild(el('span', 'more', '+' + (shots.length - ALBUM_SHOWN + 1)));
      }
      box.appendChild(b);
    });
  }

  // the full view: one photo at a time, with its caption
  var viewer = $('lightbox'), shots = [], at = 0;
  function showShot(i) {
    if (!shots.length) return;
    at = (i + shots.length) % shots.length;
    var s = shots[at], img = $('lb-img');
    img.src = s.src;
    img.alt = s.cap || (selected ? selected.name + ', photo ' + (at + 1) : '');
    $('lb-cap').textContent = s.cap;
    $('lb-cap').lang = s.capLang === 'zh' ? 'zh-Hans' : 'en';
    $('lb-count').textContent = (at + 1) + ' / ' + shots.length;
    viewer.classList.toggle('single', shots.length < 2);
    var next = shots[(at + 1) % shots.length];
    if (next && next !== s) { new Image().src = next.src; }   // have the next one ready
  }
  function openViewer(i) {
    if (!selected || !viewer || !viewer.showModal) return;
    shots = album(selected);
    showShot(i);
    if (!viewer.open) viewer.showModal();
  }
  if (viewer) {
    viewer.addEventListener('click', function (e) {
      if (e.target === viewer || e.target.closest('.lb-close')) viewer.close();   // the dark surround closes it
      else if (e.target.closest('.lb-prev')) showShot(at - 1);
      else if (e.target.closest('.lb-next')) showShot(at + 1);
    });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showShot(at - 1);
      else if (e.key === 'ArrowRight') showShot(at + 1);
    });
  }

  /* ---------- lists ---------- */
  function nameInto(node, p) {
    node.appendChild(el('b', null, p.name));
    if (p.local) node.appendChild(localSpan(p.local));
  }
  function placeButton(p, compact, cls) {
    var b = el('button', cls || null);
    b.type = 'button';
    b.setAttribute('data-place', p.id);
    nameInto(b, p);
    if (p.example) b.appendChild(el('span', 'badge', 'Example'));
    if (!compact) {
      var note = words(p, 'note');
      var small = el('small', null, note.text || p.region);   // no note yet: show where it is
      if (note.text && note.lang === 'zh') small.lang = 'zh-Hans';
      b.appendChild(small);
    }
    return b;
  }

  var selected = null;
  var map = null;

  function renderLists() {
    var livedList = $('lived-list');
    livedList.textContent = '';
    PLACES.filter(function (p) { return p.kind === 'lived'; }).forEach(function (p) {
      var li = el('li');
      li.appendChild(placeButton(p, false));
      livedList.appendChild(li);
    });

    // one group per country, in the order the countries first appear in places.js
    var groups = {}, order = [];
    PLACES.filter(function (p) { return p.kind === 'visited'; }).forEach(function (p) {
      var c = country(p);
      if (!groups[c]) { groups[c] = []; order.push(c); }
      groups[c].push(p);
    });
    var tripList = $('trips-list');
    tripList.textContent = '';
    $('trips-tile').hidden = !TRIPS.length;
    $('legend-trip').hidden = !TRIPS.length;
    TRIPS.forEach(function (t) {
      var li = el('li'), b = el('button');
      b.type = 'button';
      b.setAttribute('data-trip', t.id);
      b.appendChild(el('b', null, tripTitle(t)));
      if (t.example) b.appendChild(el('span', 'badge', 'Example'));
      var when = words(t, 'when').text;
      b.appendChild(el('small', null, t.stops.map(function (s) {
        return lang === 'zh' && s.place && s.place.local ? s.place.local : s.name;
      }).join(' \u2192 ') + (when ? '  ·  ' + when : '')));
      li.appendChild(b);
      tripList.appendChild(li);
    });

    var box = $('visited-list');
    box.textContent = '';
    order.forEach(function (c) {
      var row = el('div', 'year');
      var head = el('span', null, c);
      head.appendChild(el('small', null, String(groups[c].length)));
      row.appendChild(head);
      row.appendChild(SUBDIVIDED[c] ? areaList(groups[c]) : flatList(groups[c]));
      box.appendChild(row);
    });
    markCurrent();
  }
  function flatList(places) {
    var ul = el('ul', 'flat');
    places.forEach(function (p) {
      var li = el('li');
      li.appendChild(placeButton(p, true));
      ul.appendChild(li);
    });
    return ul;
  }
  // China and the United States: a title per province / state, its cities beside it.
  function areaList(places) {
    var areas = [], byName = {};
    function get(name) {
      if (!byName[name]) { byName[name] = { name: name, self: null, cities: [] }; areas.push(byName[name]); }
      return byName[name];
    }
    places.forEach(function (p) {
      var a = area(p);
      if (a) get(a).cities.push(p); else get(p.name).self = p;   // the place is the province itself
    });
    var wrap = el('div', 'areas');
    areas.forEach(function (a) {
      var row = el('div', 'area'), title;
      if (a.self) {
        title = placeButton(a.self, true, 'area-title');
      } else {
        title = el('span', 'area-title');
        title.appendChild(el('b', null, a.name));
        if (AREA_ZH[a.name]) title.appendChild(localSpan(AREA_ZH[a.name]));
      }
      row.appendChild(title);
      var ul = el('ul');
      a.cities.forEach(function (p) {
        var li = el('li');
        li.appendChild(placeButton(p, true));
        ul.appendChild(li);
      });
      // cities named by "### City" titles inside the province's own story
      if (a.self) subTitles(a.self).forEach(function (t, i) {
        var li = el('li'), b = el('button', 'sub', t);
        b.type = 'button';
        b.setAttribute('data-place', a.self.id);
        b.setAttribute('data-sub', i);
        li.appendChild(b);
        ul.appendChild(li);
      });
      row.appendChild(ul);
      wrap.appendChild(row);
    });
    return wrap;
  }
  function markCurrent() {
    document.querySelectorAll('[data-place]').forEach(function (b) {
      var on = !!selected && b.getAttribute('data-place') === selected.id && !b.hasAttribute('data-sub');
      b.setAttribute('aria-current', String(on));
    });
    document.querySelectorAll('[data-trip]').forEach(function (b) {
      b.setAttribute('aria-current', String(!!trip && b.getAttribute('data-trip') === trip.id));
    });
  }

  /* ---------- story card ---------- */
  function paintStory(p) {
    var W = WORDS[lang];
    var when = words(p, 'when').text;
    $('story-kind').textContent = (p.kind === 'lived' ? W.lived : W.visited) + (when ? ' · ' + when : '') +
      (p.photos ? ' · ' + W.photos(p.photos) : '');
    var h = $('story-name');
    h.textContent = '';
    h.removeAttribute('lang');
    if (lang === 'zh' && p.local) {           // Chinese first when reading in Chinese
      h.appendChild(localSpan(p.local)).className = 'local main';
      h.appendChild(el('span', 'second', p.name));
    } else {
      h.appendChild(document.createTextNode(p.name));
      if (p.local) h.appendChild(localSpan(p.local));
    }
    if (p.example) h.appendChild(el('span', 'badge', 'Example'));
    $('story-region').textContent = p.region;
    var note = words(p, 'note');
    $('story-note').textContent = note.text;
    $('story-note').lang = note.lang === 'zh' ? 'zh-Hans' : 'en';
    $('story-note').hidden = !note.text;
    var body = words(p, 'body'), box = $('story-body');
    if (body.text) S.render(box, body.text, body.lang);
    else {
      box.textContent = '';
      box.lang = lang === 'zh' ? 'zh-Hans' : 'en';
      box.appendChild(el('p', 'todo', W.todo));
    }
    paintAlbum(p);
    var eat = $('story-food'), n = FOOD[p.id] || 0;
    eat.hidden = !n;
    if (n) {
      eat.firstChild.href = 'food.html#' + p.id;
      eat.firstChild.textContent = W.food(lang === 'zh' && p.local ? p.local : p.name, n) + ' \u2192';
    }
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
  }

  function goTo(p, zoom, instant) {
    if (!map) return;
    var view = { center: [p.lon, p.lat], zoom: zoom };
    if (instant || reduceMotion) map.jumpTo(view);
    else map.flyTo({ center: view.center, zoom: view.zoom, speed: 0.9, curve: 1.5, essential: true });
  }

  // opts.zoomIn false keeps the whole globe in view (used for the first paint)
  function select(id, opts) {
    opts = opts || {};
    var p = byId(id) || PLACES[0];
    if (!p) return;
    selected = p; trip = null;
    if (map && mapReady && map.getLayer('trip-glow')) map.setFilter('trip-glow', ['==', ['get', 'id'], '']);
    paintStory(p);
    markCurrent();
    goTo(p, opts.zoomIn === false ? WORLD_ZOOM : (p.zoom || PLACE_ZOOM[p.kind] || 8), opts.instant);
    if (opts.hash !== false) {
      try { history.replaceState(null, '', '#' + p.id); } catch (e) {}
    }
  }

  document.addEventListener('click', function (e) {
    var l = e.target.closest('[data-lang]');
    if (l) {
      lang = S.setLang(l.getAttribute('data-lang'));
      renderLists();
      if (trip) paintTrip(trip); else if (selected) paintStory(selected);
      return;
    }
    var road = e.target.closest('[data-trip]');
    if (road) { selectTrip(road.getAttribute('data-trip')); return; }
    var shot = e.target.closest('[data-shot]');
    if (shot) { openViewer(+shot.getAttribute('data-shot')); return; }
    var b = e.target.closest('[data-place]');
    if (!b) return;
    select(b.getAttribute('data-place'));
    if (b.hasAttribute('data-sub')) {         // a city inside a province's story: show that part
      var h3 = $('story-body').querySelectorAll('h3')[+b.getAttribute('data-sub')];
      if (h3) h3.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });
  function step(delta) {
    var i = PLACES.indexOf(selected);
    select(PLACES[(i + delta + PLACES.length) % PLACES.length].id);
  }
  $('prev-place').addEventListener('click', function () { step(-1); });
  $('next-place').addEventListener('click', function () { step(1); });
  $('zoom-reset').addEventListener('click', function () {
    if (!map) return;
    var c = selected ? [selected.lon, selected.lat] : map.getCenter();
    if (reduceMotion) map.jumpTo({ center: c, zoom: WORLD_ZOOM });
    else map.flyTo({ center: c, zoom: WORLD_ZOOM, speed: 1.1, essential: true });
  });

  /* ---------- first paint, then the words ---------- */
  var note = $('globe-note');
  var start = byId(location.hash.slice(1)) || PLACES[0];
  var startedFromLink = !!byId(location.hash.slice(1));
  selected = start || null;
  renderLists();
  if (start) paintStory(start);

  // "no-cache" so an edit to stories.md shows on the next reload
  fetch('content/stories.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('stories ' + r.status); return r.text(); })
    .then(function (src) {
      STORIES = parseStories(src);
      renderLists();
      if (selected) paintStory(selected);
    })
    .catch(function () {});   // no stories file: the page still works from places.js

  // the road trips: a list under the places, and lines on the map
  fetch('content/trips.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('trips ' + r.status); return r.text(); })
    .then(function (src) {
      TRIPS = parseTrips(src);
      renderLists();
      drawTrips();
      if (tripById(location.hash.slice(1))) selectTrip(location.hash.slice(1), { instant: true, hash: false });   // a link to one trip
    })
    .catch(function () {});

  // count the restaurants written for each place, for the link on its story card
  fetch('content/food.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('food ' + r.status); return r.text(); })
    .then(function (src) {
      var place = null;
      S.stripComments(src).split(/\r?\n/).forEach(function (line) {
        var m;
        if ((m = /^#[ \t]+(.+?)\s*$/.exec(line))) place = placeForHeading(m[1]);
        else if (place && /^##[ \t]+\S/.test(line)) FOOD[place.id] = (FOOD[place.id] || 0) + 1;
      });
      if (selected) paintStory(selected);
    })
    .catch(function () {});

  /* ---------- map ---------- */
  function fail(message) {
    note.textContent = message;
    $('map').classList.add('is-off');
  }
  if (!window.maplibregl) { fail('The map could not load, but the lists below still work.'); return; }

  // Repaint the basemap in the site palette, layer by layer.
  function recolour(l) {
    var p = l.paint = l.paint || {};
    var id = l.id, src = l['source-layer'];
    if (l.type === 'background') p['background-color'] = C.land;
    else if (src === 'water') p['fill-color'] = C.ocean;
    else if (src === 'waterway' && l.type === 'line') p['line-color'] = C.ocean;
    else if (src === 'park') p['fill-color'] = C.park;
    else if (id === 'landcover_wood') p['fill-color'] = C.wood;
    else if (src === 'landcover') p['fill-color'] = C.ice;
    else if (src === 'landuse') p['fill-color'] = C.town;
    else if (src === 'building') { p['fill-color'] = C.building; p['fill-outline-color'] = C.buildingEdge; }
    else if (src === 'aeroway') p[l.type === 'fill' ? 'fill-color' : 'line-color'] = C.roadMinor;
    else if (src === 'transportation') {
      if (l.type === 'fill') p['fill-color'] = C.land;
      else if (/pier/.test(id)) p['line-color'] = C.land;
      else if (/railway/.test(id)) p['line-color'] = /dash/.test(id) ? C.roadMinor : C.casing;
      else if (/casing/.test(id)) p['line-color'] = C.casing;
      else if (/inner/.test(id)) p['line-color'] = C.road;
      else p['line-color'] = C.roadMinor;
    }
    else if (src === 'boundary') p['line-color'] = C.border;
    else if (l.type === 'symbol' && (src === 'water_name' || src === 'waterway')) {
      p['text-color'] = '#FFFFFF'; p['text-halo-color'] = C.oceanDeep; p['text-halo-width'] = 1;
    }
    else if (l.type === 'symbol' && src === 'place') {
      p['text-color'] = C.ink; p['text-halo-color'] = 'rgba(255,255,255,.78)';
    }
    else if (l.type === 'symbol' && p['text-color']) {
      p['text-color'] = C.muted; p['text-halo-color'] = C.land;
    }
  }

  fetch('https://tiles.openfreemap.org/styles/positron')
    .then(function (r) { if (!r.ok) throw new Error('style ' + r.status); return r.json(); })
    .then(function (style) {
      style.projection = { type: 'globe' };
      style.layers.forEach(recolour);

      map = new maplibregl.Map({
        container: 'map',
        style: style,
        center: start ? [start.lon, start.lat] : [-100, 35],
        zoom: WORLD_ZOOM,
        minZoom: 0.8,
        maxZoom: 15,
        attributionControl: { compact: true },
        cooperativeGestures: true,   // page scroll stays page scroll; Ctrl/Cmd + scroll or pinch zooms
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      // Visited pins go on first so the lived ones sit on top.
      PLACES.slice().sort(function (a, b) { return (a.kind === 'lived') - (b.kind === 'lived'); })
        .forEach(function (p) {
          var pin = el('button', 'pin ' + p.kind);
          pin.type = 'button';
          pin.setAttribute('data-place', p.id);
          pin.setAttribute('aria-label', p.name + (p.local ? ' ' + p.local : '') + ', ' + (p.kind === 'lived' ? 'lived' : 'visited'));
          pin.title = p.name + (p.local ? ' ' + p.local : '');
          pin.appendChild(el('span', 'dot'));
          // opacityWhenCovered 0: a pin on the far side of the globe is hidden, not shown through it
          new maplibregl.Marker({ element: pin, anchor: 'center', opacityWhenCovered: '0' }).setLngLat([p.lon, p.lat]).addTo(map);
        });
      markCurrent();

      map.on('error', function () {});   // a missing tile should not surface as a page error
      map.once('load', function () {
        mapReady = true;
        drawTrips();
        if (trip) selectTrip(trip.id, { instant: true, hash: false });
        var lived = PLACES.filter(function (p) { return p.kind === 'lived'; }).length;
        note.textContent = lived + ' lived, ' + (PLACES.length - lived) + ' visited.';
      });

      // Arriving by a link to one place opens zoomed in on it; otherwise start on the whole globe.
      if (selected) select(selected.id, { zoomIn: startedFromLink, instant: true, hash: false });
    })
    .catch(function () { fail('The map could not load, but the lists below still work.'); });
})();
