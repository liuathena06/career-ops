/** Normalize user-confirmed city inputs before search and location checks. */
const CITY_SEPARATOR = /\r?\n|[，,、/／;；]|(?<=\p{Script=Han})\s+(?=\p{Script=Han})/u;
const MUNICIPALITIES = new Set(['北京', '上海', '天津', '重庆']);

export function normalizeLocations(input) {
  const values = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const cities = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const part of value.split(CITY_SEPARATOR)) {
      let city = part.trim().replace(/\s+/gu, ' ');
      if (city.endsWith('市') && MUNICIPALITIES.has(city.slice(0, -1))) city = city.slice(0, -1);
      if (!city || seen.has(city.toLocaleLowerCase('zh-CN'))) continue;
      seen.add(city.toLocaleLowerCase('zh-CN'));
      cities.push(city);
    }
  }
  return cities;
}
