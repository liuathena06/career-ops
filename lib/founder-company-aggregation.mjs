/** Founder display only: preserve individual ranking, then limit repeated companies. */
export function aggregateRankedCompanies({ ranked, cardsByJobId, topN = 10 }) {
  const groups = new Map();
  for (const [index, item] of ranked.entries()) {
    const card = cardsByJobId.get(item.jobId);
    if (!card) continue;
    const company = typeof card.company === 'string' ? card.company.trim() : '';
    const key = company ? company.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase('zh-CN') : `unknown:${item.jobId}`;
    if (!groups.has(key)) groups.set(key, { company: company || '公司未披露', rankPosition: index + 1, jobs: [], titles: new Set() });
    const group = groups.get(key);
    const titleKey = String(card.jobName ?? '').normalize('NFKC').replace(/[\s（）()·-]/gu, '').toLocaleLowerCase('zh-CN');
    if (group.jobs.length < 3 && !group.titles.has(titleKey)) {
      group.jobs.push({ ...card, rankPosition: index + 1, rankingConfidence: item.rankingConfidence });
      group.titles.add(titleKey);
    }
  }
  return [...groups.values()].slice(0, topN).map(({ titles, ...group }) => group);
}
