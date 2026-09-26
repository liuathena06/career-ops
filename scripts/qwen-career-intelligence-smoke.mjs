#!/usr/bin/env node
/** Synthetic-only Bailian smoke test. It never sends a real resume or interview. */
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { analyzeCareerIntelligence } from '../lib/career-intelligence-analyzer.mjs';
import { createBailianQwenCareerIntelligenceAnalyzer, isBailianQwenConfigured } from '../lib/bailian-qwen-career-intelligence.mjs';

if (!isBailianQwenConfigured()) {
  console.log('Qwen smoke test: NOT RUN (DASHSCOPE_API_KEY is not configured)');
  process.exit(0);
}
const answers = {
  'career-context-v0': { raw: 'Synthetic motivation for a test only.' },
  'career-direction-v0': { raw: 'Synthetic direction.', searchRole: '产品经理' },
  'career-priorities-v0': { raw: '成长空间' },
  'career-constraints-v0': { raw: '上海。', locations: '上海' },
  'career-capabilities-v0': { raw: 'Synthetic product delivery evidence.' },
  'career-differentiation-v0': { raw: 'Synthetic differentiator.' },
  'career-compensation-v0': { raw: '暂不设定。' },
  'career-risk-tradeoffs-v0': { raw: '可以接受不确定性。' },
};
try {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'qwen-smoke', now: '2026-09-26T00:00:00.000Z' });
  const result = await analyzeCareerIntelligence({ analyzer: createBailianQwenCareerIntelligenceAnalyzer(), interview, profile });
  if (result.usedFallback || !result.intelligence.careerThesis?.text) throw new Error('structured intelligence result was unavailable');
  console.log('Qwen smoke test: PASS (structured response validated)');
} catch {
  console.error('Qwen smoke test: FAIL');
  process.exitCode = 1;
}
