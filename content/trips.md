<!--
HOW TO WRITE HERE

One "# Trip name" heading per road trip (add "| 中文名" for a Chinese name),
then a "stops:" line with the places in order, separated by ">":

  stops: Seattle > Portland > Crater Lake @ 42.94, -122.11 > San Francisco

A stop spelled like a place on the travel map (a pin) is found by its name.
Any other stop needs its position after an "@": latitude, longitude. Right-
click a spot in Google Maps or Apple Maps to copy those two numbers.
A stop can carry a Chinese name after a "|", shown when the page is read in
Chinese:   Kangding | 康定 @ 30.05, 101.96

The page draws a light green line through the stops, in order. To make the
line follow the actual roads, run this after adding or changing a trip:

  python3 tools/trace_trips.py --write

It sends only the positions of that trip's stops to a public routing service
(router.project-osrm.org) and saves the road in trips.js. Until then, or when
no driving route exists, the stops are joined by straight lines.

Under the stops, "## English" and "## 中文" work as in stories.md:

  when:  when the trip was, e.g. 2024.7          (optional; a year in digits
         also puts the trip on the time bar above the globe)
  note:  one line on what the trip was           (optional)

then a blank line and the story of the trip. Save this file and reload the
travel page. The trip below is a made-up example ("example: yes" gives it
the Example badge): replace it with a real one.
-->

# G318: Chengdu to Lhasa | 318国道：成都到拉萨
stops: Chengdu > Ya'an | 雅安 @ 29.98, 103.00 > Luding | 泸定 @ 29.91, 102.23 > Kangding | 康定 @ 30.05, 101.96 > Litang | 理塘 @ 30.00, 100.27 > Batang | 巴塘 @ 30.00, 99.11 > Markam | 芒康 @ 29.68, 98.59 > Zogang | 左贡 @ 29.67, 97.84 > Baxoi | 八宿 @ 30.05, 96.92 > Rawu | 然乌 @ 29.50, 96.77 > Bomi | 波密 @ 29.86, 95.77 > Nyingchi | 林芝 @ 29.65, 94.36 > Lhasa | 拉萨 @ 29.65, 91.13

## English
when:
note: National Highway 318, the southern Sichuan–Tibet road, from the Sichuan basin up onto the plateau.

## 中文
when:
note: 318国道川藏南线，从成都平原一路开上高原。


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
