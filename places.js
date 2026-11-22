/* The places on the travel page.

   Edit this file by hand, or let tools/photos_to_places.py add places from
   your photo folders. The part after "window.PLACES =" must stay valid JSON
   (double quotes, no trailing commas) so the tool can read it back.

   local   optional: the name in the local language, shown beside the name
   level   "region" when the pin is a whole province or state, not a city
   kind    "lived" (peach pin) or "visited" (white pin)
   when    shown in the story card, e.g. "2023 - now" or "April 2025"
   year    optional: the year of the trip (visited places are listed by country,
           the last part of "region")
   when, note, story
           the words for a place now live in stories.md (English and 中文).
           Anything left here is only used when stories.md has nothing.
   zoom    optional: how close the map goes when the place is selected
   photos  filled in by the tool: how many photos were taken there
   auto    true while an entry is exactly as the tool wrote it
   example true for made-up sample entries */
window.PLACES = [
  {
    "id": "renshou",
    "name": "Renshou",
    "local": "仁寿",
    "region": "Sichuan, China",
    "lon": 104.15,
    "lat": 29.996,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "wuhan",
    "name": "Wuhan",
    "local": "武汉",
    "region": "Hubei, China",
    "lon": 114.27,
    "lat": 30.58,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "chongqing",
    "name": "Chongqing",
    "local": "重庆",
    "region": "China",
    "lon": 106.56,
    "lat": 29.56,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "saint-paul",
    "name": "St. Paul",
    "region": "Minnesota, United States",
    "lon": -93.09,
    "lat": 44.94,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "eagan",
    "name": "Eagan",
    "region": "Minnesota, United States",
    "lon": -93.17,
    "lat": 44.8,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "seattle",
    "name": "Seattle",
    "region": "Washington, United States",
    "lon": -122.33,
    "lat": 47.61,
    "kind": "lived",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "hangzhou-cn",
    "name": "Hangzhou",
    "local": "杭州",
    "region": "Zhejiang, China",
    "lon": 120.16,
    "lat": 30.29,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "beijing-cn",
    "name": "Beijing",
    "local": "北京",
    "region": "China",
    "lon": 116.4,
    "lat": 39.91,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "shanghai-cn",
    "name": "Shanghai",
    "local": "上海",
    "region": "China",
    "lon": 121.46,
    "lat": 31.22,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "guangzhou-cn",
    "name": "Guangzhou",
    "local": "广州",
    "region": "Guangdong, China",
    "lon": 113.25,
    "lat": 23.12,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "hong-kong-hk",
    "name": "Hong Kong",
    "local": "香港",
    "region": "Hong Kong SAR, China",
    "lon": 114.17,
    "lat": 22.28,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 9.5
  },
  {
    "id": "chengdu-cn",
    "name": "Chengdu",
    "local": "成都",
    "region": "Sichuan, China",
    "lon": 104.07,
    "lat": 30.67,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "xiamen-cn",
    "name": "Xiamen",
    "local": "厦门",
    "region": "Fujian, China",
    "lon": 118.08,
    "lat": 24.48,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 9.5
  },
  {
    "id": "fuzhou-cn",
    "name": "Fuzhou",
    "local": "福州",
    "region": "Fujian, China",
    "lon": 119.31,
    "lat": 26.06,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "xining-cn",
    "name": "Xining",
    "local": "西宁",
    "region": "Qinghai, China",
    "lon": 101.76,
    "lat": 36.63,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "gansu-cn",
    "name": "Gansu",
    "local": "甘肃",
    "region": "China",
    "level": "region",
    "lon": 102.0,
    "lat": 38.0,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 4.8
  },
  {
    "id": "tibet-cn",
    "name": "Tibet",
    "local": "西藏",
    "region": "China",
    "level": "region",
    "lon": 88.0,
    "lat": 31.7,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 4.4
  },
  {
    "id": "hunan-cn",
    "name": "Hunan",
    "local": "湖南",
    "region": "China",
    "level": "region",
    "lon": 111.7,
    "lat": 27.6,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 5.8
  },
  {
    "id": "yunnan-cn",
    "name": "Yunnan",
    "local": "云南",
    "region": "China",
    "level": "region",
    "lon": 101.5,
    "lat": 25.0,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 5.4
  },
  {
    "id": "macau-mo",
    "name": "Macau",
    "local": "澳门",
    "region": "Macau SAR, China",
    "lon": 113.55,
    "lat": 22.2,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 10.5
  },
  {
    "id": "nanjing-cn",
    "name": "Nanjing",
    "local": "南京",
    "region": "Jiangsu, China",
    "lon": 118.78,
    "lat": 32.06,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  },
  {
    "id": "sabah-my",
    "name": "Sabah",
    "region": "Malaysia",
    "level": "region",
    "lon": 117.0,
    "lat": 5.5,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": [],
    "zoom": 6.4
  },
  {
    "id": "tokyo-jp",
    "name": "Tokyo",
    "region": "Japan",
    "lon": 139.69,
    "lat": 35.69,
    "kind": "visited",
    "when": "",
    "note": "",
    "story": []
  }
];
