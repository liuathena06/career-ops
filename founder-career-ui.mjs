#!/usr/bin/env node
/** Local-only Founder V0 flow. It keeps resume, interview, profile and results in memory only. */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { CareerInterviewQuestionBankV0 } from './lib/career-interview-question-bank.mjs';
import { createDiscoveryJob } from './lib/job-domain.mjs';
import { assessOpportunity } from './lib/opportunity-assessment.mjs';
import { rankOpportunities } from './lib/opportunity-ranking.mjs';
import { createFounderConfirmedProfile, profileSearchIntent } from './lib/founder-career-flow.mjs';
import { liepinSearchArgs, liepinSearchCards } from './lib/founder-liepin-search.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.FOUNDER_LIEPIN_PORT ?? 3210);
const BODY_LIMIT = 64 * 1024;
const QUESTIONS = JSON.stringify(CareerInterviewQuestionBankV0.map(({ questionId, question }) => ({ questionId, question }))).replace(/</g, '\\u003c');

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Career Agent Founder Test</title><style>
body{max-width:960px;margin:32px auto;padding:0 20px;font:16px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#1c1c1c;background:#fafafa}h1{margin:0 0 4px}h2{font-size:18px;margin:0 0 10px}p{color:#555}.step{background:#fff;border:1px solid #e1e1e1;border-radius:12px;padding:18px;margin:18px 0}.question{border-top:1px solid #eee;padding:18px 0}.question:first-child{border-top:0;padding-top:0}textarea,input{width:100%;box-sizing:border-box;border:1px solid #bbb;border-radius:8px;padding:10px;font:inherit;margin:5px 0 10px}textarea{min-height:76px}label{display:block;font-size:14px;font-weight:600;margin-top:7px}.hint,.status{font-size:14px;color:#666}.error{color:#b42318}.success{color:#16794b}button{border:0;border-radius:8px;padding:11px 15px;background:#1769e0;color:#fff;font:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.hidden{display:none}.results{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{border:1px solid #e1e1e1;border-radius:12px;padding:15px;background:#fff}.card h2{margin-bottom:2px}.company{font-weight:600;margin:0 0 10px}.meta{margin:4px 0;font-size:14px}.tag{display:inline-block;background:#eef5ff;color:#1457ba;border-radius:99px;padding:3px 8px;font-size:12px;margin:0 5px 8px 0}.link{display:inline-block;color:#1769e0;margin-top:8px;word-break:break-all}@media(max-width:640px){body{margin:20px auto}}
</style></head><body><h1>Career Agent Founder Test</h1><p>本地只读验证：简历、访谈、Profile 与岗位结果均不保存。</p>
<section class="step"><h2>1. Resume Upload</h2><input id="resume" type="file" accept=".pdf,.doc,.docx,.txt,.md"><p id="resumeStatus" class="hint">简历只保留在当前浏览器会话，不上传或解析。</p></section>
<section class="step"><h2>2. Career Interview</h2><p class="hint">请完成八问。职业方向中的“目标职位名称”会用于搜索，不需要另外填写 Job Name 或 Location。</p><form id="interview"></form><button id="build" type="button">Generate Confirmed Profile</button><p id="profileStatus" class="status"></p></section>
<section id="searchStep" class="step hidden"><h2>3. Recommended Jobs</h2><p class="hint">根据已确认的职业方向和地点执行一次只读 Liepin 搜索。搜索较慢是当前 V0 已知问题。</p><button id="search" type="button">Search Recommended Jobs</button><p id="searchStatus" class="status"></p><main id="results" class="results"></main></section>
<script>
const questions=${QUESTIONS}; const interview=document.querySelector('#interview'),profileStatus=document.querySelector('#profileStatus'),searchStep=document.querySelector('#searchStep'),searchStatus=document.querySelector('#searchStatus'),results=document.querySelector('#results'); let profile=null;
const extras={
 'career-direction-v0':[['searchRole','确认的目标职位名称（将用于搜索）','例如：AI产品经理']],
 'career-constraints-v0':[['locations','确认的城市','例如：上海；多个城市可换行'],['workMode','确认的工作方式（不做硬过滤）','例如：混合办公'],['availability','确认的到岗时间（不做硬过滤）','例如：一个月内'],['dealBreakers','确认的底线条件','例如：长期驻场']],
 'career-compensation-v0':[['target','理想薪资（可选）','例如：45k/月'],['acceptable','可接受薪资（可选）','例如：40k/月'],['minimum','最低跳槽门槛（可选，才会硬过滤）','例如：35k/月']]
};
for(const q of questions){const box=document.createElement('div');box.className='question';const title=document.createElement('h2');title.textContent=q.question;box.append(title);const label=document.createElement('label');label.textContent='你的回答';const raw=document.createElement('textarea');raw.name='raw:'+q.questionId;raw.required=true;raw.placeholder='请用自己的话回答；不确定可直接说明。';box.append(label,raw);for(const [name,text,placeholder] of (extras[q.questionId]||[])){const extraLabel=document.createElement('label');extraLabel.textContent=text;const input=document.createElement('input');input.name=name+':'+q.questionId;input.placeholder=placeholder;input.required=name==='searchRole';box.append(extraLabel,input)}interview.append(box)}
document.querySelector('#resume').addEventListener('change',(e)=>{const f=e.target.files?.[0];document.querySelector('#resumeStatus').textContent=f?'已在当前浏览器会话选择：'+f.name:'简历只保留在当前浏览器会话，不上传或解析。'});
function answers(){const out={};for(const q of questions){out[q.questionId]={raw:interview.elements['raw:'+q.questionId].value};for(const [name] of (extras[q.questionId]||[]))out[q.questionId][name]=interview.elements[name+':'+q.questionId].value}return out}
document.querySelector('#build').addEventListener('click',async()=>{if(!document.querySelector('#resume').files?.length){profileStatus.className='status error';profileStatus.textContent='请先选择简历。';return}if(!interview.reportValidity())return;profileStatus.className='status';profileStatus.textContent='正在生成已确认 Profile…';try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:answers()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'生成失败');profile=data.profile;profileStatus.className='status success';profileStatus.textContent='Confirmed Profile 已生成。';searchStep.classList.remove('hidden')}catch(e){profileStatus.className='status error';profileStatus.textContent=e instanceof Error?e.message:'生成失败'}});
const labels=[['location','Location'],['salary','Salary'],['education','Education'],['workYears','Work Years'],['industry','Industry'],['financingStage','Financing Stage'],['companySize','Company Size']];
function show(cards){results.replaceChildren();for(const card of cards){const box=document.createElement('article');box.className='card';const title=document.createElement('h2');title.textContent=card.jobName||'—';const company=document.createElement('p');company.className='company';company.textContent=card.company||'—';box.append(title,company);const tag=document.createElement('span');tag.className='tag';tag.textContent=card.recommendation==='apply'?'Apply':'Explore';box.append(tag);for(const [key,label] of labels){const row=document.createElement('p');row.className='meta';row.textContent=label+': '+(card[key]||'—');box.append(row)}for(const unknown of card.unknowns||[]){const item=document.createElement('span');item.className='tag';item.textContent='Unknown: '+unknown;box.append(item)}if(card.jobDetailUrl){const a=document.createElement('a');a.className='link';a.href=card.jobDetailUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Job Detail URL';box.append(a)}results.append(box)}}
document.querySelector('#search').addEventListener('click',async()=>{if(!profile)return;results.replaceChildren();searchStatus.className='status';searchStatus.textContent='正在搜索与筛选真实岗位…';document.querySelector('#search').disabled=true;try{const r=await fetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,topN:10})});const data=await r.json();if(!r.ok)throw new Error(data.error||'搜索失败');show(data.cards||[]);searchStatus.textContent=data.cards?.length?'已显示 '+data.cards.length+' 个值得看的岗位。':'没有找到当前应展示的岗位。'}catch(e){searchStatus.className='status error';searchStatus.textContent=e instanceof Error?e.message:'搜索失败'}finally{document.querySelector('#search').disabled=false}});
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

function runSearch(args) {
  return new Promise((resolve, reject) => {
    execFile('liepin-cli', args, { env: process.env, timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) return reject(new Error('Liepin search did not complete'));
      try { return resolve(JSON.parse(stdout)); } catch { return reject(new Error('Liepin returned an unreadable response')); }
    });
  });
}

async function recommendations(profile, topN) {
  const intent = profileSearchIntent(profile);
  const payload = await runSearch(liepinSearchArgs(intent));
  if (payload?.code !== 0) throw new Error('Liepin search was not accepted.');
  const cards = liepinSearchCards(payload);
  const byId = new Map();
  const assessments = [];
  for (const [index, card] of cards.entries()) {
    if (!card.jobName) continue;
    const job = createDiscoveryJob({
      id: `liepin-search-card-${index + 1}`,
      source: { kind: 'liepin_cli' },
      listing: { title: card.jobName, companyName: card.company, location: card.location, salary: card.salary },
    });
    const assessment = assessOpportunity({ profile, job });
    byId.set(job.id, { ...card, recommendation: assessment.recommendation, unknowns: assessment.unknowns });
    if (assessment.shouldShow) assessments.push(assessment);
  }
  return rankOpportunities(assessments).slice(0, topN).map((item) => byId.get(item.jobId));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(PAGE); return;
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
  try {
    const input = await readJson(req);
    if (req.url === '/api/profile') return json(res, 200, createFounderConfirmedProfile({ answers: input.answers }));
    if (req.url !== '/api/recommendations') return json(res, 404, { error: 'Not found' });
    if (!process.env.LIEPIN_USER_TOKEN) return json(res, 503, { error: '未检测到本机 LIEPIN_USER_TOKEN。' });
    const topN = Math.min(10, Math.max(1, Number(input.topN) || 10));
    return json(res, 200, { cards: await recommendations(input.profile, topN) });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : '请求未完成。' });
  }
}).listen(PORT, HOST, () => console.log(`Career Agent Founder Test: http://${HOST}:${PORT}`));
