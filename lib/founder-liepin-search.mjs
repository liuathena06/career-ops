/** Pure helpers for the local-only Founder Liepin test page. */

const MAX_INPUT_LENGTH = 80;

function cleanText(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > MAX_INPUT_LENGTH || /[\u0000-\u001f\u007f]/u.test(cleaned)) {
    throw new Error(`${label} is invalid`);
  }
  return cleaned;
}

/** Build only the documented, read-only Liepin search command arguments. */
export function liepinSearchArgs({ jobName, location }) {
  const args = ['job', 'search', '--job-name', cleanText(jobName, 'Job Name')];
  if (typeof location === 'string' && location.trim()) args.push('--address', cleanText(location, 'Location'));
  return [...args, '--page', '0', '--output', 'json'];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Select only the search-card fields that the Founder UI is allowed to show. */
export function liepinSearchCards(payload) {
  const list = payload?.data?.list;
  if (!Array.isArray(list)) throw new Error('Liepin response did not contain data.list');
  return list.map((job) => ({
    jobName: text(job?.jobName),
    company: text(job?.company),
    location: text(job?.location),
    salary: text(job?.salary),
    education: text(job?.education),
    workYears: text(job?.workYears),
    industry: text(job?.industry),
    financingStage: text(job?.financingStage),
    companySize: text(job?.companySize),
    jobDetailUrl: text(job?.jobDetailUrl),
  }));
}
