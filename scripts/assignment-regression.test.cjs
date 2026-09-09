// Run: node --test scripts/tracking-regression.test.cjs
// Exercise the real TypeScript task with mocked OS/storage/transport boundaries.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
function load(relative,mocks,clock){
  const exports={};
  const source=fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,
    {exports,require:id=>{if(!(id in mocks))throw Error('Unexpected dependency: '+id);return mocks[id]},Date:clock??Date,console:{warn(){}},setTimeout,clearTimeout,AbortController});
  return exports;
}

function alarmHarness() {
  let ready; let cancels=0; const players=[];
  const api=load('src/services/assignmentAlarm.ts', {
    'react-native':{Vibration:{cancel:()=>cancels++,vibrate:()=>{}}},
    'expo-audio':{setAudioModeAsync:()=>new Promise(resolve=>ready=resolve),createAudioPlayer:()=>{
      const player={plays:0,pauses:0,removes:0,play(){this.plays++},pause(){this.pauses++},remove(){this.removes++}};
      players.push(player);return player;
    }},
    '../../assets/notify.wav':1,
  });
  return {api,players,ready:()=>ready(),cancels:()=>cancels};
}
test('confirmation stops playing audio and vibration immediately',async()=>{
  const h=alarmHarness();h.api.startAssignmentAlarm('ride-1');h.ready();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.players[0].plays,1);const before=h.cancels();h.api.stopAssignmentAlarm('ride-1');
  assert.equal(h.players[0].pauses,1);assert.equal(h.players[0].removes,1);assert.equal(h.cancels(),before+1);
});
test('confirmation during audio initialization prevents the late-starting alarm',async()=>{
  const h=alarmHarness();h.api.startAssignmentAlarm('ride-1');h.api.stopAssignmentAlarm('ride-1');h.ready();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.players.length,0);
});
test('cleanup from an old alert cannot silence the next ride',async()=>{
  const h=alarmHarness();const cleanup=h.api.startAssignmentAlarm('ride-1');h.ready();await new Promise(resolve=>setImmediate(resolve));
  h.api.startAssignmentAlarm('ride-2');h.ready();await new Promise(resolve=>setImmediate(resolve));cleanup();h.api.stopAssignmentAlarm('ride-1');
  assert.equal(h.players[1].pauses,0);h.api.stopAssignmentAlarm('ride-2');assert.equal(h.players[1].pauses,1);
});
test('stale snapshots preserve confirmation while a genuinely new assignment can alert again',()=>{
  const {mergeDriverJob}=load('src/utils/mergeDriverJob.ts',{});
  const current={id:'ride-1',status:'ASSIGNED',assignmentNotifiedAt:'2026-09-09T10:00:00Z',assignmentAcknowledgedAt:'2026-09-09T10:01:00Z'};
  assert.equal(mergeDriverJob(current,{assignmentAcknowledgedAt:null}).assignmentAcknowledgedAt,current.assignmentAcknowledgedAt);
  assert.equal(mergeDriverJob(current,{status:'ASSIGNED',assignmentAcknowledgedAt:undefined}).assignmentAcknowledgedAt,current.assignmentAcknowledgedAt);
  assert.equal(mergeDriverJob(current,{assignmentNotifiedAt:'2026-09-09T11:00:00Z',assignmentAcknowledgedAt:null}).assignmentAcknowledgedAt,null);
});
test('successful confirmation stops the shared alarm without starting the trip; failures do not confirm',async()=>{
  for (const fail of [false,true]) {
    const calls=[];const stopped=[];const confirmed=[];
    const api=load('src/api/driver.ts',{
      '../utils/mergeDriverJob':{rememberAssignmentConfirmation:()=>{}},
      '../services/assignmentAlarm':{stopAssignmentAlarm:id=>stopped.push(id)},
      '../utils/events':{emitAssignmentConfirmed:value=>confirmed.push(value)},
      'axios':{isAxiosError:()=>false,create:()=>({})},
      './client':{apiClient:{post:async(url)=>{calls.push(url);if(fail)throw Error('offline');return {data:{id:'ride-1',status:'ASSIGNED',assignmentAcknowledgedAt:'2026-09-09T10:01:00Z'}}}}},
      '../utils/config':{USE_MOCKS:false,API_BASE_URL:'https://backend.test'},
      '../types/auth':{},
    });
    if(fail) await assert.rejects(api.acknowledgeDriverJob('ride-1'),/offline/);
    else {const job=await api.acknowledgeDriverJob('ride-1');assert.equal(job.status,'ASSIGNED');}
    assert.deepEqual(calls,['/driver/jobs/ride-1/acknowledge']);
    assert.equal(stopped.length,fail?0:1);assert.equal(confirmed.length,fail?0:1);
  }
});

test('a list first loaded after confirmation cannot restart the alarm from its stale response',()=>{
  const {rememberAssignmentConfirmation,applyAssignmentConfirmation}=load('src/utils/mergeDriverJob.ts',{});
  rememberAssignmentConfirmation('ride-1','2026-09-09T10:01:00Z');
  assert.ok(applyAssignmentConfirmation({id:'ride-1',assignmentAcknowledgedAt:null,assignmentNotifiedAt:'2026-09-09T10:00:00Z'}).assignmentAcknowledgedAt);
  assert.equal(applyAssignmentConfirmation({id:'ride-1',assignmentAcknowledgedAt:null,assignmentNotifiedAt:'2026-09-09T11:00:00Z'}).assignmentAcknowledgedAt,null);
});

test('general updates do not masquerade as a new ride, and ride taps keep their booking target',()=>{
  const api=load('src/utils/notificationHandlers.ts',{'react-native':{Platform:{OS:'android'},Vibration:{vibrate(){}}}});
  assert.equal(api.getNotificationType({type:'RIDE_COMPLETED'}),'RIDE_UPDATE');
  assert.equal(api.getNotificationType({type:'SUPPORT_REPLY'}),'GENERAL');
  assert.equal(api.getNotificationType(undefined),'GENERAL');
  assert.equal(api.getNotificationType({type:'DRIVER_ASSIGNED',notificationType:'ADMIN_REASSIGNMENT'}),'ADMIN_REASSIGNMENT');
  assert.equal(api.handleNotificationPress({type:'RIDE_STARTED',entityId:'ride-1'}).params.params.jobId,'ride-1');
  assert.equal(api.handleNotificationPress({type:'SUPPORT_REPLY',entityId:'ticket-1'}).screen,'HomeTab');
  assert.equal(api.getChannelIdForType('PICKUP_ALERT'),'pickup-alerts');
});
