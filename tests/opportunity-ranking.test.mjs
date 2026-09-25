import test from 'node:test';
import assert from 'node:assert/strict';
import { rankOpportunities } from '../lib/opportunity-ranking.mjs';

function assessment(jobId, { direction = 'fit', capability = 'fit', scope = 'fit', compensation = 'fit', upside = 'present', unknowns = [] } = {}) {
  return {
    jobId,
    hardFilter: { outcome: 'pass' },
    shouldShow: true,
    dimensions: {
      careerDirection: { judgment: direction }, capabilityPlausibility: { judgment: capability },
      seniorityScope: { judgment: scope }, compensation: { judgment: compensation },
    },
    careerUpside: { status: upside },
    unknowns,
  };
}

test('ranking orders only showable opportunities and keeps the score internal', () => {
  const ranked = rankOpportunities([
    assessment('potential', { direction: 'strong_fit', upside: 'present', unknowns: ['薪资未披露'] }),
    assessment('clear', { direction: 'fit', upside: 'present' }),
  ]);
  assert.deepEqual(ranked.map((item) => item.jobId), ['potential', 'clear']);
  assert.equal(ranked[0].rankingConfidence, 'medium');
  assert.equal(ranked[1].rankingConfidence, 'high');
});

test('unknowns lower ranking confidence but do not remove a promising opportunity', () => {
  const [ranked] = rankOpportunities([assessment('unknown-rich', { unknowns: ['薪资未披露', '团队规模未知', '职责范围不清楚'] })]);
  assert.equal(ranked.rankingConfidence, 'low');
  assert.ok(ranked.rankingScore > 0);
});

test('filtered or non-showable opportunities cannot enter ranking', () => {
  assert.throws(() => rankOpportunities([{ ...assessment('filtered'), hardFilter: { outcome: 'filtered_out' }, shouldShow: false }]), /Only showable/);
  assert.throws(() => rankOpportunities([assessment('duplicate'), assessment('duplicate')]), /unique job ids/);
});
