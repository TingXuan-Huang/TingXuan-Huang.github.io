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
          allYears: 'All years', noneThatYear: 'Nothing dated in this year.',
          places: function (n) { return n + (n === 1 ? ' place' : ' places'); },
          missing: function (names) { return 'Not on the line yet: ' + names + '. Give it a position in trips.md, like "Name @ 40.71, -74.00".'; } },
    zh: { lived: '住过', visited: '去过', photos: function (n) { return n + ' 张照片'; },
          todo: '这里还没有写。',
          food: function (name, n) { return name + '的好吃的（' + n + '）'; },
          trip: '自驾', tripTodo: '这里还没有写。',
          allYears: '全部年份', noneThatYear: '这一年还没有记录。',
          places: function (n) { return n + ' 个地方'; },
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
    path: '#8E1523',                                               // the line through one year's places
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
        // "Name | 中文名": an optional Chinese name for a stop that is not a pin
        var names = (m ? m[1] : raw).split('|'), name = names[0].trim(), zh = (names[1] || '').trim();
        if (m) { t.stops.push({ name: name || raw, local: zh, lat: +m[2], lon: +m[3], place: null }); return; }
        var p = placeForHeading(name);
        if (p) t.stops.push({ name: p.name, local: zh || p.local || '', lat: p.lat, lon: p.lon, place: p });
        else t.missing.push(name);
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
  function stopName(s) { return (lang === 'zh' && s.local) || s.name; }

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
    applyYear();
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
    $('story-region').textContent = t.stops.map(stopName).join(' \u2192 ');
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
    if (year !== null && !inYear(t, year)) setYear(null, true);
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

  /* ---------- time bar: one year of travel at a time ----------
     The dates come from the "when:" lines in stories.md and trips.md.
       2019            a visit that year            2019.7  or  July 2019   with a month
       2019.7.15       with a day                   2018.5, 2023.12         two visits
       2015 - 2019     a stay (every year between)  2023.9 - now            a stay that is still going
     Pick a year on the bar: the globe keeps that year's places and joins the
     ones dated in it, in date order, with a line. */
  var THIS_YEAR = new Date().getFullYear();
  var year = null;            // the year showing on the globe; null = every year
  var TIME = { min: 0, max: 0, any: false };
  var MONTH_WORDS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
                      spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };
  var MONTH_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|spring|summer|fall|autumn|winter)[a-z]*\.?/gi;
  function monthWord(text) {            // the last month or season named in a piece of text
    var m, found = 0;
    MONTH_RE.lastIndex = 0;
    while ((m = MONTH_RE.exec(text))) found = MONTH_WORDS[m[1].toLowerCase()];
    return found;
  }
  // "when" text -> [{ y, m, d, to }]; "to" is null for a visit, an end year for a stay.
  function parseWhen(text) {
    var s = String(text || ''), toks = [], m, out = [];
    var re = /((?:19|20)\d{2})(?:\s*[.\-\/年]\s*(\d{1,2})(?!\d)(?:\s*[.\-\/月]\s*(\d{1,2})(?!\d))?)?/g;
    while ((m = re.exec(s))) {
      var mo = +m[2] || 0, day = +m[3] || 0;
      if (mo > 12) { mo = 0; day = 0; }
      toks.push({ y: +m[1], m: mo, d: day > 31 ? 0 : day, start: m.index, end: m.index + m[0].length });
    }
    toks.forEach(function (t, i) {
      if (t.m) return;
      t.m = monthWord(s.slice(i ? toks[i - 1].end : 0, t.start));            // "March 2019"
      var zh = /^年?\s*([春夏秋冬])/.exec(s.slice(t.end));                      // "2019年夏"
      if (!t.m && zh) t.m = { '春': 3, '夏': 6, '秋': 9, '冬': 12 }[zh[1]];
    });
    var JOIN = /^\s*(?:[-–—~〜至到]|to|until)\s*$/i, NOW = /^\s*(?:[-–—~〜至到]|to|until)?\s*(?:now|present|today|今|现在|至今)/i;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], next = toks[i + 1], after = s.slice(t.end, next ? next.start : s.length);
      var item = { y: t.y, m: t.m, d: t.d, to: null };
      if (next && JOIN.test(after.replace(MONTH_RE, ''))) { item.to = next.y; i++; }
      else if (NOW.test(after) || /(?:since|from)\s*$/i.test(s.slice(0, t.start))) item.to = THIS_YEAR;
      out.push(item);
    }
    return out;
  }
  function datesOf(x) {                 // x: a place or a trip
    var s = x.text || STORIES[x.id] || {}, tries = [s.en && s.en.when, s.zh && s.zh.when, x.when];
    for (var i = 0; i < tries.length; i++) {
      var d = parseWhen(tries[i]);
      if (d.length) return d;
    }
    return [];
  }
  function inYear(x, y) {
    return datesOf(x).some(function (d) { return d.to === null ? d.y === y : (d.y <= y && y <= d.to); });
  }
  // the places dated in a year (a visit, or the start of a stay), in date order
  function pathOf(y) {
    var pts = [];
    PLACES.forEach(function (p, i) {
      datesOf(p).forEach(function (d) {
        if (d.y === y) pts.push({ place: p, key: d.m * 100 + d.d, i: i });
      });
    });
    return pts.sort(function (a, b) { return a.key - b.key || a.i - b.i; }).map(function (x) { return x.place; });
  }
  // A curve along the globe from a to b, so a long hop does not cut through the map.
  function arc(a, b) {
    var R = Math.PI / 180, la1 = a[1] * R, lo1 = a[0] * R, la2 = b[1] * R, lo2 = b[0] * R;
    var h = Math.pow(Math.sin((la2 - la1) / 2), 2) + Math.cos(la1) * Math.cos(la2) * Math.pow(Math.sin((lo2 - lo1) / 2), 2);
    var ang = 2 * Math.asin(Math.min(1, Math.sqrt(h))), n = Math.max(1, Math.ceil(ang / (2 * R))), out = [];
    for (var i = 0; i <= n; i++) {
      var f = i / n;
      if (ang < 1e-9) { out.push(i ? b : a); continue; }
      var A = Math.sin((1 - f) * ang) / Math.sin(ang), B = Math.sin(f * ang) / Math.sin(ang);
      var x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
      var yy = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
      var z = A * Math.sin(la1) + B * Math.sin(la2);
      out.push([Math.atan2(yy, x) / R, Math.atan2(z, Math.sqrt(x * x + yy * yy)) / R]);
    }
    return out;
  }
  function pathLine(places) {
    var line = [];
    for (var i = 1; i < places.length; i++) {
      arc([places[i - 1].lon, places[i - 1].lat], [places[i].lon, places[i].lat]).forEach(function (pt, k) {
        if (i > 1 && k === 0) return;
        if (line.length) {                         // keep going the short way round the globe
          var prev = line[line.length - 1][0];
          while (pt[0] - prev > 180) pt = [pt[0] - 360, pt[1]];
          while (pt[0] - prev < -180) pt = [pt[0] + 360, pt[1]];
        }
        line.push(pt);
      });
    }
    return line;
  }

  // Work out which years there are, and show or hide the bar.
  function setupTime() {
    var min = Infinity, max = -Infinity;
    PLACES.concat(TRIPS).forEach(function (x) {
      datesOf(x).forEach(function (d) { min = Math.min(min, d.y); max = Math.max(max, d.to === null ? d.y : d.to); });
    });
    TIME = { min: min, max: max, any: min <= max };
    $('timebar').hidden = !TIME.any;
    if (!TIME.any) { year = null; return; }
    var range = $('time-range');
    range.min = min; range.max = max;
    if (year !== null) year = Math.max(min, Math.min(max, year));
    range.value = year === null ? max : year;
    $('time-min').textContent = min;
    $('time-max').textContent = max;
  }
  function paintTime() {
    if (!$('timebar')) return;          // an older copy of the page without the bar
    setupTime();
    var W = WORDS[lang], box = $('time-path'), all = year === null;
    $('time-all').setAttribute('aria-pressed', String(all));
    $('timebar').classList.toggle('is-all', all);
    $('time-year').textContent = all ? W.allYears : String(year);
    $('time-prev').disabled = !all && year <= TIME.min;
    $('time-next').disabled = !all && year >= TIME.max;
    box.textContent = '';
    if (all || !TIME.any) { $('time-count').textContent = ''; applyYear(); return; }
    var path = pathOf(year), shown = PLACES.filter(function (p) { return inYear(p, year); });
    $('time-count').textContent = W.places(shown.length);
    if (!shown.length && !TRIPS.some(function (t) { return inYear(t, year); })) box.textContent = W.noneThatYear;
    path.forEach(function (p, i) {
      if (i) box.appendChild(document.createTextNode(' → '));
      var b = el('button', null, (lang === 'zh' && p.local) || p.name);
      b.type = 'button';
      b.setAttribute('data-place', p.id);
      box.appendChild(b);
    });
    applyYear();
  }
  // Put the chosen year on the globe: its pins, its road trips, its line.
  function applyYear() {
    document.querySelectorAll('.pin[data-place]').forEach(function (pin) {
      var p = byId(pin.getAttribute('data-place'));
      pin.classList.toggle('out', year !== null && !!p && !inYear(p, year));
    });
    if (!map || !mapReady) return;
    var path = year === null ? [] : pathOf(year);
    var data = { type: 'FeatureCollection', features: path.length > 1 ?
      [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pathLine(path) } }] : [] };
    if (map.getSource('year-path')) map.getSource('year-path').setData(data);
    else {
      map.addSource('year-path', { type: 'geojson', data: data });
      var labels = (map.getStyle().layers.filter(function (l) { return l.type === 'symbol'; })[0] || {}).id;
      var round = { 'line-cap': 'round', 'line-join': 'round' };
      map.addLayer({ id: 'year-path-edge', type: 'line', source: 'year-path', layout: round,
        paint: { 'line-color': '#FFFFFF', 'line-width': 4.5, 'line-opacity': 0.9 } }, labels);
      map.addLayer({ id: 'year-path', type: 'line', source: 'year-path', layout: round,
        paint: { 'line-color': C.path, 'line-width': 2, 'line-dasharray': [0.2, 2] } }, labels);
    }
    if (map.getLayer('trip-line')) {             // only the road trips of that year
      var ids = TRIPS.filter(function (t) { return year === null || inYear(t, year); }).map(function (t) { return t.id; });
      var only = year === null ? null : ['in', ['get', 'id'], ['literal', ids]];
      ['trip-edge', 'trip-line', 'trip-stops', 'trip-hit'].forEach(function (id) { map.setFilter(id, only); });
    }
  }
  // Turn the globe so the whole year is in view.
  function showYear() {
    if (!map || !mapReady || year === null) return;
    var pts = PLACES.filter(function (p) { return inYear(p, year); });
    TRIPS.forEach(function (t) { if (inYear(t, year)) pts = pts.concat(t.stops); });
    if (!pts.length) return;
    var lons = pts.map(function (p) { return p.lon; }).sort(function (a, b) { return a - b; });
    var gap = lons[0] + 360 - lons[lons.length - 1], west = lons[0];      // the widest empty stretch of longitude
    for (var i = 1; i < lons.length; i++) if (lons[i] - lons[i - 1] > gap) { gap = lons[i] - lons[i - 1]; west = lons[i]; }
    var span = 360 - gap, s = 90, n = -90;
    pts.forEach(function (p) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); });
    var slow = reduceMotion ? 0 : 1400;
    if (span > 120) map.easeTo({ center: [west + span / 2, (s + n) / 2], zoom: WORLD_ZOOM, duration: slow, essential: true });
    else if (pts.length === 1) map.easeTo({ center: [pts[0].lon, pts[0].lat], zoom: 4, duration: slow, essential: true });
    else map.fitBounds([[west, s], [west + span, n]], { padding: 56, maxZoom: 6, duration: slow, essential: true });
  }
  function setYear(y, quiet) {
    year = y;
    paintTime();
    if (!quiet) {
      if (year === null && map && mapReady) map.easeTo({ zoom: WORLD_ZOOM, duration: reduceMotion ? 0 : 900, essential: true });
      else showYear();
    }
  }
  if ($('timebar')) {
  $('time-range').addEventListener('input', function () { setYear(+this.value); });
  $('time-all').addEventListener('click', function () { setYear(null); });
  $('time-prev').addEventListener('click', function () { setYear(year === null ? TIME.max : Math.max(TIME.min, year - 1)); });
  $('time-next').addEventListener('click', function () { setYear(year === null ? TIME.min : Math.min(TIME.max, year + 1)); });
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
      b.appendChild(el('small', null, t.stops.map(stopName).join(' \u2192 ') + (when ? '  ·  ' + when : '')));
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
    paintTime();
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
    if (year !== null && !inYear(p, year)) setYear(null, true);   // a place outside the year on the bar: back to every year
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
      applyYear();

      map.on('error', function () {});   // a missing tile should not surface as a page error
      map.once('load', function () {
        mapReady = true;
        drawTrips();
        if (trip) selectTrip(trip.id, { instant: true, hash: false });
        else if (year !== null) showYear();      // a year was picked while the map was still loading
        var lived = PLACES.filter(function (p) { return p.kind === 'lived'; }).length;
        note.textContent = lived + ' lived, ' + (PLACES.length - lived) + ' visited.';
      });

      // Arriving by a link to one place opens zoomed in on it; otherwise start on the whole globe.
      if (selected) select(selected.id, { zoomIn: startedFromLink, instant: true, hash: false });
    })
    .catch(function () { fail('The map could not load, but the lists below still work.'); });
})();
