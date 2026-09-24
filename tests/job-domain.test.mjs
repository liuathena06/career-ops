import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JobCompleteness,
  createDiscoveryJob,
  enrichFromManualPaste,
  getEvaluationEligibility,
  promoteToEvaluatable,
  removeJobDetails,
  evaluateRecruiterGrade,
} from '../lib/job-domain.mjs';

const substantiveJd = `
岗位职责：
1. 负责 AI 产品从问题定义、方案设计到上线迭代的完整生命周期，并与研发、业务和客户团队协作。
2. 基于客户场景梳理需求、设计指标、跟踪效果，持续推动产品交付和业务价值闭环。
3. 沉淀可复用的方法论、流程和产品能力，识别风险并及时推动跨团队决策。

任职要求：
1. 具备五年以上产品、解决方案或相关工作经验，能够独立处理复杂、模糊的业务问题。
2. 了解大模型、数据产品或企业软件的实际落地路径，具备清晰的沟通、分析和项目推进能力。
3. 能够与不同职能的利益相关方协作，对业务结果和用户价值保持长期责任感。
`;

function discovery(overrides = {}) {
  return createDiscoveryJob({
    id: 'local-job-1',
    source: { kind: 'liepin', externalId: '123', url: 'https://example.invalid/job/123' },
    listing: {
      title: 'AI 产品经理',
      companyName: '示例公司',
      location: '上海',
      salary: '30-50k',
    },
    ...overrides,
  });
}

function enrich(job, overrides = {}) {
  return enrichFromManualPaste(job, {
    jobId: job.id,
    description: substantiveJd,
    capturedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  });
}

test('discovery_only Job is rejected before recruiter-grade evaluation', () => {
  const result = evaluateRecruiterGrade(discovery(), () => ({ score: 5 }));
  assert.equal(result.accepted, false);
  assert.deepEqual(result.reasons, ['JOB_NOT_EVALUATABLE_STATE', 'JD_MISSING']);
});

test('manual JD paste creates detail_enriched without promoting it', () => {
  const result = enrich(discovery());
  assert.equal(result.merged, true);
  assert.equal(result.job.completeness, JobCompleteness.DETAIL_ENRICHED);
  assert.equal(result.job.details.detailSource, 'manual_paste');
});

test('a JD that passes preflight promotes detail_enriched Job to evaluatable', () => {
  const enriched = enrich(discovery()).job;
  const promoted = promoteToEvaluatable(enriched);
  assert.equal(promoted.eligibility.eligible, true);
  assert.equal(promoted.job.completeness, JobCompleteness.EVALUATABLE);
});

test('short or title-only JD cannot become evaluatable', () => {
  const short = enrich(discovery(), { description: 'AI 产品经理' }).job;
  const promoted = promoteToEvaluatable(short);
  assert.equal(promoted.eligibility.eligible, false);
  assert.equal(promoted.job.completeness, JobCompleteness.DETAIL_ENRICHED);
  assert.ok(promoted.eligibility.reasons.includes('JD_TOO_SHORT'));
});

test('an explicit title conflict between Job and JD keeps eligibility false', () => {
  const enriched = enrich(discovery(), { observed: { title: '销售总监' } }).job;
  const eligibility = getEvaluationEligibility(enriched);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('DETAIL_TITLE_CONFLICT'));
});

test('removing JD downgrades an evaluatable Job back to discovery_only', () => {
  const evaluatable = promoteToEvaluatable(enrich(discovery()).job).job;
  const downgraded = removeJobDetails(evaluatable);
  assert.equal(downgraded.completeness, JobCompleteness.DISCOVERY_ONLY);
  assert.equal(downgraded.details, null);
});

test('manual JD never overwrites source listing fields', () => {
  const job = discovery();
  const enriched = enrich(job, { observed: { title: '不同标题', companyName: '另一家公司' } }).job;
  assert.equal(enriched.listing.title, 'AI 产品经理');
  assert.equal(enriched.listing.companyName, '示例公司');
  assert.equal(enriched.details.observed.title, '不同标题');
});

test('unreliable Job binding does not auto-merge manual JD', () => {
  const job = discovery();
  const result = enrichFromManualPaste(job, {
    jobId: 'other-local-job',
    description: substantiveJd,
  });
  assert.equal(result.merged, false);
  assert.equal(result.reason, 'JOB_BINDING_MISMATCH');
  assert.equal(result.job.completeness, JobCompleteness.DISCOVERY_ONLY);
  assert.equal(result.job.details, null);
});

test('Evaluation Engine returns a clear rejection for non-evaluatable Job', () => {
  const enriched = enrich(discovery()).job;
  const result = evaluateRecruiterGrade(enriched, () => ({ score: 5 }));
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('JOB_NOT_EVALUATABLE_STATE'));
  assert.deepEqual(result.result, null);
});

test('domain primitives are source-agnostic and never require a Liepin token or network', () => {
  const manual = createDiscoveryJob({
    id: 'manual-job-1',
    source: { kind: 'manual' },
    listing: { title: '产品经理' },
  });
  const ats = createDiscoveryJob({
    id: 'ats-job-1',
    source: { kind: 'ats', externalId: 'req-1' },
    listing: { title: '产品经理' },
  });
  assert.equal(enrich(manual).merged, true);
  assert.equal(enrich(ats).merged, true);
});
