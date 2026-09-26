const POSITIVE = new Set(['strong_fit', 'fit']);

function confirmed(entries) {
  return (entries ?? []).some((entry) => entry?.confirmed === true && entry.value !== '');
}

function countReason(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** A compact, privacy-safe account of each downstream Founder-flow stage. */
export function summarizeFounderFlow({ profile, intent, intents = intent ? [intent] : [], liepinResultCount, mappedJobs, skippedJobs, assessments, ranked }) {
  const hidden = assessments.filter((assessment) => !assessment.shouldShow);
  const reasons = new Map();
  for (const assessment of hidden) {
    if (assessment.hardFilter?.outcome === 'filtered_out') {
      countReason(reasons, 'hard constraint conflict');
      continue;
    }
    if (!POSITIVE.has(assessment.dimensions?.careerDirection?.judgment)) countReason(reasons, 'career direction weak');
    if (assessment.dimensions?.capabilityPlausibility?.judgment === 'unknown') countReason(reasons, 'capability unknown');
    if (assessment.careerUpside?.status !== 'present') countReason(reasons, 'no career upside evidence');
    if (assessment.dimensions?.compensation?.judgment === 'unknown') countReason(reasons, 'compensation unknown');
    if (assessment.dimensions?.capabilityPlausibility?.jobEvidence?.length === 0) countReason(reasons, 'insufficient job detail');
  }
  return {
    profile: {
      confirmed: profile?.status === 'confirmed',
      careerDirection: confirmed(profile?.stated?.careerDirection),
      location: confirmed(profile?.stated?.hardConstraints?.locations),
      capabilityEvidence: confirmed(profile?.stated?.capabilityEvidence),
      compensationMinimum: Boolean(profile?.stated?.hardConstraints?.compensation?.minimum?.confirmed),
    },
    searchCriteria: { jobName: intents.map((item) => item.jobName).filter(Boolean).join(' | '), location: intents[0]?.location ?? '', directionCount: intents.length, valid: intents.some((item) => Boolean(item?.jobName)) },
    liepinSearch: { called: true, resultCount: liepinResultCount },
    jobMapping: { mappedJobs, skippedJobs },
    opportunityAssessment: {
      assessedJobs: assessments.length,
      hardFiltered: assessments.filter((assessment) => assessment.hardFilter?.outcome === 'filtered_out').length,
      shouldShow: assessments.filter((assessment) => assessment.shouldShow).length,
      shouldHide: hidden.length,
      primaryHiddenReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => ({ reason, count })),
    },
    ranking: { entered: ranked.length > 0, topN: ranked.length },
  };
}
