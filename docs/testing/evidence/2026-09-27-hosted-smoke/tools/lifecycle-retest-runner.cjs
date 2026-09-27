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

const actors=[];const fixtures={organizations:[],events:[],source:'Direct SQL setup of synthetic organizations/memberships on test DB; registration/approval flow not covered.'};

async function actor(label){

 const email='ecotrack-life-'+label+'-'+Date.now()+'@example.com',password=crypto.randomBytes(24).toString('base64url');

 const c=await auth.auth.admin.createUser({email,password,email_confirm:true});if(c.error)throw c.error;

 const a={authId:c.data.user.id,email};actors.push(a);

 const sc=createClient(local.SUPABASE_URL,local.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const l=await sc.auth.signInWithPassword({email,password});if(l.error)throw l.error;a.token=l.data.session.access_token;token=a.token;

 await api('SETUP-'+label,'Provision '+label,'GET','/api/v1/auth/me');

 const p=(await db.query('SELECT id FROM user_profiles WHERE auth_user_id=$1',[a.authId])).rows[0];if(!p)throw Error('Wrong database target');a.profileId=p.id;

 await api('PROFILE-'+label,'Complete '+label+' profile','PUT','/api/v1/profile/complete',{fullName:'Smoke Lifecycle '+label,phoneNumber:'+94700000000'});return a;

}

async function org(a,label,area){

 const id=crypto.randomUUID(),membership=crypto.randomUUID();

 await db.query("INSERT INTO organizations (id,requested_by_user_id,name,slug,official_email,official_phone,official_address,status,activated_at,updated_at) VALUES ($1,$2,$3,$4,$5,'+94700000000','Synthetic smoke fixture, Kesbewa','ACTIVE',now(),now())",[id,a.profileId,'SMOKE TEST Organization '+label,'smoke-'+id,a.email]);

 await db.query("INSERT INTO organization_memberships(id,organization_id,user_id,role,status,source) VALUES ($1,$2,$3,'ORG_ADMIN','ACTIVE','FIRST_ADMIN')",[membership,id,a.profileId]);

 await db.query("INSERT INTO organization_service_areas(id,organization_id,administrative_area_id,area_name,boundary,status,reviewed_at,updated_at) SELECT $1,$2,id,name_en,boundary,'ACTIVE',now(),now() FROM administrative_areas WHERE id=$3",[crypto.randomUUID(),id,area.id]);

 fixtures.organizations.push({id,membership,ownerProfile:a.profileId,areaId:area.id});return {id,membership};

}

async function main(){

 if(new URL(test.DATABASE_URL).username!=='postgres.zkiciluuktuzkidjaiaz')throw Error('Unexpected target');await db.connect();

 const prior=JSON.parse(fs.readFileSync('docs/testing/evidence/2026-09-27-hosted-smoke/lifecycle/fixtures.json'));

 const oa=prior.organizations[0],id=prior.events[0];const a=await actor('completion-retest');

 await db.query("INSERT INTO organization_memberships(id,organization_id,user_id,role,status,source) VALUES ($1,$2,$3,'ORG_ADMIN','ACTIVE','ADMIN_ADDED')",[crypto.randomUUID(),oa.id,a.profileId]);

 const before=(await db.query('SELECT updated_at::text AS precise_timestamp,lifecycle_status FROM cleanup_events WHERE id=$1',[id])).rows[0];

 record('RT01','Inspect fixture timestamp precision','PASS',{kind:'Harness diagnostic',before,initialRequest:JSON.parse(fs.readFileSync('docs/testing/evidence/2026-09-27-hosted-smoke/lifecycle/L22.json')).request.body.expectedUpdatedAt});

 await db.query("UPDATE cleanup_events SET updated_at=date_trunc('milliseconds',updated_at) WHERE id=$1",[id]);

 const route='/api/v1/organizations/'+oa.id+'/events';

 await api('RT02','Refresh event operations before completion','GET',route+'/'+id+'/operations');

 const stamp=(await db.query('SELECT updated_at FROM cleanup_events WHERE id=$1',[id])).rows[0].updated_at.toISOString();

 await api('RT03','Complete cleanup after fixture timestamp correction','POST',route+'/'+id+'/complete',{expectedUpdatedAt:stamp,notes:'Synthetic smoke completion retest after fixture timestamp precision correction.'});

 const row=(await db.query('SELECT id,lifecycle_status FROM cleanup_events WHERE id=$1',[id])).rows[0];record('RT04','Completed lifecycle state persisted',row.lifecycle_status==='COMPLETED'?'PASS':'FAIL',{row});

 const area=(await db.query('SELECT ST_Y(ST_PointOnSurface(boundary::geometry)) latitude,ST_X(ST_PointOnSurface(boundary::geometry)) longitude FROM administrative_areas WHERE id=$1',[oa.areaId])).rows[0];

 const draft=await api('RT05','Create cancellation test draft','POST',route+'/drafts',{title:'SMOKE TEST cancellation',description:'Synthetic smoke cancellation test only.',publicInstructions:'Test only, do not attend.',eventLatitude:area.latitude,eventLongitude:area.longitude,eventAddress:'Synthetic fixture official GN location',startsAt:new Date(Date.now()+3600000).toISOString()},201);

 const eid=draft.data?.data?.id;if(!eid)return;fixtures.events.push(eid);

 const membership=(await db.query('SELECT id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2',[oa.id,a.profileId])).rows[0].id;

 await api('RT06','Assign cancellation test coordinator','POST',route+'/'+eid+'/coordinators',{membershipId:membership},[200,201]);

 await api('RT07','Publish cancellation test event','POST',route+'/'+eid+'/publish',{},200);

 const updated=(await db.query('SELECT updated_at FROM cleanup_events WHERE id=$1',[eid])).rows[0].updated_at.toISOString();

 await api('RT08','Cancel published cleanup event','POST',route+'/'+eid+'/cancel',{expectedUpdatedAt:updated,reason:'Synthetic smoke test cancellation; no real event.'});

 const final=(await db.query('SELECT id,lifecycle_status FROM cleanup_events WHERE id=$1',[eid])).rows[0];record('RT09','Cancelled state persisted',final.lifecycle_status==='CANCELLED'?'PASS':'FAIL',{row:final});

}

main().catch(e=>record('RT-RUN','Lifecycle retest interruption','BLOCKED',{error:e.message})).finally(async()=>{for(const a of actors){const r=await auth.auth.admin.deleteUser(a.authId);record('CLEANUP-'+a.profileId,'Remove retest Auth identity',r.error?'FAIL':'PASS',{error:r.error?.message});}fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(fixtures,null,2));await db.end().catch(()=>{});});

