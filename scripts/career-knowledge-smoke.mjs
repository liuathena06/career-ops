#!/usr/bin/env node
/** Real official occupations, synthetic candidate only; entirely offline. */
import assert from 'node:assert/strict';
import { isMainModule } from '../lib/is-main-module.mjs';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';

export function runCareerKnowledgeSmoke() {
  const { profile } = createFounderConfirmedProfile({
    id: 'synthetic-knowledge-smoke', now: '2026-09-28T00:00:00.000Z',
    answers: {
      'career-direction-v0': { raw: '合成测试方向，不属于真实候选人。', searchRole: '销售经理' },
      'career-constraints-v0': { raw: '合成测试地点。', locations: '上海' },
    },
  });
  const before = structuredClone(profile);
  const strategy = createOpportunitySearchStrategy({ profile, intelligence: { nextStageDirections: [
    { kind: 'direct', searchTitle: '销售经理', reason: '合成测试已确认方向。', needsConfirmation: false },
  ] } });
  const knowledge = strategy.knowledgeContext;
  assert.ok(knowledge.occupations.some((item) => item.id === 'onet:11-2022.00'));
  assert.ok(knowledge.occupations.some((item) => item.source.id === 'esco'));
  assert.ok(knowledge.relevantSkills.some((item) => item.relationship === 'essential'));
  assert.ok(knowledge.transferableSkills.some((item) => item.label === 'Negotiation'));
  assert.ok(knowledge.adjacentOccupations.some((item) => item.occupationId === 'onet:11-2021.00'));
  assert.ok(knowledge.proposedSearches.some((item) => item.jobName === '市场经理' && item.requiresConfirmation && !item.autoExecute));
  assert.ok(strategy.searches[0].knowledgeRefs.length > 0);
  assert.equal(strategy.searches.length, 1);
  assert.deepEqual(profile, before);
  assert.equal(knowledge.scoringUse, 'none');
  assert.ok(knowledge.relevantSkills.every((item) => item.candidateCapability === 'unknown' && item.jobRequirement === 'unknown'));
  return {
    status: 'PASS', candidate: 'synthetic', sourceData: 'official occupation snapshots',
    example: '销售经理 → O*NET Sales Managers + ESCO sales manager → Essential/Transferable Skills → Marketing Managers → 待核实搜索建议：市场经理',
    occupationReferences: knowledge.occupations.map((item) => item.id),
    skillReferences: knowledge.relevantSkills.length, taskReferences: knowledge.tasks.length,
    executedExternalSearches: 0, profileUnchanged: true, recommendationScoring: 'not_connected',
  };
}

if (isMainModule(import.meta.url)) {
  console.log(JSON.stringify(runCareerKnowledgeSmoke(), null, 2));
}
