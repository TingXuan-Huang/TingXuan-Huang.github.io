/* Shared by the travel page and the food page: a small Markdown reader for
   the words written in stories.md and food.md, the English / 中文 choice, and
   matching a "# Heading" in those files to a place in places.js. */
window.Site = (function () {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- language ---------- */
  var lang = 'en';
  try { if (localStorage.getItem('travel-lang') === 'zh') lang = 'zh'; } catch (e) {}
  function getLang() { return lang; }
  function setLang(l) {
    lang = l === 'zh' ? 'zh' : 'en';
    try { localStorage.setItem('travel-lang', lang); } catch (e) {}
    return lang;
  }
  function isChineseHeading(text) { return /中文|chinese|^zh$/i.test(text.trim()); }
  function isEnglishHeading(text) { return /^(english|en|英文)$/i.test(text.trim()); }

  /* ---------- headings to places ---------- */
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  // "# Hangzhou 杭州" finds the place named Hangzhou (or with that id, or that Chinese name)
  function matchPlace(heading, places) {
    var n = norm(heading);
    for (var i = 0; i < places.length; i++) {
      var p = places[i];
      if (n && (norm(p.name) === n || norm(p.id) === n)) return p;
      if (p.local && heading.trim() === p.local) return p;
    }
    return null;
  }
  function stripComments(src) { return src.replace(/<!--[\s\S]*?-->/g, ''); }

  /* ---------- Markdown ---------- */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeUrl(u) { return /^(https?:|mailto:|#|\.{0,2}\/|[\w-][\w\-./%]*$)/i.test(u) ? u : '#'; }
  function inline(s) {
    return esc(s)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) { return '<img alt="' + alt + '" src="' + safeUrl(src) + '" loading="lazy">'; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) { return '<a href="' + safeUrl(u) + '">' + t + '</a>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  }
  var CJK = /[　-〿㐀-鿿＀-￯]/;
  // join the lines of a paragraph: a space between words, nothing between Chinese characters
  function joinLines(lines) {
    return lines.reduce(function (acc, l) {
      l = l.trim();
      if (!acc) return l;
      return acc + (CJK.test(acc.slice(-1)) && CJK.test(l.charAt(0)) ? '' : ' ') + l;
    }, '');
  }
  // Paragraphs, "### " small headings, "> " quotes, "- " lists and pictures.
  function render(box, text, textLang) {
    box.textContent = '';
    box.lang = textLang === 'zh' ? 'zh-Hans' : 'en';
    text.split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.trim(); });
      if (!lines.length) return;
      var m, node;
      if ((m = /^###[ \t]+(.+)$/.exec(lines[0]))) {
        node = el('h3'); node.innerHTML = inline(m[1]); box.appendChild(node);
        lines = lines.slice(1);
        if (!lines.length) return;
      }
      if (lines.every(function (l) { return /^\s*>/.test(l); })) {
        node = el('blockquote');
        node.innerHTML = inline(joinLines(lines.map(function (l) { return l.replace(/^\s*>\s?/, ''); })));
      } else if (lines.every(function (l) { return /^\s*[-*][ \t]+/.test(l); })) {
        node = el('ul');
        lines.forEach(function (l) { var li = el('li'); li.innerHTML = inline(l.replace(/^\s*[-*][ \t]+/, '')); node.appendChild(li); });
      } else {
        node = el('p'); node.innerHTML = inline(joinLines(lines));
        if (node.children.length === 1 && node.firstChild.tagName === 'IMG' && !node.textContent.trim()) {
          var fig = el('figure'), img = node.firstChild;
          fig.appendChild(img);
          if (img.alt) fig.appendChild(el('figcaption', null, img.alt));
          node = fig;
        }
      }
      box.appendChild(node);
    });
  }

  return {
    el: el, getLang: getLang, setLang: setLang,
    isChineseHeading: isChineseHeading, isEnglishHeading: isEnglishHeading,
    matchPlace: matchPlace, stripComments: stripComments,
    inline: inline, render: render
  };
})();
