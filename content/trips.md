<!--
HOW TO WRITE HERE

One "# Trip name" heading per road trip (add "| 中文名" for a Chinese name),
then a "stops:" line with the places in order, separated by ">":

  stops: Seattle > Portland > Crater Lake @ 42.94, -122.11 > San Francisco

A stop spelled like a place on the travel map (a pin) is found by its name.
Any other stop needs its position after an "@": latitude, longitude. Right-
click a spot in Google Maps or Apple Maps to copy those two numbers.

The page draws a light green line through the stops, in order. To make the
line follow the actual roads, run this after adding or changing a trip:

  python3 tools/trace_trips.py --write

It sends only the positions of that trip's stops to a public routing service
(router.project-osrm.org) and saves the road in trips.js. Until then, or when
no driving route exists, the stops are joined by straight lines.

Under the stops, "## English" and "## 中文" work as in stories.md:

  when:  when the trip was                       (optional)
  note:  one line on what the trip was           (optional)

then a blank line and the story of the trip. Save this file and reload the
travel page. The trip below is a made-up example ("example: yes" gives it
the Example badge): replace it with a real one.
-->

# Example: down the Yangtze | 示例：沿长江而下
example: yes
stops: Chengdu > Chongqing > Three Gorges @ 30.82, 111.00 > Wuhan > Nanjing > Hangzhou

## English
when: Example dates
note: A made-up trip that joins six stops, to show what a route looks like.

Write the story of the trip here: who came, what the road was like, where
you would stop again.

## 中文
when: 示例时间
note: 这是一条示例路线，连接六个地点。

在这里写这趟旅行的故事。
