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
travel page.
-->

# New England loop | 新英格兰环线
stops: Boston | 波士顿 @ 42.3601, -71.0589 > Plymouth | 普利茅斯 @ 41.9584, -70.6673 > Kennebunkport | 肯纳邦克港 @ 43.3615, -70.4767 > Portland Head Light | 波特兰灯塔 @ 43.6231, -70.2079 > Camden | 卡姆登 @ 44.2098, -69.0648 > Acadia | 阿卡迪亚 @ 44.3876, -68.2039 > Colby College | 科尔比学院 @ 44.5639, -69.6626 > North Conway | 北康威 @ 44.0537, -71.1284 > Kancamagus Pass | 坎卡马格斯山口 @ 44.0256, -71.4930 > Flume Gorge | 弗鲁姆峡谷 @ 44.0970, -71.6810 > Stowe | 斯托 @ 44.4654, -72.6874 > Smugglers' Notch | 走私者峡谷 @ 44.5564, -72.7940 > Concord, NH | 康科德 @ 43.2081, -71.5376 > Boston | 波士顿 @ 42.3601, -71.0589

## English
when: September 2026
note: A loop out of Boston: Plymouth, up the Maine coast to Acadia, inland to Colby, then New Hampshire, Vermont and back.

## 中文
when: 2026年9月
note: 从波士顿出发的一圈：普利茅斯，沿缅因海岸到阿卡迪亚，经科尔比到新罕布什尔和佛蒙特，再回波士顿。


# G318: Chengdu to Lhasa | 318国道：成都到拉萨
stops: Chengdu > Ya'an | 雅安 @ 29.98, 103.00 > Luding | 泸定 @ 29.91, 102.23 > Kangding | 康定 @ 30.05, 101.96 > Litang | 理塘 @ 30.00, 100.27 > Batang | 巴塘 @ 30.00, 99.11 > Markam | 芒康 @ 29.68, 98.59 > Zogang | 左贡 @ 29.67, 97.84 > Baxoi | 八宿 @ 30.05, 96.92 > Rawu | 然乌 @ 29.50, 96.77 > Bomi | 波密 @ 29.86, 95.77 > Nyingchi | 林芝 @ 29.65, 94.36 > Lhasa | 拉萨 @ 29.65, 91.13

## English
when:
note: National Highway 318, the southern Sichuan–Tibet road, from the Sichuan basin up onto the plateau.

## 中文
when:
note: 318国道川藏南线，从成都平原一路开上高原。
