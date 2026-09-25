#!/usr/bin/env node
/**
 * Local Founder-only Liepin search page. It persists neither token nor results.
 * It is deliberately independent from the product domains and CLI providers.
 */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { liepinSearchArgs, liepinSearchCards } from './lib/founder-liepin-search.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.FOUNDER_LIEPIN_PORT ?? 3210);
const BODY_LIMIT = 4 * 1024;

const PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Liepin Founder Test</title><style>
body{max-width:960px;margin:40px auto;padding:0 20px;font:16px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#1c1c1c;background:#fafafa}h1{margin-bottom:4px}p{color:#5c5c5c}form{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;margin:28px 0}input,button{box-sizing:border-box;border:1px solid #bbb;border-radius:8px;padding:11px;font:inherit}button{border:0;background:#1769e0;color:#fff;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{min-height:24px;color:#5c5c5c}.error{color:#b42318}.results{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:20px}.card{background:#fff;border:1px solid #e2e2e2;border-radius:12px;padding:16px;box-shadow:0 1px 2px #00000008}.card h2{font-size:18px;margin:0 0 3px}.company{margin:0 0 12px;font-weight:600}.meta{margin:5px 0;color:#4d4d4d}.meta b{color:#222}.link{display:inline-block;margin-top:10px;color:#1769e0;word-break:break-all}@media(max-width:640px){form{grid-template-columns:1fr}}
</style></head><body><h1>Liepin Founder Test</h1><p>只读搜索；结果仅保留在当前页面。</p>
<form id="search"><input id="jobName" required maxlength="80" placeholder="Job Name，例如：产品经理"><input id="location" maxlength="80" placeholder="Location，例如：上海"><button id="submit" type="submit">Search Liepin</button></form><div id="status" class="status"></div><main id="results" class="results"></main>
<script>
const form=document.querySelector('#search'),status=document.querySelector('#status'),results=document.querySelector('#results'),submit=document.querySelector('#submit');
const labels=[['location','Location'],['salary','Salary'],['education','Education'],['workYears','Work Years'],['industry','Industry'],['financingStage','Financing Stage'],['companySize','Company Size']];
function item(tag,text,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=text||'—';return el}
function show(cards){results.replaceChildren();for(const card of cards){const box=document.createElement('article');box.className='card';box.append(item('h2',card.jobName),item('p',card.company,'company'));for(const [key,label] of labels)box.append(item('p',label+': '+(card[key]||'—'),'meta'));if(card.jobDetailUrl){const a=document.createElement('a');a.className='link';a.href=card.jobDetailUrl;a.target='_blank';a.rel='noreferrer';a.textContent='Job Detail URL';box.append(a)}results.append(box)}}
form.addEventListener('submit',async(e)=>{e.preventDefault();results.replaceChildren();status.className='status';status.textContent='正在搜索…';submit.disabled=true;try{const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobName:document.querySelector('#jobName').value,location:document.querySelector('#location').value})});const data=await r.json();if(!r.ok)throw new Error(data.error||'搜索未成功');show(data.cards||[]);status.textContent=data.cards?.length?'已显示 '+data.cards.length+' 个职位。':'没有找到职位。'}catch(err){status.className='status error';status.textContent=err instanceof Error?err.message:'搜索未成功'}finally{submit.disabled=false}});
</script></body></html>`;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > BODY_LIMIT) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid request')); }
    });
    req.on('error', () => reject(new Error('Invalid request')));
  });
}

function runSearch(args) {
  return new Promise((resolve, reject) => {
    execFile('liepin-cli', args, {
      env: process.env,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) return reject(new Error('Liepin search did not complete'));
      try { return resolve(JSON.parse(stdout)); } catch { return reject(new Error('Liepin returned an unreadable response')); }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(PAGE);
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/search') return json(res, 404, { error: 'Not found' });
  if (!process.env.LIEPIN_USER_TOKEN) return json(res, 503, { error: '未检测到本机 LIEPIN_USER_TOKEN。' });
  try {
    const input = await readJson(req);
    const payload = await runSearch(liepinSearchArgs(input));
    if (payload?.code !== 0) return json(res, 502, { error: 'Liepin search was not accepted.' });
    return json(res, 200, { cards: liepinSearchCards(payload) });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : '搜索未成功。' });
  }
}).listen(PORT, HOST, () => {
  console.log(`Liepin Founder Test: http://${HOST}:${PORT}`);
});
