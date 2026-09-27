const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createRequire}=require('module');
const req=createRequire(path.resolve('backend/package.json'));
const dotenv=req('dotenv'),{Pool}=req('pg');
const dir=fs.readFileSync('tmp/member2-active-run.txt','utf8').trim();
const state=JSON.parse(fs.readFileSync('tmp/member2-test-identities.json'));
const base='https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1';
const csv=row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')+'\n';
const sanitize=x=>Array.isArray(x)?x.map(sanitize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,/token|password|email|phoneNumber|url$/i.test(k)?'[REDACTED]':sanitize(v)])):typeof x==='string'?x.replace(/(?:nf-)?eyJ[A-Za-z0-9_.-]+/g,'[TOKEN REDACTED]'):x;
const outputs=[];
async function http(caseId,label,identity,method,route,body,assert){
 const started=new Date().toISOString(),t=performance.now();
 const r=await fetch(base+route,{method,headers:{Authorization:'Bearer '+identity.accessToken,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000),redirect:'error'});
 const data=await r.json();const assertions=assert(r.status,data);const status=Object.values(assertions).every(Boolean)?'PASS':'FAIL';
 const filename=`requests/${caseId}_attempt-01_${label}.json`;if(fs.existsSync(path.join(dir,filename)))throw Error('Evidence exists; use a new attempt');
 fs.writeFileSync(path.join(dir,filename),JSON.stringify({case_id:caseId,started_at_utc:started,method,route,request:sanitize(body),http_status:r.status,response:sanitize(data),duration_ms:Math.round(performance.now()-t),assertions,status},null,2));
 fs.appendFileSync(path.join(dir,'evidence-index.csv'),csv([filename,caseId,label,'Node fetch',started]));outputs.push({caseId,filename,status,started});console.log(caseId,label,status);return {status:r.status,data};
}
function result(caseId,actual,status,notes=''){
 const rows=outputs.filter(x=>x.caseId===caseId);fs.appendFileSync(path.join(dir,'results.csv'),csv([caseId,caseId==='A01'?2:1,'P0','Chirana',rows[0]?.started??new Date().toISOString(),'hosted API + verified test DB','Authorized M2 test identity; project target verified','See request evidence and runner','Source-derived contract and matching persisted values',actual,status,rows.map(x=>x.filename).join(';'),' ',notes]));
}
(async()=>{
 if(!fs.existsSync('backend/.env.test.local'))throw Error('BLOCKED: backend/.env.test.local missing; no hosted API calls made');
 const cfg=dotenv.parse(fs.readFileSync('backend/.env.test.local')),u=new URL(cfg.DATABASE_URL);
 if(!(u.username==='postgres.zkiciluuktuzkidjaiaz'&&u.hostname==='aws-0-ap-southeast-2.pooler.supabase.com')&&u.hostname!=='db.zkiciluuktuzkidjaiaz.supabase.co')throw Error('BLOCKED: database is not expected test project');
 const pool=new Pool({connectionString:cfg.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
 try{
 const identityCheck=await pool.query('SELECT current_database() AS database, current_user AS role');
 fs.writeFileSync(path.join(dir,'logs/target-preflight.json'),JSON.stringify({timestamp_utc:new Date().toISOString(),host:u.hostname,project:'zkiciluuktuzkidjaiaz',identity:identityCheck.rows},null,2));
 const a=state.identities.find(x=>x.label==='org-a');if(!a?.accessToken)throw Error('Test session missing');
 const profileName='M2-A02-'+state.run;
 await http('A02','invalid-profile',a,'PUT','/profile/complete',{fullName:'',phoneNumber:'invalid'},(s,b)=>({status:s===400,code:b.error?.code==='PROFILE_INPUT_INVALID'}));
 const p=await http('A02','valid-profile',a,'PUT','/profile/complete',{fullName:profileName,phoneNumber:'0770000000'},(s,b)=>({status:s===200,name:b.data?.fullName===profileName,completed:!!b.data?.profileCompletedAt}));
 const matched=await pool.query('SELECT id,auth_user_id,full_name,profile_completed_at FROM public.user_profiles WHERE auth_user_id=$1',[a.authUserId]);
 const proven=matched.rows.length===1&&matched.rows[0].id===p.data.data?.id&&matched.rows[0].full_name===profileName;
 fs.writeFileSync(path.join(dir,'logs/A02-db.json'),JSON.stringify({query:'SELECT id,auth_user_id,full_name,profile_completed_at FROM public.user_profiles WHERE auth_user_id=$1',authUserId:a.authUserId,rows:matched.rows,hosted_target_proven:proven},null,2));
 if(!proven){result('A02','HTTP profile did not match expected test database','FAIL','STOP further hosted writes');throw Error('STOP: hosted target not proven');}
 state.hostedTargetProof={project:'zkiciluuktuzkidjaiaz',profileId:matched.rows[0].id,timestamp_utc:new Date().toISOString()};a.profileId=matched.rows[0].id;fs.writeFileSync('tmp/member2-test-identities.json',JSON.stringify(state,null,2));
 await http('A01','valid-identity',a,'GET','/auth/me',null,(s,b)=>({status:s===200,id:b.data?.id===a.profileId,role:b.data?.platformRole==='USER',active:b.data?.accountStatus==='ACTIVE'}));
 result('A01','Valid synthetic identity matched test DB; prior attempt has passing public subchecks',outputs.filter(x=>x.caseId==='A01').every(x=>x.status==='PASS')?'PASS':'FAIL','Combined coverage with A01 attempt 1; no duplicate case count');
 result('A02','Validation and completed profile matched test database',outputs.filter(x=>x.caseId==='A02').every(x=>x.status==='PASS')?'PASS':'FAIL');
 const categories=await http('A03','categories',a,'GET','/incident-categories',null,(s,b)=>({status:s===200,nonempty:Array.isArray(b.data)&&b.data.length>0,fields:Array.isArray(b.data)&&b.data.every(c=>typeof c.id==='string'&&typeof c.name==='string')}));
 if(!categories.data.data?.length)throw Error('Categories unavailable');
 const subs=[];
 for(const [label,change] of [['invalid-title',{title:'x'}],['invalid-location',{latitude:91}],['invalid-category',{categoryId:'not-a-uuid'}]]){
  const submissionId=crypto.randomUUID();subs.push(submissionId);
  await http('A03',label,a,'POST','/incidents',{submissionId,categoryId:categories.data.data[0].id,title:'M2-A03-'+state.run,description:'Synthetic validation case for Member 2 testing.',severity:'LOW',latitude:6.795,longitude:79.94,evidence:[],...change},(s,b)=>({status:s===400,code:b.error?.code==='INCIDENT_REQUEST_INVALID',noStack:!JSON.stringify(b).includes('PrismaClient')}));
 }
 const residue=await pool.query('SELECT count(*)::int AS count FROM public.incidents WHERE submission_id=ANY($1::uuid[])',[subs]);
 fs.writeFileSync(path.join(dir,'logs/A03-db.json'),JSON.stringify({query:'SELECT count(*) FROM public.incidents WHERE submission_id=ANY($1::uuid[])',submissionIds:subs,rows:residue.rows},null,2));
 result('A03','Categories schema and rejected inputs; persisted invalid submissions: '+residue.rows[0].count,outputs.filter(x=>x.caseId==='A03').every(x=>x.status==='PASS')&&residue.rows[0].count===0?'PASS':'FAIL');
 }finally{await pool.end();}
})().catch(e=>{console.log(e.message.replace(/(?:postgres(?:ql)?|https?):\/\/\S+/g,'[URL REDACTED]'));process.exitCode=1;});
