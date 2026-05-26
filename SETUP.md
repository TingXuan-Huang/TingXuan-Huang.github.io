# Setup

Local build and deployment notes for the Jekyll blog source in this repo. The
rendered site lives at <https://tingxuan-huang.github.io/TingXuan-Huang/> (or
at the root `https://tingxuan-huang.github.io/` if the repo is later renamed to
`TingXuan-Huang.github.io`).

Two kinds of writing live here:

- **Essays** — personal and reflective (tagged `essay`, accented in clay).
- **Notes** — research-leaning and technical (tagged `note`, accented in sky blue).

## Install

Requires Ruby 3.x and Bundler. On macOS the system Ruby works, but a version
manager (`rbenv` or `asdf`) is recommended.

```bash
# 1. Install dependencies (first time only, and after any Gemfile change)
bundle install
```

## Run locally

```bash
bundle exec jekyll serve --livereload
```

Then open <http://localhost:4000/TingXuan-Huang/> (the trailing slash matters
because of the `baseurl` setting — see "Deploy" below).

`--livereload` rebuilds and refreshes the page whenever a source file changes.

To do a clean rebuild without the server:

```bash
bundle exec jekyll build
```

The built site lands in `_site/`.

## Write a new post

1. Create a new Markdown file in `_posts/` named `YYYY-MM-DD-slug.md`.
2. Use this frontmatter shape:

   ```yaml
   ---
   layout: post
   title: "On something that took a while to understand"
   date: 2026-05-26
   category: essay   # or "note"
   excerpt: "One or two sentences that show up on the homepage list."
   ---
   ```

3. Write the post body in plain Markdown below the frontmatter. Fenced code
   blocks, blockquotes, headings (`##`, `###`), and images all render with
   the site's typography.
4. The `category` field controls the colored tag and hover accent. Defaults
   to `essay` if omitted.

The post URL is `/<year>/<slug>/` (set by `permalink` in `_config.yml`).

## Update the "Now" line

The blue callout on the homepage comes from one line in `_config.yml`:

```yaml
now: "Running LAMMPS simulations with the UMA potential — and writing a long essay about Jingwei."
```

Edit that string, save, and the homepage updates on the next build (or
immediately with `--livereload`).

## Deploy

GitHub Pages builds Jekyll sites automatically — no GitHub Actions required.

1. Commit and push to the `main` branch of `TingXuan-Huang/TingXuan-Huang`.
2. In the repo's **Settings → Pages**, set **Source** to *Deploy from a branch*,
   and select `main` / `/ (root)`.
3. Wait ~1 minute for the first build. The live URL appears at the top of the
   Pages settings page.

### URL & `baseurl` notes

This repo is a **project page** (`TingXuan-Huang/TingXuan-Huang`), so the live
URL is `https://tingxuan-huang.github.io/TingXuan-Huang/`. The `baseurl: "/TingXuan-Huang"`
line in `_config.yml` makes all internal links work under that prefix.

If you want the cleaner root URL `https://tingxuan-huang.github.io/`:

1. Rename the repo to `TingXuan-Huang.github.io` (GitHub → Settings → General → Repository name).
2. In `_config.yml`, change:
   ```yaml
   url: "https://tingxuan-huang.github.io"
   baseurl: ""
   ```
3. Push. The site moves automatically.

## Project structure

```
.
├── _config.yml          # Site settings, tagline, "now" line, plugins
├── Gemfile              # Pinned to github-pages gem
├── index.md             # Homepage (uses _layouts/home.html)
├── about.md             # /about/ page (uses _layouts/page.html)
├── _layouts/
│   ├── default.html     # Page shell (header + content + footer)
│   ├── home.html        # Tagline + "Now" callout + post list
│   ├── post.html        # Single post (date, tag, title, body, back link)
│   └── page.html        # Plain markdown page (about)
├── _includes/
│   ├── head.html        # <head>: fonts, CSS, SEO, feed meta
│   ├── header.html      # Wordmark + nav
│   └── footer.html      # RSS · GitHub · year
├── _posts/              # Posts go here (YYYY-MM-DD-slug.md)
├── assets/
│   └── css/main.scss    # All styles. Design tokens at the top.
└── README.md
```

## Design tokens

All colors and fonts are defined as CSS custom properties at the top of
`assets/css/main.scss`. Change them there and the whole site updates — no
hardcoded hex values live in component selectors.

| Token         | Use                              |
|---------------|----------------------------------|
| `--paper`     | Page background                  |
| `--ink`       | Body text, post titles           |
| `--ink-soft`  | Tagline                          |
| `--muted`     | Dates, meta, nav links           |
| `--divider`   | Hairline rules between posts     |
| `--sky`       | Note accent + blockquote border  |
| `--sky-dark`  | Note tag text, links, inline code |
| `--sky-wash`  | Code-block / blockquote / Now bg |
| `--clay`      | Essay tag + essay hover accent   |
| `--excerpt`   | Homepage post-list excerpt text  |
