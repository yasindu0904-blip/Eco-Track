import fs from 'node:fs';
import path from 'node:path';
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const id = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
const dir = path.resolve('docs/testing/evidence/member-2-api',id);
fs.mkdirSync(dir,{recursive:true});
for (const sub of ['screenshots','logs','requests','tools']) fs.mkdirSync(path.join(dir,sub));
fs.writeFileSync('tmp/member2-active-run.txt',dir);
const write=(p,s)=>fs.writeFileSync(path.join(dir,p),s);
const csv=(row)=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')+'\n';
const guide=fs.readFileSync('docs/testing/team-guides/member-2-perfoemance-and-deploy-Chirana.md','utf8');
const planned=guide.split(/\r?\n/).filter(l=>/^\| A\d\d P/.test(l)).map(l=>{const c=l.split('|').map(x=>x.trim()); const [case_id,priority]=c[1].split(' ');return {case_id,priority,steps:c[2],expected:c[3],status:'NOT_RUN'};});
const saveCases=()=>write('cases.csv',csv(['case_id','priority','steps','expected','status'])+planned.map(c=>csv(Object.values(c))).join(''));
saveCases();
write('results.csv',csv('case_id,attempt,priority,tester,started_at_utc,environment,preconditions,steps,expected,actual,status,evidence_paths,defect_id,notes'.split(',')));
write('fixtures.csv',csv(['case_id','owner','entity_type','uuid','cleanup_status']));
write('evidence-index.csv',csv(['evidence_path','case_id','caption','source','timestamp_utc']));
write('defects.md','# Defects\n\nPrior smoke D01 remains open; no corrective build verified. See ../../2026-09-27-hosted-smoke/DEFECTS-AND-BLOCKERS.md.\n');
write('summary.md','# Member 2 initial stage\n\nExecution in progress. No authenticated tests or hosted writes performed.\n');
write('environment.md',`# Environment\n\nTester: Chirana\nRun: ${id} (Asia/Colombo)\nStarted UTC: ${new Date().toISOString()}\nAPI: https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1\nHealth: same origin /health\nLocal HEAD: 4181db9c2dd455569aa872ce0c73541c8cd632ce\nDeployed commit: unverified\nNode: ${process.version}\nBrowser: not used\nWorking tree: untracked root member guide, mobile/node_modules.broken, temporary-organization-frontend; git emitted long-path warnings.\nDocker CLI present, daemon unavailable. Local Node differs from CI Node 24.\nJMeter not found on PATH. Java found through Android Studio.\nNo purchases, deployments, scaling, restarts or hosted writes authorized for this initial stage. Northflank inspection is read-only.\nMissing docs/test-docs/info.txt; starter guide contains stale filename.\n`);
const base='https://p01--eco-track--xnjn7t9fk69n.code.run';
const checks=[['health','/health',200,null,{status:'ok',service:'ecotrack-backend'}],['missing-bearer','/api/v1/auth/me',401,'AUTH_TOKEN_MISSING'],['invalid-bearer','/api/v1/auth/me',401,'AUTH_TOKEN_INVALID'],['unknown-route','/api/v1/m2-nonexistent-route',404,'ROUTE_NOT_FOUND']];
const outputs=[];
for(const [name,route,status,code,fields] of checks){
 const started=new Date().toISOString(),start=performance.now();
 let result;
 try {const r=await fetch(base+route,{headers:name==='invalid-bearer'?{Authorization:'Bearer m2-deliberately-invalid-token'}:{},signal:AbortSignal.timeout(30000),redirect:'error'}); const raw=await r.text(); let body;try{body=JSON.parse(raw);}catch{body={non_json:true,length:raw.length};}
 const assertions={status:r.status===status,json:r.headers.get('content-type')?.includes('application/json')===true,contract:code?body.error?.code===code:Object.entries(fields).every(([k,v])=>body[k]===v),no_stack_or_sql:!/(PrismaClient|SELECT\s+.*FROM|\bat \S+\s*\(|"stack"\s*:)/i.test(raw)};
 result={case_id:'A01',check:name,started_at_utc:started,url:base+route,duration_ms:Math.round(performance.now()-start),expected:{status,code,fields},http_status:r.status,body,assertions,status:Object.values(assertions).every(Boolean)?'PASS':'FAIL'};
 }catch(e){result={case_id:'A01',check:name,started_at_utc:started,duration_ms:Math.round(performance.now()-start),status:'BLOCKED',error:e.name};}
 const filename=`requests/A01_attempt-01_${name}.json`;write(filename,JSON.stringify(result,null,2)+'\n'); outputs.push({...result,filename});
 fs.appendFileSync(path.join(dir,'evidence-index.csv'),csv([filename,'A01',name+' HTTP assertion','Node fetch',started]));
 console.log(name,result.status,result.http_status??result.error);
}
const verdict=outputs.some(x=>x.status==='FAIL')?'FAIL':'BLOCKED';
planned.find(x=>x.case_id==='A01').status=verdict;saveCases();
fs.appendFileSync(path.join(dir,'results.csv'),csv(['A01',1,'P0','Chirana',outputs[0].started_at_utc,'hosted API','Public access only; valid application test bearer unavailable','GET health; auth missing/invalid; unknown route','Expected status and JSON contract; valid identity also required',outputs.map(x=>`${x.check}: ${x.status} HTTP ${x.http_status??'unavailable'}`).join('; '),verdict,outputs.map(x=>x.filename).join(';'),'','Partial execution; valid bearer identity check BLOCKED. Four subchecks are not four unique A01 cases.']));
write('summary.md',`# Member 2 initial-stage findings\n\nA01 attempted: ${verdict}. ${outputs.filter(x=>x.status==='PASS').length}/4 unauthenticated subchecks passed; valid test identity remains blocked on account access.\n\nUnique matrix cases: attempted 1; passed 0; failed ${verdict==='FAIL'?1:0}; blocked ${verdict==='BLOCKED'?1:0}; not run 13. No hosted database target proof, writes, fixtures, authenticated cases, database tests or load tests yet.\n\nNo browser screenshots required for these HTTP checks: JSON evidence records statuses, bodies, assertions, UTC and duration. Timings are individual requests, not performance results.\n\nNext prerequisites: private application test-account configuration and verified test DB access. Northflank credentials do not authenticate application users. Docker daemon unavailable; CI Node 24 differs from local Node 22.\n`);
write('tools/public-smoke.mjs',fs.readFileSync(import.meta.filename,'utf8'));
console.log('Evidence:',dir);
