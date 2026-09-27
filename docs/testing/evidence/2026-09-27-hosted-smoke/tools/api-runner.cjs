const fs = require('fs');

const path = require('path');

const crypto = require('crypto');

const {createRequire} = require('module');

const requireBackend = createRequire(path.resolve('backend/package.json'));

const {Client} = requireBackend('pg');

const dotenv = requireBackend('dotenv');

const {createClient} = requireBackend('@supabase/supabase-js');

const rootText = fs.readFileSync('.env','utf8');

const local = dotenv.parse(fs.readFileSync('backend/.env'));

const test = dotenv.parse(fs.readFileSync('backend/.env.test.local'));

const key = (rootText.match(/eyJ[A-Za-z0-9_.-]+/g)||[]).find(v=>{try{return JSON.parse(Buffer.from(v.split('.')[1],'base64url')).role==='service_role'}catch{return false}});

const out=path.resolve('docs/testing/evidence/smoke-rerun-'+Date.now());

fs.mkdirSync(out,{recursive:true});

const base='https://p01--eco-track--xnjn7t9fk69n.code.run';

const results=[]; let token; let userId; let profileId;

const auth = key ? createClient(local.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}}) : null;

const db = new Client({connectionString:test.DATABASE_URL,connectionTimeoutMillis:15000});

function clean(v,k=''){

 if(/token|password|secret|signedUrl|authorization/i.test(k))return '[REDACTED]';

 if(typeof v==='string')return v.replace(/https?:\/\/[^\s"<>]+/g,s=>s.includes('token=')?'[SIGNED URL REDACTED]':s);

 if(Array.isArray(v))return v.map(x=>clean(x));

 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([a,b])=>[a,clean(b,a)]));

 return v;

}

function record(id,name,status,details){const r={id,name,status,at:new Date().toISOString(),...clean(details)};results.push(r);fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(r,null,2));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(id,status,name);return r;}

async function api(id,name,method,route,body,expected=200,authenticated=true,validate){

 const started=Date.now();try{

 const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(authenticated&&token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});

 const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data=raw.slice(0,1000)}

 record(id,name,(Array.isArray(expected)?expected:[expected]).includes(r.status)&&(!validate||validate(data))?'PASS':'FAIL',{request:{method,route,body},expectedStatus:expected,httpStatus:r.status,durationMs:Date.now()-started,response:data});return {status:r.status,data};

 }catch(e){record(id,name,'FAIL',{error:e.name+': '+e.message,durationMs:Date.now()-started});return {status:0,data:null}}

}

async function main(){

 if(new URL(test.DATABASE_URL).username!=='postgres.zkiciluuktuzkidjaiaz')throw Error('Unexpected database target');

 await db.connect();

 const schema=(await db.query("SELECT (SELECT count(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations,to_regclass('public.cleanup_event_reminders')::text AS reminders,(SELECT count(*)::int FROM administrative_areas) AS areas,(SELECT count(*)::int FROM incident_categories) AS categories")).rows[0];

 record('SM01','Test database migrations and reference prerequisites',schema.migrations===20&&schema.reminders?'PASS':'FAIL',{observed:schema});

 await api('SM02','Hosted backend health','GET','/health',undefined,200,false,d=>d.status==='ok');

 await api('SM03','Unauthenticated profile access rejected','GET','/api/v1/auth/me',undefined,401,false);

 await api('SM04','Unknown route returns controlled 404','GET','/api/v1/smoke-nonexistent',undefined,404,false);

 token='invalid-smoke-token';await api('SM05','Invalid bearer token rejected','GET','/api/v1/auth/me',undefined,401);token=undefined;

 if(!auth)throw Error('Supabase admin credential not available');

 const email='ecotrack-smoke-'+Date.now()+'@example.com';const password=crypto.randomBytes(24).toString('base64url');

 const created=await auth.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Smoke Test Temporary User'}});

 if(created.error)throw Error('Temporary Auth fixture: '+created.error.message);userId=created.data.user.id;

 const loginClient=createClient(local.SUPABASE_URL,local.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

 const login=await loginClient.auth.signInWithPassword({email,password});

 if(login.error)throw Error('Test login: '+login.error.message);token=login.data.session.access_token;

 record('SM06','Supabase password login with temporary confirmed user','PASS',{fixture:'Temporary smoke user; credentials excluded'});

 await api('SM07','Hosted API verifies Supabase identity','GET','/api/v1/auth/me');

 const profiles=(await db.query('SELECT id FROM user_profiles WHERE auth_user_id=$1',[userId])).rows;

 if(!profiles.length){record('SM08','Hosted API writes to intended test database','FAIL',{reason:'Temporary Auth identity not found in test DB; stopping writes'});return;}

 profileId=profiles[0].id;record('SM08','Hosted API writes to intended test database','PASS',{profileId,testProject:'zkiciluuktuzkidjaiaz'});

 await api('SM09','Invalid profile rejected','PUT','/api/v1/profile/complete',{fullName:'X',phoneNumber:'invalid'},400);

 await api('SM10','Complete test profile','PUT','/api/v1/profile/complete',{fullName:'Smoke Test Temporary User',phoneNumber:'+94700000000'});

 const categories=await api('SM11','Read incident categories','GET','/api/v1/incident-categories');

 await api('SM12','Citizen cannot access platform admin','GET','/api/v1/dashboards/platform',undefined,403);

 await api('SM13','Malformed incident rejected','POST','/api/v1/incidents',{title:'x'},400);

 const submissionId=crypto.randomUUID();

 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8n8AAAAASUVORK5CYII=','base64');

 const file={originalFileName:'smoke-test-pixel.png',contentType:'image/png',sizeBytes:bytes.length};

 const intents=await api('SM14','Create signed incident photo upload intent','POST','/api/v1/incidents/evidence/upload-intents',{submissionId,files:[file]},201);

 let evidence=[];

 if(intents.status===201&&intents.data?.data?.[0]){

 const intent=intents.data.data[0];const start=Date.now();

 const r=await fetch(intent.signedUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(30000)});

 record('SM15','Upload actual PNG through signed Storage URL',r.ok?'PASS':'FAIL',{httpStatus:r.status,durationMs:Date.now()-start,response:(await r.text()).slice(0,500),asset:'Synthetic 1x1 PNG, not camera evidence'});

 if(r.ok)evidence=[{...file,storagePath:intent.storagePath,sortOrder:0,caption:'Synthetic smoke-test image'}];

 }

 const category=categories.data?.data?.[0];

 if(category){

 const body={submissionId,categoryId:category.id,title:'SMOKE TEST 2026-09-27 - synthetic incident',description:'Automated hosted smoke test fixture. This is not a real environmental incident.',severity:'LOW',latitude:6.795,longitude:79.94,evidence};

 const incident=await api('SM16','Create incident with uploaded evidence','POST','/api/v1/incidents',body,201);

 let id=incident.data?.data?.id;

 if(!id){const retry=await api('SM16-retry','Retry incident submission after initial failure','POST','/api/v1/incidents',body,[200,201]);id=retry.data?.data?.id;}

 if(id){

 fs.writeFileSync(path.join(out,'fixture-manifest.json'),JSON.stringify({profileId,incidentId:id,authUserId:userId,storagePaths:evidence.map(x=>x.storagePath),note:'Synthetic test database records retained; temporary Auth user deleted after run.'},null,2));

 await api('SM17','Idempotent incident submission replay','POST','/api/v1/incidents',body,200,true,d=>d?.meta?.idempotentReplay===true);

 const detail=await api('SM18','Retrieve incident and signed photo link','GET','/api/v1/incidents/me/'+id);

 const urls=[];function collect(v){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(k==='url'&&typeof x==='string')urls.push(x);else collect(x)}}collect(detail.data);

 if(urls[0]){const r=await fetch(urls[0],{signal:AbortSignal.timeout(15000)});const b=await r.arrayBuffer();record('SM19','Download stored incident image',r.ok&&b.byteLength===bytes.length?'PASS':'FAIL',{httpStatus:r.status,bytes:b.byteLength,expectedBytes:bytes.length});}

 const persisted=(await db.query('SELECT id,ST_AsText(geo_point::geometry) AS point FROM incidents WHERE id=$1',[id])).rows;

 record('SM20','Incident and PostGIS point persisted in test database',persisted[0]?.point?'PASS':'FAIL',{rows:persisted});

 }

 }

 await api('SM21','Nearby awaiting-cleanup incidents','GET','/api/v1/incidents/nearby?latitude=6.795&longitude=79.94&radiusMeters=2000&awaitingCleanup=true');

 for(const section of ['upcoming','ongoing','past','cancelled'])await api('SM22-'+section,'Cleanup discovery '+section,'GET','/api/v1/events?section='+section);

 await api('SM23','Nearby cleanup event map','GET','/api/v1/events/nearby?latitude=6.795&longitude=79.94&radiusMeters=2000');

 await api('SM24','Citizen dashboard','GET','/api/v1/dashboards/citizen');

 await api('SM25','Notifications list','GET','/api/v1/notifications');

 await api('SM26','Notification unread count','GET','/api/v1/notifications/unread-count');

 await api('SM27','Rewards summary','GET','/api/v1/rewards/me/summary');

 await api('SM28','GN division search','GET','/api/v1/administrative-areas?search=Kesbewa');

 record('SM29','Organization application and event lifecycle prerequisites',schema.areas>0?'PASS':'BLOCKED',{administrativeAreaCount:schema.areas,reason:schema.areas?'Reference areas available':'No official GN boundaries imported; organization coverage and event lifecycle cannot be meaningfully smoke-tested yet.'});

 await db.query("UPDATE user_profiles SET platform_role='SUPER_ADMIN' WHERE id=$1",[profileId]);

 await api('SM30','Super-admin dashboard','GET','/api/v1/dashboards/platform');

 await api('SM31','Notification worker live heartbeat','GET','/api/v1/super-admin/notification-worker',undefined,200,true,d=>d?.data?.online===true);

 await db.query("UPDATE user_profiles SET platform_role='USER' WHERE id=$1",[profileId]);

}

main().catch(e=>record('RUN-ERROR','Smoke run interruption','BLOCKED',{error:e.message})).finally(async()=>{

 if(profileId)await db.query("UPDATE user_profiles SET platform_role='USER' WHERE id=$1",[profileId]).catch(()=>{});

 if(userId&&auth){const {error}=await auth.auth.admin.deleteUser(userId);record('CLEANUP','Remove temporary Supabase Auth identity',error?'FAIL':'PASS',{error:error?.message});}

 await db.end().catch(()=>{});

 record('MANUAL-WEB','Web UI rendering and browser interactions','NOT_RUN',{reason:'No authenticated browser session available; API checks do not establish UI correctness.'});

 record('MANUAL-MOBILE','Android camera, gallery, map and device notification receipt','NOT_RUN',{reason:'Physical phone not accessible from this session.'});

});

