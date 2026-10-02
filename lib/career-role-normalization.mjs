/**
 * Execution-time role families derived only from an explicit title. Patterns
 * describe functions, not candidate capability. Specific professions precede
 * generic leadership terms so "Medical Director" is not treated as merely a
 * director and "PR 副总经理" remains a communications role.
 */
const ROLE_PATTERNS = [
  { family: 'investor_relations', pattern: /投资者关系|投资人关系|\b(?:investor relations?|head of ir|ir director)\b/iu },
  { family: 'communications', pattern: /公关|公共关系|企业传播|公司传播|品牌传播|新闻传播|媒介关系|媒体关系|公共事务|企业事务|首席传播|传播官|传播总监|传播负责人|\b(?:pr|public relations?|corporate communications?|communications? director|head of communications?|chief communications officer|corporate affairs|public affairs)\b/iu },
  { family: 'ehs', pattern: /环境健康安全|健康安全环境|安全环保|职业健康安全|\b(?:ehs|hse|environment(?:al)? health (?:and|&) safety)\b/iu },
  { family: 'medical_clinical', pattern: /医学总监|医疗总监|临床(?:总监|负责人|研究|医学)|药物警戒|医学事务|\b(?:medical director|clinical director|clinical research|medical affairs|physician|doctor)\b/iu },
  { family: 'hr', pattern: /人力资源|招聘|人才招聘|人才发展|组织发展|学习发展|培训(?:总监|负责人|经理)|薪酬福利|员工关系|\b(?:human resources?|hrbp|hr director|recruit(?:ing|ment|er)|talent acquisition|learning (?:and|&) development|l&d|organizational development)\b/iu },
  { family: 'finance', pattern: /财务|会计|审计|税务|资金管理|投融资|\b(?:finance|financial controller|accounting|auditing|treasury|tax director|cfo)\b/iu },
  { family: 'legal', pattern: /法务|律师|法律顾问|合规(?:总监|负责人|经理)|\b(?:legal|general counsel|legal counsel|compliance director)\b/iu },
  { family: 'engineering_technical', pattern: /研发|技术(?:总监|负责人|专家)|工程师|开发工程师|架构师|算法|数据科学家|\b(?:engineering|engineer|software developer|developer|architect|scientist|cto)\b/iu },
  { family: 'product', pattern: /产品经理|产品负责人|产品总监|产品运营|\b(?:product manager|product director|head of product|chief product officer)\b/iu },
  { family: 'marketing', pattern: /市场营销|市场总监|品牌(?:总监|经理|负责人|营销)|增长营销|数字营销|用户增长|\b(?:marketing|brand director|brand manager|growth marketing|chief marketing officer|cmo)\b/iu },
  { family: 'sales', pattern: /销售|客户经理|大客户|渠道经理|客户拓展|\b(?:sales|account executive|account manager|key account|channel manager|chief revenue officer)\b/iu },
  { family: 'business_development', pattern: /商务拓展|业务拓展|商业拓展|战略合作|生态合作|\b(?:business development|partnerships?|\bbd\b)\b/iu },
  { family: 'operations', pattern: /运营(?:总监|负责人|经理|主管)|供应链|采购|生产(?:总监|负责人|经理)|物流|仓储|履约|门店运营|\b(?:operations?|chief operating officer|coo|supply chain|procurement|logistics|production director)\b/iu },
  { family: 'general_management', pattern: /(?:业务|事业部|区域|城市|分公司)(?:总经理|负责人|总监)|副总经理|常务副总|总经理|\b(?:general manager|country manager|business unit head|managing director)\b/iu },
];

const ADJACENT_FAMILIES = new Map([
  ['communications', new Set(['investor_relations', 'marketing'])],
  ['investor_relations', new Set(['communications', 'finance'])],
  ['marketing', new Set(['communications', 'product', 'sales', 'business_development'])],
  ['sales', new Set(['marketing', 'business_development'])],
  ['business_development', new Set(['marketing', 'sales'])],
  ['product', new Set(['marketing', 'engineering_technical'])],
  ['engineering_technical', new Set(['product', 'ehs'])],
  ['operations', new Set(['ehs'])],
  ['ehs', new Set(['operations', 'engineering_technical'])],
]);
const normalize = (value) => typeof value === 'string' ? value.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim() : '';

export function roleFamilyFromTitle(title) {
  const value = normalize(title);
  return ROLE_PATTERNS.find((item) => item.pattern.test(value))?.family ?? 'unknown';
}

function areAdjacent(left, right) {
  return ADJACENT_FAMILIES.get(left)?.has(right) === true
    || ADJACENT_FAMILIES.get(right)?.has(left) === true;
}

/** Relationship is derived from confirmed direction and explicit card title only. */
export function compareCareerRole({ confirmedDirections, jobTitle }) {
  const title = normalize(jobTitle);
  const directions = (confirmedDirections ?? []).filter((item) => item?.confirmed === true && normalize(item.value));
  const jobFamily = roleFamilyFromTitle(title);
  if (!title || !directions.length) return { relation: 'unknown', jobFamily, candidateFamilies: [] };
  const candidateFamilies = [...new Set(directions.map((item) => roleFamilyFromTitle(item.value)))];
  if (directions.some((item) => {
    const direction = normalize(item.value);
    return direction.length >= 3 && title.includes(direction);
  }) || jobFamily !== 'unknown' && candidateFamilies.includes(jobFamily)) {
    return { relation: 'aligned', jobFamily, candidateFamilies };
  }
  if (jobFamily !== 'unknown' && candidateFamilies.some((family) => areAdjacent(jobFamily, family))) {
    return { relation: 'adjacent', jobFamily, candidateFamilies };
  }
  if (jobFamily !== 'unknown' && candidateFamilies.some((family) => family !== 'unknown')) {
    return { relation: 'discontinuous', jobFamily, candidateFamilies };
  }
  return { relation: 'unknown', jobFamily, candidateFamilies };
}
