import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoalServer } from './server.mjs';
test('HTTP permissions, team attribution, concurrency and persistent updates',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'goals-test-')),accessFile=join(directory,'access.txt');let server;
  try{
    server=await createGoalServer({directory,accessFile,port:0});let base=`http://127.0.0.1:${server.address().port}/TrueMedLIStracker/api`;
    const send=(path,data,cookie,origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});
    const state=await(await fetch(base+'/workspace')).json();assert.equal((await send('/workspace',{revision:state.revision,action:{type:'goal.archive',id:'none'}})).status,401);
    const password=(await readFile(accessFile,'utf8')).match(/Aegis: (.+)/)[1];const session=await send('/session',{team:'aegis',password,name:'Test teammate'});assert.equal(session.status,200);const cookie=session.headers.get('set-cookie').split(';')[0];
    const value={account:'Test',title:'HTTP goal',scope:'Testing',status:'Awaiting validation',outcome:'Verify shared saving',team:'congen',phase:'validation',health:'on-track',startDate:'',dueDate:'',targetWeek:'',completedDate:'',eta:'TBD'};
    assert.equal((await send('/workspace',{revision:state.revision,action:{type:'goal.save',value}},cookie,'https://other.example')).status,403);
    const saved=await send('/workspace',{revision:state.revision,action:{type:'goal.save',value},actor:{team:'congen'}},cookie);assert.equal(saved.status,200);const next=await saved.json();assert.equal(next.history[0].actor.team,'aegis');
    assert.equal((await send('/workspace',{revision:state.revision,action:{type:'goal.save',value}},cookie)).status,409);
    await new Promise(resolve=>server.close(resolve));server=await createGoalServer({directory,accessFile,port:0});base=`http://127.0.0.1:${server.address().port}/TrueMedLIStracker/api`;const restored=await(await fetch(base+'/workspace')).json();assert.equal(restored.revision,next.revision);assert.ok(restored.goals.some(g=>g.title==='HTTP goal'));
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
