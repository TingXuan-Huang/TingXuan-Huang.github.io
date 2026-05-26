(function () {
  'use strict';

  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');

  if (!input || !results || !status) return;

  let posts = [];
  let ready = false;

  status.textContent = 'Loading index…';

  fetch('/search.json', { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      posts = data;
      ready = true;
      status.textContent = '';
      render(posts, '');
    })
    .catch(err => {
      status.textContent = 'Could not load search index. ' + err.message;
    });

  input.addEventListener('input', e => {
    if (!ready) return;
    const q = e.target.value;
    render(filter(q), q);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      render(posts, '');
    }
  });

  function filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.excerpt || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  function render(matches, query) {
    if (matches.length === 0) {
      results.innerHTML = '';
      status.textContent = query ? 'No matches for "' + query + '".' : 'No posts.';
      return;
    }
    if (query) {
      status.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es') + ' for "' + query + '".';
    } else {
      status.textContent = matches.length + ' posts.';
    }
    results.innerHTML = matches.map(p => `
      <a class="post-entry post-entry--${escapeAttr(p.category)}" href="${escapeAttr(p.url)}">
        <div class="post-meta">
          <time class="post-date" datetime="${escapeAttr(p.date)}">${escapeHtml(p.date_fmt)}</time>
          <span class="post-tag">${escapeHtml(p.category)}</span>
        </div>
        <h2 class="post-title">${escapeHtml(p.title)}</h2>
        ${p.excerpt ? `<p class="post-excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
      </a>
    `).join('');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
})();
