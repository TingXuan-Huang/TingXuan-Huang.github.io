# Archived posts

This folder holds posts that have been removed from the public site but
kept in the repo for reference — for example, older versions that have
been superseded by a rewrite, drafts of pieces that may come back, or
sample / seed content that's no longer relevant.

## How it works

- Files here are normal Jekyll post Markdown files (frontmatter + body).
- The `_archived/` folder is in the `exclude:` list in `_config.yml`,
  so Jekyll skips it entirely — nothing here renders on the site,
  appears in the RSS feed, shows up on filter pages, or is included
  in the search index.
- Git still tracks the files, so the content is preserved and can be
  searched / diffed via normal git operations.

## Workflow

**To archive a post**: move it from `_posts/` to `_archived/`.

```bash
mv _posts/2026-05-12-on-jingwei.md _archived/
```

**To unarchive a post**: move it back to `_posts/`. If you want it to
appear as "recent" on the homepage, also bump the date in the
frontmatter.

```bash
mv _archived/2026-05-12-on-jingwei.md _posts/
# then optionally edit frontmatter: date: 2026-06-01
```

That's the whole convention. No special tooling, no rebuild required
beyond the normal `bundle exec jekyll serve` / `git push` cycle.
