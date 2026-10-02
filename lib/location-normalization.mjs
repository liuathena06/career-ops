/** Normalize user-confirmed city inputs before search and location checks. */
const CITY_SEPARATOR = /\r?\n|[，,、/／;；]|(?<=\p{Script=Han})\s+(?=\p{Script=Han})/u;
const MUNICIPALITIES = new Set(['北京', '上海', '天津', '重庆']);
// Beijing Municipal Civil Affairs Bureau, 2026 administrative divisions:
// https://mzj.beijing.gov.cn/art/2026/7/16/art_9984_692516.html
// A complete municipality district set avoids two-district special cases.
const BEIJING_DISTRICTS = [
  '东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区',
  '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区',
];
const DISTRICT_PARENT = new Map(BEIJING_DISTRICTS.map((district) => [district, '北京']));

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

/** A missing or unrecognized card location is unknown, never a hard conflict. */
export function compareLocationToCities(acceptedInput, jobLocation) {
  const accepted = normalizeLocations(acceptedInput);
  const location = typeof jobLocation === 'string' ? jobLocation.normalize('NFKC').replace(/\s+/gu, '').trim() : '';
  if (!accepted.length || !location) return 'unknown';
  const parents = new Set();
  for (const city of MUNICIPALITIES) {
    if (location.includes(city)) parents.add(city);
  }
  for (const [district, parent] of DISTRICT_PARENT) {
    if (location.includes(district)) parents.add(parent);
  }
  // Other cities with an explicit 市 suffix retain the same parent comparison.
  for (const match of location.matchAll(/([\p{Script=Han}]{2,6}市)(?=[\p{Script=Han}·./／-]|$)/gu)) {
    const city = match[1];
    parents.add(MUNICIPALITIES.has(city.slice(0, -1)) ? city.slice(0, -1) : city);
  }
  if (parents.size === 0) {
    if (accepted.some((city) => location.includes(city))) return 'compatible';
    return 'unknown';
  }
  return accepted.some((city) => parents.has(city) || parents.has(city + '市')) ? 'compatible' : 'conflict';
}
