function confirmed(entries) {
  return (entries ?? []).some((entry) => entry?.confirmed === true && entry.value !== '');
}

function countReason(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** A compact, privacy-safe account of each downstream Founder-flow stage. */
export function summarizeFounderFlow({ profile, intent, intents = intent ? [intent] : [], liepinResultCount, mappedJobs, skippedJobs, assessments, ranked, displayedCompanies, filteredExamples = [] }) {
  const hidden = assessments.filter((assessment) => !assessment.shouldShow);
  const hardFilterBreakdown = { locationConflict: 0, minimumCompensationConflict: 0, dealBreakerConflict: 0 };
  for (const assessment of assessments) {
    for (const reason of assessment.hardFilter?.reasons ?? []) {
      if (reason === 'LOCATION_CONFLICT') hardFilterBreakdown.locationConflict += 1;
      if (reason === 'MINIMUM_COMPENSATION_CONFLICT') hardFilterBreakdown.minimumCompensationConflict += 1;
      if (reason === 'DEAL_BREAKER_CONFLICT') hardFilterBreakdown.dealBreakerConflict += 1;
    }
  }
  const reasons = new Map();
  for (const assessment of hidden) {
    if (assessment.hardFilter?.outcome === 'filtered_out') {
      countReason(reasons, 'hard constraint conflict');
      continue;
    }
    if (assessment.careerCoherenceReason) {
      countReason(reasons, 'career continuity weak');
      continue;
    }
    if (assessment.policyExecution?.ruleResults?.some((item) => item.ruleId === 'role_family_relevance' && item.status === 'discontinuous')) {
      countReason(reasons, 'role family conflict');
    } else if (assessment.dimensions?.careerDirection?.judgment === 'mixed') {
      countReason(reasons, 'career direction conflict');
    } else {
      countReason(reasons, 'explicit recommendation conflict');
    }
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
      primaryHiddenReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => ({ reason, count })), hardFilterBreakdown, filteredExamples,
    },
    ranking: { entered: ranked.length > 0, topN: displayedCompanies ?? ranked.length },
  };
}
