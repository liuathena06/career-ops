#!/usr/bin/env node
import dotenv from 'dotenv';
import { resolve } from 'node:path';
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: false, quiet: true });
/** Local-only Founder V0 flow. It keeps resume, interview, profile and results in memory only. */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { CareerInterviewQuestionBankV0 } from './lib/career-interview-question-bank.mjs';
import { createDiscoveryJob } from './lib/job-domain.mjs';
import { assessOpportunity } from './lib/opportunity-assessment.mjs';
import { rankOpportunities } from './lib/opportunity-ranking.mjs';
import { createFounderConfirmedProfile } from './lib/founder-career-flow.mjs';
import { createMockCareerIntelligenceAnalyzer, createOpportunitySearchStrategy } from './lib/ai-career-intelligence-v0.mjs';
import { analyzeCareerIntelligence } from './lib/career-intelligence-analyzer.mjs';
import { createBailianQwenCareerIntelligenceAnalyzer, isBailianQwenConfigured } from './lib/bailian-qwen-career-intelligence.mjs';
import { liepinSearchArgs, liepinSearchCards } from './lib/founder-liepin-search.mjs';
import { createLiepinSearchDiagnostics, sanitizeLiepinSearchError } from './lib/founder-liepin-diagnostics.mjs';
import { resolveLiepinCli } from './lib/founder-liepin-cli-path.mjs';
import { sanitizeLiepinCliStderr } from './lib/founder-liepin-stderr.mjs';
import { summarizeFounderFlow } from './lib/founder-flow-diagnostics.mjs';
import { extractFounderResumeText } from './lib/founder-resume-text.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.FOUNDER_LIEPIN_PORT ?? 3210);
const BODY_LIMIT = 12 * 1024 * 1024;
const LIEPIN_CLI = resolveLiepinCli();
const QWEN_CREDENTIAL_AVAILABLE = isBailianQwenConfigured();
const QUESTIONS = JSON.stringify(CareerInterviewQuestionBankV0.map(({ questionId, question }) => ({ questionId, question }))).replace(/</g, '\\u003c');

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Career Agent Founder Test</title><style>
body{max-width:960px;margin:32px auto;padding:0 20px;font:16px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#1c1c1c;background:#fafafa}h1{margin:0 0 4px}h2{font-size:18px;margin:0 0 10px}p{color:#555}.step{background:#fff;border:1px solid #e1e1e1;border-radius:12px;padding:18px;margin:18px 0}.question{border-top:1px solid #eee;padding:18px 0}.question:first-child{border-top:0;padding-top:0}textarea,input{width:100%;box-sizing:border-box;border:1px solid #bbb;border-radius:8px;padding:10px;font:inherit;margin:5px 0 10px}textarea{min-height:76px}label{display:block;font-size:14px;font-weight:600;margin-top:7px}.hint,.status{font-size:14px;color:#666;white-space:pre-wrap}.error{color:#b42318}.success{color:#16794b}button{border:0;border-radius:8px;padding:11px 15px;background:#1769e0;color:#fff;font:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.hidden{display:none}.results{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid #e1e1e1;border-radius:12px;padding:15px;background:#fff}.card h2{margin-bottom:2px}.company{font-weight:600;margin:0 0 10px}.meta{margin:4px 0;font-size:14px}.tag{display:inline-block;background:#eef5ff;color:#1457ba;border-radius:99px;padding:3px 8px;font-size:12px;margin:0 5px 8px 0}.link{display:inline-block;color:#1769e0;margin-top:8px;word-break:break-all}@media(max-width:640px){body{margin:20px auto}}
</style></head><body><h1>Career Agent Founder Test</h1><p>本地只读验证：简历、访谈、Profile 与岗位结果均不保存。</p>
<p class="hint">${QWEN_CREDENTIAL_AVAILABLE ? '' : 'Qwen credential missing'}</p><section class="step"><h2>1. Resume Upload</h2><input id="resume" type="file" accept=".pdf,.doc,.docx,.txt,.md"><label for="resumeText">简历文本（本机自动提取）</label><textarea id="resumeText" readonly placeholder="选择 PDF、DOCX、DOC、TXT 或 MD 后自动提取；不保存、不上传到第三方。"></textarea><p id="resumeStatus" class="hint">简历仅在本机临时处理。扫描件暂不支持。</p></section>
<section class="step"><h2>2. Career Interview</h2><p class="hint">请完成八问。职业方向中的“目标职位名称”会用于搜索，不需要另外填写 Job Name 或 Location。</p><form id="interview"></form><button id="build" type="button" disabled>Generate Confirmed Profile</button><p id="profileStatus" class="status"></p></section>
<section id="searchStep" class="step hidden"><h2>3. Recommended Jobs</h2><p class="hint">将按 direct、adjacent、stretch 三条探索方向分别执行只读 Liepin 搜索，再合并去重。搜索较慢是当前 V0 已知问题。</p><button id="search" type="button">Search Recommended Jobs</button><p id="searchStatus" class="status"></p><main id="results" class="results"></main></section>
<script>
const questions=${QUESTIONS}; const qwenCredentialAvailable=${JSON.stringify(QWEN_CREDENTIAL_AVAILABLE)}; const interview=document.querySelector('#interview'),profileStatus=document.querySelector('#profileStatus'),searchStep=document.querySelector('#searchStep'),searchStatus=document.querySelector('#searchStatus'),results=document.querySelector('#results'),resumeTextInput=document.querySelector('#resumeText'),buildButton=document.querySelector('#build'); let profile=null,intelligence=null,searchStrategy=null; let resumeDiagnostic={upload:'not_read',fileType:'unknown',parse:'not_started',language:'unknown',characters:0};
const extras={
 'career-direction-v0':[['searchRole','确认的目标职位名称（将用于搜索）','例如：AI产品经理']],
 'career-constraints-v0':[['locations','确认的城市','例如：上海；多个城市可换行']],
 'career-compensation-v0':[['target','理想薪资（可选）','例如：45k/月'],['acceptable','可接受薪资（可选）','例如：40k/月'],['minimum','最低跳槽门槛（可选，才会硬过滤）','例如：35k/月']]
};
for(const q of questions){const box=document.createElement('div');box.className='question';const title=document.createElement('h2');title.textContent=q.question;box.append(title);const label=document.createElement('label');label.textContent='你的回答';const raw=document.createElement('textarea');raw.name='raw:'+q.questionId;raw.required=true;raw.placeholder='请用自己的话回答；不确定可直接说明。';box.append(label,raw);for(const [name,text,placeholder] of (extras[q.questionId]||[])){const extraLabel=document.createElement('label');extraLabel.textContent=text;const input=document.createElement('input');input.name=name+':'+q.questionId;input.placeholder=placeholder;input.required=name==='searchRole';box.append(extraLabel,input)}interview.append(box)}
function updateBuildState(){buildButton.disabled=!(resumeDiagnostic.parse==="success"&&interview.checkValidity())}
function resumeStatusText(result){if(result.status==="success")return "Resume upload: success | parse: success | language: "+result.language+" | characters: "+result.characterCount;if(result.status==="scanned_pdf_unsupported")return "扫描件暂不支持。请选择带文字层的 PDF，或使用 DOCX。";if(result.status==="too_large")return "简历文件过大，当前本地测试仅支持 8MB 以内文件。";if(result.status==="unsupported")return "暂不支持该简历格式。";return "本地简历解析失败。"}
function asBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||"");const comma=value.indexOf(",");if(comma<0)return reject(new Error("无法读取文件"));resolve(value.slice(comma+1))};reader.onerror=()=>reject(new Error("无法读取文件"));reader.readAsDataURL(file)})}
document.querySelector('#resume').addEventListener('change',async(e)=>{const f=e.target.files?.[0];if(!f){resumeDiagnostic={upload:"not_read",fileType:"unknown",parse:"not_started",language:"unknown",characters:0};resumeTextInput.value="";document.querySelector("#resumeStatus").textContent="未选择简历。";updateBuildState();return}resumeDiagnostic={upload:"success",fileType:f.type||f.name.split(".").pop()||"unknown",parse:"not_started",language:"unknown",characters:0};resumeTextInput.value="";document.querySelector("#resumeStatus").textContent="正在本机解析简历…";updateBuildState();try{const r=await fetch("/api/resume-text",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:f.name,fileType:f.type,dataBase64:await asBase64(f)})});const result=await r.json();if(!r.ok)throw new Error(result.error||"解析失败");resumeDiagnostic={upload:"success",fileType:f.type||f.name.split(".").pop()||"unknown",parse:result.status==="success"?"success":"fail",language:result.language||"unknown",characters:Number(result.characterCount)||0};if(result.status==="success")resumeTextInput.value=result.text||"";document.querySelector("#resumeStatus").textContent=resumeStatusText(result)}catch{resumeDiagnostic={...resumeDiagnostic,parse:"fail"};document.querySelector("#resumeStatus").textContent="本地简历解析失败。"}updateBuildState()});
interview.addEventListener("input",updateBuildState);interview.addEventListener("change",updateBuildState);updateBuildState();
function answers(){const out={};for(const q of questions){out[q.questionId]={raw:interview.elements['raw:'+q.questionId].value};for(const [name] of (extras[q.questionId]||[]))out[q.questionId][name]=interview.elements[name+':'+q.questionId].value}return out}
document.querySelector('#build').addEventListener('click',async()=>{if(resumeDiagnostic.parse!=="success"){profileStatus.className='status error';profileStatus.textContent='请先完成本机简历解析。';return}if(!interview.reportValidity())return;profileStatus.className='status';profileStatus.textContent='正在生成已确认 Profile 与职业摘要…';try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:answers(),resumeText:resumeTextInput.value})});const data=await r.json();if(!r.ok)throw new Error(data.error||'生成失败');profile=data.profile;intelligence=data.intelligence;searchStrategy=data.searchStrategy;const directions=(searchStrategy?.searches||[]).map((item)=>item.kind+': '+item.jobName).join(' | ');const aiSource=qwenCredentialAvailable?(data.intelligenceRun?.usedFallback?'local mock fallback':data.intelligenceRun?.analyzer||'local mock'):'Qwen credential missing';profileStatus.className='status success';profileStatus.textContent='Confirmed Profile 已生成。\\nAI source: '+aiSource+'\\nCareer thesis: '+(intelligence?.careerThesis?.text||'—')+'\\nSearch directions: '+directions;searchStep.classList.remove('hidden')}catch(e){profileStatus.className='status error';profileStatus.textContent=e instanceof Error?e.message:'生成失败'}});
const labels=[['location','Location'],['salary','Salary'],['education','Education'],['workYears','Work Years'],['industry','Industry'],['financingStage','Financing Stage'],['companySize','Company Size']];
function show(cards){results.replaceChildren();for(const card of cards){const box=document.createElement('article');box.className='card';const title=document.createElement('h2');title.textContent=card.jobName||'—';const company=document.createElement('p');company.className='company';company.textContent=card.company||'—';box.append(title,company);const tag=document.createElement('span');tag.className='tag';tag.textContent=card.recommendation==='apply'?'Apply':'Explore';box.append(tag);for(const [key,label] of labels){const row=document.createElement('p');row.className='meta';row.textContent=label+': '+(card[key]||'—');box.append(row)}for(const unknown of card.unknowns||[]){const item=document.createElement('span');item.className='tag';item.textContent='Unknown: '+unknown;box.append(item)}if(card.jobDetailUrl){const a=document.createElement('a');a.className='link';a.href=card.jobDetailUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Job Detail URL';box.append(a)}results.append(box)}}
document.querySelector("#search").addEventListener("click",async()=>{if(!profile||!searchStrategy)return;results.replaceChildren();searchStatus.className="status";searchStatus.textContent="正在按多个职业方向搜索与筛选真实岗位…";document.querySelector("#search").disabled=true;try{const r=await fetch("/api/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile,searchStrategy,topN:10})});const data=await r.json();if(!r.ok)throw new Error(data.error||"搜索失败");show(data.cards||[]);searchStatus.textContent=flowSummary(data)}catch(e){searchStatus.className="status error";searchStatus.textContent=e instanceof Error?e.message:"搜索失败"}finally{document.querySelector("#search").disabled=false}});
function flowSummary(data){const f=data.flowDiagnostics;if(!f)return "诊断摘要不可用。";const reasons=f.opportunityAssessment.primaryHiddenReasons.map((item)=>item.reason+":"+item.count).join(", ")||"none";return ["Resume: upload="+resumeDiagnostic.upload+", type="+resumeDiagnostic.fileType+", parse="+resumeDiagnostic.parse+", language="+resumeDiagnostic.language+", characters="+resumeDiagnostic.characters,"Profile: confirmed="+f.profile.confirmed+", direction="+f.profile.careerDirection+", location="+f.profile.location+", capability="+f.profile.capabilityEvidence+", minimum compensation="+f.profile.compensationMinimum,"Search directions: "+f.searchCriteria.jobName+", Location="+(f.searchCriteria.location||"empty")+", count="+f.searchCriteria.directionCount,"Liepin: called="+f.liepinSearch.called+", merged results="+f.liepinSearch.resultCount,"Job mapping: mapped="+f.jobMapping.mappedJobs+", skipped="+f.jobMapping.skippedJobs,"Assessment: total="+f.opportunityAssessment.assessedJobs+", hard filtered="+f.opportunityAssessment.hardFiltered+", shouldShow="+f.opportunityAssessment.shouldShow+", shouldHide="+f.opportunityAssessment.shouldHide,"Primary hidden reasons: "+reasons,"Ranking: entered="+f.ranking.entered+", Top N="+f.ranking.topN].join("\\n")}
</script></body></html>`;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; if (Buffer.byteLength(body) > BODY_LIMIT) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid request')); } });
    req.on('error', () => reject(new Error('Invalid request')));
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function diagnosticMessage(diagnostics) {
  const yesNo = (value) => value === true ? "true" : value === false ? "false" : "not_attempted";
  return [
    "Profile search criteria generated: " + yesNo(diagnostics.profileSearchCriteriaGenerated),
    "liepin-cli found: " + yesNo(diagnostics.liepinCliFound),
    "credential source: " + diagnostics.credentialSource,
    "liepin-cli exit status: " + (diagnostics.liepinCliExitStatus ?? "not_attempted"),
    "Liepin response parse: " + diagnostics.responseParse,
    "error: " + (diagnostics.sanitizedErrorMessage ?? "none"),
  ].join(" | ");
}

function failSearch(diagnostics, message) {
  diagnostics.sanitizedErrorMessage = message;
  return new Error(diagnosticMessage(diagnostics));
}

function runSearch(args, diagnostics) {
  return new Promise((resolve, reject) => {
    execFile(LIEPIN_CLI, args, { env: process.env, timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        diagnostics.liepinCliFound = error.code !== "ENOENT";
        diagnostics.liepinCliExitStatus = typeof error.code === "number" ? error.code : null;
        return reject(failSearch(diagnostics, sanitizeLiepinCliStderr(stderr, { token: process.env.LIEPIN_USER_TOKEN }) || sanitizeLiepinSearchError(error)));
      }
      diagnostics.liepinCliFound = true;
      diagnostics.liepinCliExitStatus = 0;
      try {
        const payload = JSON.parse(stdout);
        diagnostics.responseParse = "success";
        return resolve(payload);
      } catch {
        diagnostics.responseParse = "failure";
        return reject(failSearch(diagnostics, "Liepin 响应无法解析。"));
      }
    });
  });
}

async function recommendations(profile, searchStrategy, topN) {
  const diagnostics = createLiepinSearchDiagnostics({ tokenAvailable: Boolean(process.env.LIEPIN_USER_TOKEN), credentialSource: process.env.LIEPIN_USER_TOKEN ? "environment override" : "liepin-cli config" });
  diagnostics.liepinCliFound = Boolean(LIEPIN_CLI);
  const searches = searchStrategy?.searches;
  if (!Array.isArray(searches) || searches.length === 0) throw failSearch(diagnostics, "无法从已确认 Profile 生成搜索方向。");
  diagnostics.profileSearchCriteriaGenerated = true;
  if (!diagnostics.liepinCliFound) throw failSearch(diagnostics, "未找到本机 liepin-cli。");
  const cardsByKey = new Map();
  for (const intent of searches.slice(0, 4)) {
    const payload = await runSearch(liepinSearchArgs(intent), diagnostics);
    if (payload?.code !== 0) throw failSearch(diagnostics, "Liepin 未接受本次搜索。");
    let currentCards;
    try { currentCards = liepinSearchCards(payload); } catch { throw failSearch(diagnostics, "Liepin 职位列表结构无法读取。"); }
    for (const card of currentCards) {
      const key = card.jobId ? "job:" + card.jobId : card.jobDetailUrl ? "url:" + card.jobDetailUrl : "fallback:" + intent.kind + ":" + card.jobName + ":" + card.company;
      if (!cardsByKey.has(key)) cardsByKey.set(key, { ...card, searchDirection: intent.kind });
    }
  }
  const cards = [...cardsByKey.values()];
  const byId = new Map();
  const allAssessments = [];
  const showableAssessments = [];
  for (const [index, card] of cards.entries()) {
    if (!card.jobName) continue;
    const job = createDiscoveryJob({
      id: card.jobId ? "liepin-search-card-" + card.jobId : "liepin-search-card-" + (index + 1),
      source: { kind: "liepin_cli" },
      listing: { title: card.jobName, companyName: card.company, location: card.location, salary: card.salary },
    });
    const assessment = assessOpportunity({ profile, job });
    byId.set(job.id, { ...card, recommendation: assessment.recommendation, unknowns: assessment.unknowns });
    allAssessments.push(assessment);
    if (assessment.shouldShow) showableAssessments.push(assessment);
  }
  const ranked = rankOpportunities(showableAssessments).slice(0, topN);
  return {
    cards: ranked.map((item) => byId.get(item.jobId)), diagnostics,
    flowDiagnostics: summarizeFounderFlow({
      profile, intents: searches, liepinResultCount: cards.length, mappedJobs: allAssessments.length,
      skippedJobs: cards.length - allAssessments.length, assessments: allAssessments, ranked,
    }),
  };
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(PAGE); return;
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
  try {
    const input = await readJson(req);
    if (req.url === '/api/resume-text') {
      const encoded = typeof input.dataBase64 === 'string' ? input.dataBase64 : '';
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length === 0) return json(res, 400, { error: 'Invalid local file payload' });
      const bytes = Buffer.from(encoded, 'base64');
      return json(res, 200, await extractFounderResumeText({ fileName: input.fileName, mimeType: input.fileType, bytes }));
    }
    if (req.url === '/api/profile') { const founded = createFounderConfirmedProfile({ answers: input.answers }); const fallbackAnalyzer = createMockCareerIntelligenceAnalyzer(); const analyzer = QWEN_CREDENTIAL_AVAILABLE ? createBailianQwenCareerIntelligenceAnalyzer() : fallbackAnalyzer; const analyzed = await analyzeCareerIntelligence({ analyzer, fallbackAnalyzer: analyzer === fallbackAnalyzer ? null : fallbackAnalyzer, resumeText: input.resumeText, interview: founded.interview, profile: founded.profile }); const intelligence = analyzed.intelligence; return json(res, 200, { ...founded, intelligence, intelligenceRun: { analyzer: analyzed.analyzer.id, usedFallback: analyzed.usedFallback }, searchStrategy: createOpportunitySearchStrategy({ profile: founded.profile, intelligence }) }); }
    if (req.url !== '/api/recommendations') return json(res, 404, { error: 'Not found' });
    const topN = Math.min(10, Math.max(1, Number(input.topN) || 10));
    return json(res, 200, await recommendations(input.profile, input.searchStrategy, topN));
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : '请求未完成。' });
  }
}).listen(PORT, HOST, () => console.log(`Career Agent Founder Test: http://${HOST}:${PORT}`));
