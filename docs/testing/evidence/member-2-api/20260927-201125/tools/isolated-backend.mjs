import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const evidence=fs.readFileSync('tmp/member2-active-run.txt','utf8').trim();
const run=path.basename(evidence).replaceAll('-','');
const prefix='m2-'+run;
const names={network:prefix,db:prefix+'-db',redis:prefix+'-redis',runner:prefix+'-runner'};
const records=[];
function command(label,args,input){return new Promise(resolve=>{
 const start=new Date().toISOString();const out=[];const p=spawn('docker',args,{windowsHide:true});
 p.stdout.on('data',b=>out.push(b));p.stderr.on('data',b=>out.push(b));
 if(input)p.stdin.end(input);else p.stdin.end();
 p.on('error',e=>out.push(Buffer.from(e.message)));
 p.on('close',code=>{const output=Buffer.concat(out).toString().replace(/postgresql:\/\/[^\s]+/g,'[LOCAL_DISPOSABLE_DATABASE_URL]');const filename='logs/'+label+'.txt';fs.writeFileSync(path.join(evidence,filename),`Started UTC: ${start}\nDocker command: ${args.join(' ').replace(/postgresql:\/\/[^\s]+/g,'[LOCAL_DISPOSABLE_DATABASE_URL]')}\n${output}\nExit code: ${code}\n`);records.push({label,started_at_utc:start,exit_code:code,evidence:filename});fs.writeFileSync(path.join(evidence,'logs/backend-exit-codes.json'),JSON.stringify(records,null,2));console.log(label+': exit '+code);resolve({code,output});});
});}
async function must(label,args,input){const r=await command(label,args,input);if(r.code!==0)throw Error(label+' failed');return r;}
fs.writeFileSync('tmp/member2-isolated-state.json',JSON.stringify(names,null,2));
try{
 const pulled=await Promise.all(['postgis/postgis:17-3.5','redis:8.2-alpine','node:24-bookworm'].map((image,i)=>command('backend-image-'+i,['pull',image])));
 if(pulled.some(r=>r.code!==0))throw Error('Image download failed');
 await must('backend-network',['network','create',names.network]);
 await must('backend-db-start',['run','-d','--name',names.db,'--network',names.network,'--network-alias','m2-db','-e','POSTGRES_DB=ecotrack_m2_isolated','-e','POSTGRES_USER=postgres','-e','POSTGRES_PASSWORD=LOCAL_DISPOSABLE_PLACEHOLDER','postgis/postgis:17-3.5']);
 await must('backend-redis-start',['run','-d','--name',names.redis,'--network',names.network,'--network-alias','m2-redis','redis:8.2-alpine']);
 let ready=false;for(let i=1;i<=15;i++){const r=await command('backend-db-ready-'+i,['exec',names.db,'pg_isready','-U','postgres','-d','ecotrack_m2_isolated']);if(r.code===0){ready=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!ready)throw Error('Database not ready');
 await must('backend-bootstrap',['exec','-i',names.db,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','ecotrack_m2_isolated'],`DO $$ BEGIN IF current_database() <> 'ecotrack_m2_isolated' THEN RAISE EXCEPTION 'Wrong database'; END IF; END $$;
SELECT current_database(), inet_server_addr();
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE SCHEMA extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
SELECT extensions.postgis_full_version();
`);
 const dburl='postgresql://postgres:LOCAL_DISPOSABLE_PLACEHOLDER@m2-db:5432/ecotrack_m2_isolated?schema=public&options=-c%20search_path%3Dpublic%2Cextensions';
 if(new URL(dburl).hostname!=='m2-db'||new URL(dburl).pathname!=='/ecotrack_m2_isolated')throw Error('Unsafe target');
 const env={NODE_ENV:'test',DATABASE_URL:dburl,SUPABASE_URL:'https://ci-placeholder.supabase.co',SUPABASE_PUBLISHABLE_KEY:'ci-placeholder-publishable-key',SUPABASE_SERVICE_ROLE_KEY:'',REDIS_URL:'redis://m2-redis:6379',TEST_REDIS_URL:'redis://m2-redis:6379',REDIS_KEY_PREFIX:prefix,EXPO_ACCESS_TOKEN:'',DOTENV_CONFIG_PATH:'/nonexistent-member2.env'};
 await must('backend-runner-start',['run','-d','--name',names.runner,'--network',names.network,...Object.entries(env).flatMap(([k,v])=>['-e',k+'='+v]),'--mount',`type=bind,source=${path.resolve('backend')},target=/source,readonly`,'--mount',`type=bind,source=${path.resolve('docs/testing/fixtures/MAP-03_Query_Plans.json')},target=/docs/testing/fixtures/MAP-03_Query_Plans.json,readonly`,'-w','/work','node:24-bookworm','sleep','infinity']);
 await must('backend-source-copy',['exec',names.runner,'sh','-c','cp /source/package.json /source/package-lock.json /source/tsconfig.json /source/prisma.config.ts /work/ && cp -r /source/src /source/prisma /work/']);
 await must('backend-node-version',['exec',names.runner,'node','--version']);
 await must('backend-install',['exec',names.runner,'npm','ci']);
 await must('backend-migrations',['exec',names.runner,'npx','prisma','migrate','deploy']);
 await must('backend-prisma-generate',['exec',names.runner,'npm','run','prisma:generate']);
 await command('backend-typecheck',['exec',names.runner,'npm','run','typecheck']);
 await command('backend-build',['exec',names.runner,'npm','run','build']);
 await command('backend-tests',['exec',names.runner,'npm','test']);
 console.log('Isolated execution finished; containers retained temporarily for A13 SQL verification.');
}catch(e){console.log(e.message);process.exitCode=1;}
