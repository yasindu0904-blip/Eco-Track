const fs=require('fs'),path=require('path'),crypto=require('crypto');

const {createRequire}=require('module');const rb=createRequire(path.resolve('backend/package.json'));const rp=createRequire(path.resolve('ecotrack-srs-mockup/package.json'));

const {createClient}=rb('@supabase/supabase-js');const dotenv=rb('dotenv');const {Client}=rb('pg');const {chromium}=rp('playwright');

const env=dotenv.parse(fs.readFileSync('backend/.env'));const test=dotenv.parse(fs.readFileSync('backend/.env.test.local'));

const key=(fs.readFileSync('.env','utf8').match(/eyJ[A-Za-z0-9_.-]+/g)||[]).find(v=>{try{return JSON.parse(Buffer.from(v.split('.')[1],'base64url')).role==='service_role'}catch{return false}});

const auth=createClient(env.SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});

const out=path.resolve('docs/testing/evidence/smoke-rerun-'+Date.now());fs.mkdirSync(out,{recursive:true});

const logs=[],results=[];let userId,browser,db;

function result(id,status,detail){results.push({id,status,at:new Date().toISOString(),...detail});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(id,status,detail.name||'');}

async function screenshot(page,id){await page.screenshot({path:path.join(out,id+'.png'),fullPage:true});}

async function main(){

 browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({viewport:{width:1440,height:1000},geolocation:{latitude:6.795,longitude:79.94},permissions:['geolocation']});const page=await context.newPage();

 page.on('pageerror',e=>logs.push({kind:'pageerror',message:e.message}));

 page.on('response',r=>{if(r.url().includes('code.run'))logs.push({kind:'api',route:new URL(r.url()).pathname,status:r.status()})});

 await page.goto('https://eco-track-ctd.pages.dev',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();await screenshot(page,'WEB01-login');result('WEB01','PASS',{name:'Hosted login page renders',url:page.url(),screenshot:'WEB01-login.png'});

 const email='ecotrack-browser-smoke-'+Date.now()+'@example.com',password=crypto.randomBytes(24).toString('base64url');

 const c=await auth.auth.admin.createUser({email,password,email_confirm:true});if(c.error)throw c.error;userId=c.data.user.id;

 const sc=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const l=await sc.auth.signInWithPassword({email,password});if(l.error)throw l.error;

 const api='https://p01--eco-track--xnjn7t9fk69n.code.run/api/v1';const headers={Authorization:'Bearer '+l.data.session.access_token,'Content-Type':'application/json'};

 await fetch(api+'/auth/me',{headers});

 db=new Client({connectionString:test.DATABASE_URL});await db.connect();const p=await db.query('SELECT id FROM user_profiles WHERE auth_user_id=$1',[userId]);if(!p.rows.length)throw Error('Test database target verification failed');

 const complete=await fetch(api+'/profile/complete',{method:'PUT',headers,body:JSON.stringify({fullName:'Smoke Browser Test',phoneNumber:'+94700000000'})});if(!complete.ok)throw Error('Profile fixture failed '+complete.status);

 const storageKey='sb-'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'-auth-token';

 await page.evaluate(({k,s})=>localStorage.setItem(k,JSON.stringify(s)),{k:storageKey,s:l.data.session});await page.reload({waitUntil:'networkidle'});

 await page.getByText('Find cleanup activity',{exact:true}).first().waitFor({timeout:30000});await page.waitForTimeout(1500);await screenshot(page,'WEB02-dashboard');result('WEB02','PASS',{name:'Authenticated citizen dashboard renders against hosted API',screenshot:'WEB02-dashboard.png',setup:'Injected real Supabase session for synthetic confirmed user; email magic-link delivery NOT tested'});

 for(const [id,label]of [['WEB03','Report incident'],['WEB04','Find cleanup activity'],['WEB05','My Reports'],['WEB06','Notifications']]){

  try{await page.getByText(label,{exact:true}).first().click();await page.waitForTimeout(700);

   if(id==='WEB03')await page.getByRole('heading',{name:'Report an environmental incident',exact:true}).waitFor();

   if(id==='WEB05')await page.getByRole('heading',{name:'No incident reports yet',exact:true}).waitFor({timeout:20000});

   if(id==='WEB06'){await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();await page.getByText('No unread notifications',{exact:true}).waitFor({timeout:20000});}

   if(id==='WEB04'){await page.getByRole('button',{name:'Use my location',exact:true}).click();await page.waitForResponse(r=>r.url().includes('/events/nearby')&&r.status()===200,{timeout:20000});}

   await page.waitForLoadState('networkidle');await screenshot(page,id);result(id,'PASS',{name:label+' page navigation/render',screenshot:id+'.png',visibleText:(await page.locator('main').innerText().catch(()=>page.locator('body').innerText())).slice(0,4000)});

   if(id==='WEB04'){const tab=page.getByRole('button',{name:/Awaiting cleanup/i}).first();if(await tab.count()){const response=page.waitForResponse(r=>r.url().includes('/incidents/nearby')&&r.status()===200,{timeout:20000});await tab.click();await response;await page.waitForTimeout(1000);await page.waitForLoadState('networkidle');await screenshot(page,'WEB04-awaiting');result('WEB04-awaiting','PASS',{name:'Awaiting cleanup tab opens with incident results',screenshot:'WEB04-awaiting.png'});

await page.getByText('SMOKE TEST 2026-09-27 - synthetic incident',{exact:true}).first().click();

await page.getByText(/No cleanup event created yet/i).waitFor({timeout:20000});

await screenshot(page,'WEB04-incident-detail');

result('WEB04-detail','PASS',{name:'Selecting awaiting incident shows detail and no-event message',screenshot:'WEB04-incident-detail.png'});}else result('WEB04-awaiting','FAIL',{name:'Awaiting cleanup tab exists',reason:'Button not found'});}

  }catch(e){await screenshot(page,id+'-error');result(id,'FAIL',{name:label,reason:e.message.slice(0,600)})}

 }

 result('WEB07',logs.some(x=>x.kind==='pageerror')?'FAIL':'PASS',{name:'No uncaught browser JavaScript errors',errors:logs.filter(x=>x.kind==='pageerror')});

}

main().catch(e=>result('WEB-RUN','BLOCKED',{reason:e.message})).finally(async()=>{fs.writeFileSync(path.join(out,'network-and-console.json'),JSON.stringify(logs,null,2));if(userId){const r=await auth.auth.admin.deleteUser(userId);result('WEB-CLEANUP',r.error?'FAIL':'PASS',{name:'Delete synthetic Auth identity',reason:r.error?.message})}if(db)await db.end();if(browser)await browser.close()});

