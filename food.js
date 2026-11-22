/* Food page: restaurants worth going back to, grouped by city.

   The words come from food.md: a "# City" heading, then a "## Restaurant"
   heading for each place, a few optional "key: value" lines, and a few
   sentences on why it is good. The page reads that file directly. */
(function () {
  'use strict';
  var S = window.Site, el = S.el;
  var PLACES = window.PLACES || [];
  var $ = function (id) { return document.getElementById(id); };

  // the lines a restaurant can carry, with the other spellings that also work
  var FIELDS = {
    cuisine: 'cuisine', type: 'cuisine', '菜系': 'cuisine',
    price: 'price', '价格': 'price', '人均': 'price',
    order: 'order', 'try': 'order', must: 'order', '推荐': 'order', '必点': 'order',
    area: 'area', address: 'area', neighborhood: 'area', neighbourhood: 'area', '地区': 'area', '地址': 'area',
    link: 'link', website: 'link', map: 'link', '链接': 'link',
    example: 'example'
  };
  var WORDS = {
    en: { order: 'Order', link: 'Website or map', globe: 'See it on the globe', all: 'All',
          count: function (n) { return n + (n === 1 ? ' place' : ' places'); },
          empty: 'Nothing here yet.' },
    zh: { order: '推荐', link: '网站或地图', globe: '在地球上看', all: '全部',
          count: function (n) { return n + ' 家'; },
          empty: '这里还没有写。' }
  };

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'city';
  }

  function parse(src) {
    var cities = [], city = null, r = null, part = 'all';
    S.stripComments(src).split(/\r?\n/).forEach(function (line) {
      var m;
      if ((m = /^#[ \t]+(.+?)\s*$/.exec(line))) {
        var place = S.matchPlace(m[1], PLACES);
        city = { title: m[1], place: place, id: place ? place.id : slug(m[1]), list: [] };
        cities.push(city); r = null;
        return;
      }
      if ((m = /^##[ \t]+(.+?)\s*$/.exec(line))) {
        r = null;
        if (!city) return;
        r = { name: m[1], f: {}, text: { all: [], en: [], zh: [] }, head: true };
        part = 'all';
        city.list.push(r);
        return;
      }
      if (!r) return;
      if ((m = /^###[ \t]+(.+?)\s*$/.exec(line))) {       // "### English" / "### 中文" split the words
        if (S.isChineseHeading(m[1])) { part = 'zh'; r.head = false; return; }
        if (S.isEnglishHeading(m[1])) { part = 'en'; r.head = false; return; }
      }
      if (r.head) {                                         // the "key: value" lines come first
        if (!line.trim()) return;
        m = /^\s*([^\s:：]+)\s*[:：]\s*(.*)$/.exec(line);
        if (m && FIELDS[m[1].toLowerCase()]) { r.f[FIELDS[m[1].toLowerCase()]] = m[2].trim(); return; }
        r.head = false;
      }
      r.text[part].push(line);
    });
    cities.forEach(function (c) {
      c.list.forEach(function (x) {
        ['all', 'en', 'zh'].forEach(function (k) { x.text[k] = x.text[k].join('\n').trim(); });
        x.example = /^(yes|true|1)$/i.test(x.f.example || '');
      });
    });
    return cities.filter(function (c) { return c.list.length; });
  }

  // the words for a restaurant in the current language, else whatever is written
  function wordsFor(x, lang) {
    var other = lang === 'en' ? 'zh' : 'en';
    if (x.text[lang]) return { text: x.text[lang], lang: lang };
    if (x.text.all) return { text: x.text.all, lang: lang };
    if (x.text[other]) return { text: x.text[other], lang: other };
    return null;
  }

  function cityName(c, into) {
    if (c.place) {
      into.appendChild(document.createTextNode(c.place.name));
      if (c.place.local) { var z = el('span', 'local', c.place.local); z.lang = 'zh-Hans'; into.appendChild(z); }
    } else into.appendChild(document.createTextNode(c.title));
  }

  var cities = [], filter = 'all';

  function card(x, lang) {
    var W = WORDS[lang];
    var a = el('article', 'tile card eat');
    var meta = [x.f.cuisine, x.f.price, x.f.area].filter(Boolean).join(' · ');
    if (meta) a.appendChild(el('p', 'label accent', meta));
    var h = el('h3', null, x.name);
    if (x.example) h.appendChild(el('span', 'badge', 'Example'));
    a.appendChild(h);
    var w = wordsFor(x, lang);
    if (w) { var body = el('div', 'text'); S.render(body, w.text, w.lang); a.appendChild(body); }
    if (x.f.order) {
      var o = el('p', 'order');
      o.appendChild(el('span', 'label', W.order));
      o.appendChild(document.createTextNode(x.f.order));
      a.appendChild(o);
    }
    if (x.f.link && /^https?:\/\//i.test(x.f.link)) {
      var links = el('p', 'links'), l = el('a', null, W.link);
      l.href = x.f.link; l.rel = 'noopener';
      links.appendChild(l);
      a.appendChild(links);
    }
    return a;
  }

  function paint() {
    var lang = S.getLang(), W = WORDS[lang];
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });

    var chips = $('food-filter');
    chips.textContent = '';
    chips.hidden = cities.length < 2;
    [{ id: 'all' }].concat(cities).forEach(function (c) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('data-city', c.id);
      b.setAttribute('aria-pressed', String(filter === c.id));
      if (c.id === 'all') b.textContent = W.all; else cityName(c, b);
      chips.appendChild(b);
    });

    var box = $('food-list');
    box.textContent = '';
    var shown = cities.filter(function (c) { return filter === 'all' || filter === c.id; });
    if (!shown.length) { box.appendChild(el('p', 'empty', W.empty)); return; }
    shown.forEach(function (c) {
      var sec = el('section', 'food-city');
      sec.id = c.id;
      var head = el('div', 'food-head');
      var h = el('h2');
      cityName(c, h);
      head.appendChild(h);
      var side = el('p', 'food-side');
      side.appendChild(el('span', null, W.count(c.list.length)));
      if (c.place) {
        var g = el('a', null, W.globe + ' →');
        g.href = 'travel.html#' + c.place.id;
        side.appendChild(g);
      }
      head.appendChild(side);
      sec.appendChild(head);
      var grid = el('div', 'cards');
      c.list.forEach(function (x) { grid.appendChild(card(x, lang)); });
      sec.appendChild(grid);
      box.appendChild(sec);
    });
    $('food-note').hidden = !cities.some(function (c) { return c.list.some(function (x) { return x.example; }); });
  }

  document.addEventListener('click', function (e) {
    var l = e.target.closest('[data-lang]');
    if (l) { S.setLang(l.getAttribute('data-lang')); paint(); return; }
    var c = e.target.closest('[data-city]');
    if (c) {
      filter = c.getAttribute('data-city');
      try { history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + filter); } catch (err) {}
      paint();
    }
  });

  // "no-cache" so an edit to food.md shows on the next reload
  fetch('content/food.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('food ' + r.status); return r.text(); })
    .then(function (src) {
      cities = parse(src);
      var want = location.hash.slice(1);          // food.html#hangzhou-cn opens on that city
      if (cities.some(function (c) { return c.id === want; })) filter = want;
      paint();
    })
    .catch(function () { paint(); });
})();
