import test from 'node:test';
import assert from 'node:assert/strict';
import { liepinSearchArgs, liepinSearchCards } from '../lib/founder-liepin-search.mjs';

test('Founder UI only builds a read-only first-page Liepin search command', () => {
  assert.deepEqual(liepinSearchArgs({ jobName: '产品经理', location: '上海' }), [
    'job', 'search', '--job-name', '产品经理', '--address', '上海', '--page', '0', '--output', 'json',
  ]);
  assert.throws(() => liepinSearchArgs({ jobName: '' }), /Job Name is invalid/);
});

test('Founder UI selects only the agreed search-card fields', () => {
  const [card] = liepinSearchCards({ data: { list: [{ jobId: 1, jobName: '产品经理', company: '示例公司', location: '上海', salary: '30-50k', education: '本科', workYears: '5年以上', industry: '互联网', financingStage: 'B轮', companySize: '100-499人', companyLogo: 'ignored', jobDetailUrl: 'https://example.invalid/job' }] } });
  assert.deepEqual(card, { jobId: '1', jobName: '产品经理', company: '示例公司', location: '上海', salary: '30-50k', education: '本科', workYears: '5年以上', industry: '互联网', financingStage: 'B轮', companySize: '100-499人', jobDetailUrl: 'https://example.invalid/job' });
  assert.equal(card.jobId, '1');
  assert.equal('companyLogo' in card, false);
});
