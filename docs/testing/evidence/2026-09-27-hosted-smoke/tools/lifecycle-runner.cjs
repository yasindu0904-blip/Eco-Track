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

 const areas=(await db.query("SELECT id,name_en,ST_Y(ST_PointOnSurface(boundary::geometry)) latitude,ST_X(ST_PointOnSurface(boundary::geometry)) longitude FROM administrative_areas ORDER BY name_en LIMIT 2")).rows;if(areas.length<2)throw Error('GN data missing');

 record('L01','Official GN reference areas available','PASS',{count:(await db.query('SELECT count(*)::int AS n FROM administrative_areas')).rows[0].n,fixtureAreas:areas});

 const owner=await actor('owner'),volunteer=await actor('volunteer');const oa=await org(owner,'A',areas[0]);const ob=await org(volunteer,'B',areas[1]);

 record('L02','Prepare isolated organization fixtures','PASS',{note:fixtures.source,organizations:fixtures.organizations});

 token=owner.token;await api('L03','Organization dashboard','GET','/api/v1/organizations/'+oa.id+'/dashboard-summary');

 await api('L04','Covered boundary geometry','GET','/api/v1/organizations/'+oa.id+'/service-area-boundaries?scope=all');

 const route='/api/v1/organizations/'+oa.id+'/events';

 const body={title:'SMOKE TEST direct cleanup',description:'Synthetic event for hosted lifecycle smoke testing only.',publicInstructions:'Test fixtures only. Do not attend.',eventLatitude:areas[0].latitude,eventLongitude:areas[0].longitude,eventAddress:'Smoke test location in official GN area',startsAt:new Date(Date.now()+120000).toISOString(),capacity:5};

 let draft=await api('L05','Create direct cleanup draft','POST',route+'/drafts',body,201);

 if(draft.status!==201)draft=await api('L05-retry','Retry draft after initial failure','POST',route+'/drafts',body,201);

 const id=draft.data?.data?.id;if(!id)throw Error('Draft unavailable');fixtures.events.push(id);fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(fixtures,null,2));

 token=volunteer.token;await api('L06','Other organization cannot read private draft','GET',route+'/drafts/'+id,undefined,[403,404]);token=owner.token;

 await api('L07','Assign event coordinator','POST',route+'/'+id+'/coordinators',{membershipId:oa.membership},[200,201]);

 await api('L08','Publish readiness','GET',route+'/'+id+'/publish-readiness',undefined,200,true,d=>d?.data?.ready===true);

 const pub=await api('L09','Publish cleanup event','POST',route+'/'+id+'/publish',{},200);if(pub.status!==200)throw Error('Publish failed');

 token=volunteer.token;await api('L10','Published event visible to volunteer','GET','/api/v1/events/'+id);

 const join=await api('L11','Volunteer joins event','POST','/api/v1/events/'+id+'/participation',{},[200,201]);

 await api('L12','Joined events list','GET','/api/v1/event-participations/me');

 await api('L13','Other organization cannot manage event','GET',route+'/'+id+'/operations',undefined,[403,404]);

 token=owner.token;const participants=await api('L14','Owner lists joined volunteers','GET',route+'/'+id+'/participants');

 const participant=(await db.query('SELECT id FROM event_participants WHERE cleanup_event_id=$1 AND user_id=$2',[id,volunteer.profileId])).rows[0];

 // Advance only the synthetic fixture's start time to exercise ongoing operations without waiting two minutes.

 await db.query("UPDATE cleanup_events SET starts_at=now()-interval '1 minute',updated_at=now() WHERE id=$1",[id]);record('L15','Advance synthetic event fixture to ongoing','PASS',{kind:'Fixture preparation, not a product test',eventId:id});

 if(participant)await api('L16','Record volunteer attendance','PATCH',route+'/'+id+'/participants/'+participant.id+'/attendance',{status:'ATTENDED'});

 await api('L17','Post participant update','POST',route+'/'+id+'/notes',{visibility:'PARTICIPANTS',noteText:'Synthetic smoke test participant update.'},[200,201]);

 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8n8AAAAASUVORK5CYII=','base64');const file={originalFileName:'smoke-event-after.png',contentType:'image/png',sizeBytes:bytes.length};

 const intents=await api('L18','Create event evidence upload intent','POST',route+'/'+id+'/evidence/upload-intents',{files:[file]},201);

 const list=intents.data?.data;const intent=Array.isArray(list)?list[0]:list?.intents?.[0];

 if(intent){const upload=await fetch(intent.signedUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:bytes,signal:AbortSignal.timeout(20000)});record('L19','Upload event evidence photo',upload.ok?'PASS':'FAIL',{httpStatus:upload.status});if(upload.ok)await api('L20','Register AFTER evidence','POST',route+'/'+id+'/evidence',{...file,storagePath:intent.storagePath,type:'AFTER',caption:'Synthetic smoke evidence'},201);}

 const readiness=await api('L21','Completion readiness','GET',route+'/'+id+'/completion-readiness');

 const updated=(await db.query('SELECT updated_at FROM cleanup_events WHERE id=$1',[id])).rows[0].updated_at.toISOString();

 await api('L22','Complete cleanup event','POST',route+'/'+id+'/complete',{expectedUpdatedAt:updated,notes:'Synthetic smoke test completed.'});

 token=volunteer.token;await api('L23','Volunteer receives in-app event notifications','GET','/api/v1/notifications',undefined,200,true,d=>JSON.stringify(d).includes('SMOKE TEST'));

 await api('L24','Completed participation appears in history','GET','/api/v1/event-participations/me?scope=history');

 token=owner.token;const removable=await api('L25','Create disposable draft','POST',route+'/drafts',{...body,title:'SMOKE TEST deletable draft',startsAt:new Date(Date.now()+3600000).toISOString()},201);

 if(removable.data?.data?.id)await api('L26','Delete own draft','DELETE',route+'/drafts/'+removable.data.data.id,undefined,[200,204]);

 record('L27','Event final database state','PASS',{rows:(await db.query('SELECT id,lifecycle_status FROM cleanup_events WHERE id=$1',[id])).rows});

}

main().catch(e=>record('L-RUN','Lifecycle interrupted','BLOCKED',{error:e.message})).finally(async()=>{for(const a of actors){const r=await auth.auth.admin.deleteUser(a.authId);record('CLEANUP-'+a.profileId,'Remove synthetic lifecycle Auth identity',r.error?'FAIL':'PASS',{error:r.error?.message});}fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(fixtures,null,2));await db.end().catch(()=>{});});

