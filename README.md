# tingxuan-huang.github.io

My personal site: writing, research, travel and a bit about me.
Live at <https://tingxuan-huang.github.io/>. Pushing to `main` publishes it.

## Where things are

| To change | Edit |
|---|---|
| Front page | `index.html` |
| About page | `about.html` |
| Research page | `research.html` |
| Places on the map (pins) | `places.js` |
| Stories, dates and photo captions for each place (English and 中文) | `content/stories.md` |
| Restaurants | `content/food.md` |
| Road trips | `content/trips.md` |
| A new blog post | a new file in `_posts/` (see below) |
| Colours and layout | `site.css` |

The three files in `content/` explain their own format at the top. The pages
read them directly, so saving the file and pushing is all it takes.

## Writing a blog post

Add `_posts/YYYY-MM-DD-short-name.md`:

```markdown
---
title: "The title"
date: 2026-06-01
category: essay        # essay, note, learning, research, interest or news
topic: "optional"
excerpt: "One or two sentences shown in the list of posts."
---

The post, in Markdown.
```

It appears on the Writing page by itself. For a photo with a caption, put the
picture in `photos/` and add this where it should appear:

```liquid
{% include figure.html src="/photos/west-lake.jpg" caption="Dusk over West Lake." %}
```

## Photos and tools

Originals stay outside this folder; the tools make small copies with the
location, date and camera data removed. They need macOS and Python 3.

```bash
# front-page and About photos: files named home.* and about.* in ../site-photos
python3 tools/make_album.py --pages ../site-photos --write

# a photo album for each place, from folders of trip photos
python3 tools/make_album.py ../travel-photos --write

# add places to the map from where photos were taken
python3 tools/photos_to_places.py ../travel-photos --write

# give new places an empty section in content/stories.md
python3 tools/add_story_sections.py

# make road-trip lines follow the real roads (sends only the stops' positions
# to the public routing service router.project-osrm.org)
python3 tools/trace_trips.py --write
```

Every tool only shows what it would do until `--write` is added
(`add_story_sections.py` writes straight away, and only ever appends).

## The old site

The previous design is kept, unpublished, in `_archived/old-site/`.
