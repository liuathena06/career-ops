import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRankedCompanies } from '../lib/founder-company-aggregation.mjs';

test('one company gets one card with at most three distinct representative roles', () => {
  const ranked = Array.from({ length: 8 }, (_, index) => ({ jobId: `job-${index}`, rankingScore: 100 - index, rankingConfidence: 'low' }));
  const cardsByJobId = new Map(ranked.map((item, index) => [item.jobId, {
    company: index < 7 ? (index === 1 ? '测试 公司' : '测试公司') : '第二家公司',
    jobName: index < 2 ? '云计算销售' : `职位${index}`,
  }]));
  const before = structuredClone(ranked);
  const groups = aggregateRankedCompanies({ ranked, cardsByJobId, topN: 2 });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].jobs.length, 3);
  assert.equal(groups[1].company, '第二家公司');
  assert.deepEqual(ranked, before);
});
