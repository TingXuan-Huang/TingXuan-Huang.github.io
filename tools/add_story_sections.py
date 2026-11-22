#!/usr/bin/env python3
"""Make sure stories.md has a section for every place in places.js.

    python3 tools/add_story_sections.py

Run it after adding places (by hand or with photos_to_places.py). It only ever
appends empty sections for places that have none; it never changes anything
you have written.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
PLACES = os.path.join(DEMO, 'places.js')
STORIES = os.path.join(DEMO, 'content', 'stories.md')

HEADER = '''<!--
HOW TO WRITE HERE

Each place has a heading (# Name) and two parts: "## English" and "## 中文".
Under each part:

  when:  when you were there, e.g. 2015 - 2019, or Spring 2019     (optional)
  note:  one line on what the place is to you                      (optional)

then a blank line, then your story. Leave a blank line between paragraphs.

You can also use **bold**, *italic*, [a link](https://example.com),
"> " in front of a quote, "- " in front of list items, "### " in front of a
small heading, and ![caption](photos/file.jpg) for a picture.

A province or state (Gansu, Yunnan, ...) is one section. Inside its story,
start each city you went to with a "### City 城市" title: those titles are
listed beside the province on the page, and each one opens its part of the
story.

Photos: tools/make_album.py adds a "## Photos" list under a place, one line
per photo. Write a caption after the colon, and a Chinese one after a "|":
    west-lake.jpg: Dusk over West Lake | 西湖的黄昏
A caption of "-" hides that photo. To put a picture inside a story, use
![caption](photos/hangzhou-cn/west-lake.jpg) on a line of its own.

Save this file and reload the travel page: the page reads this file directly.
Anything you leave empty is simply skipped, and if only one language is
written the page shows that one. Don't change the "# Name" headings: that is
how a story finds its pin.
-->
'''

SECTION = '''
# {title}

## English
when: {when}
note: {note}

{hint}{body}
## 中文
when:
note:

{hint}'''

HINT = '<!-- A whole province or state: start each city with a "### City 城市" title. -->\n\n'


def norm(text):
    """'St. Paul 圣保罗' -> 'stpaul': how headings are matched to places."""
    return re.sub(r'[^a-z0-9]', '', text.lower())


def load_places():
    with open(PLACES, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'window\.PLACES\s*=\s*(\[.*\])\s*;', src, re.S)
    if not m:
        sys.exit('Could not find "window.PLACES = [...]" in places.js')
    return json.loads(m.group(1))


def main():
    places = load_places()
    if os.path.exists(STORIES):
        with open(STORIES, encoding='utf-8') as f:
            text = f.read()
    else:
        text = HEADER
    have = {norm(h) for h in re.findall(r'^#[ \t]+(.+)$', text, re.M)}

    added = []
    for p in places:
        if p.get('example'):
            continue
        if norm(p['name']) in have or norm(p['id']) in have:
            continue
        title = p['name'] + (' ' + p['local'] if p.get('local') else '')
        body = '\n\n'.join(p.get('story') or [])
        text = text.rstrip('\n') + '\n' + SECTION.format(
            title=title, when=p.get('when') or '', note=p.get('note') or '',
            hint=HINT if p.get('level') == 'region' else '',
            body=body + '\n' if body else '')
        added.append(title)

    if added:
        with open(STORIES, 'w', encoding='utf-8') as f:
            text = re.sub(r'[ \t]+\n', '\n', text)
            text = re.sub(r'\n{3,}', '\n\n', text)
            text = re.sub(r'\n(# )', r'\n\n\1', text)      # a little air above each place
            f.write(text.rstrip('\n') + '\n')
        print('Added %d section(s) to stories.md: %s' % (len(added), ', '.join(added)))
    else:
        print('stories.md already has a section for every place.')


if __name__ == '__main__':
    main()
