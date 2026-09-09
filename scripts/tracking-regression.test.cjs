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
function setup(){
  const storage=new Map();let handler;let started=false;let starts=0;let stops=0;let now=Date.now();let response={data:{trackingActive:true}};
  const calls=[];
  const store={getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>storage.set(key,value),removeItem:async key=>storage.delete(key)};
  const location={Accuracy:{High:4},ActivityType:{AutomotiveNavigation:1},getBackgroundPermissionsAsync:async()=>({status:'granted'}),hasStartedLocationUpdatesAsync:async()=>started,startLocationUpdatesAsync:async(name,options)=>{starts++;started=true;assert.equal(options.foregroundService.killServiceOnDestroy,false)},stopLocationUpdatesAsync:async()=>{stops++;started=false}};
  const axios={post:async(...args)=>{calls.push(args);if(response instanceof Error)throw response;return typeof response==='function'?response():response},isAxiosError:e=>e?.isAxiosError===true};
  class Clock extends Date {static now(){return now}}
  const api=load('src/services/backgroundLocation.ts',{'axios':axios,'@react-native-async-storage/async-storage':store,'expo-location':location,'expo-task-manager':{defineTask:(name,fn)=>handler=fn,isAvailableAsync:async()=>true},'react-native':{AppState:{currentState:'active'},Platform:{OS:'android'},Alert:{alert(){}},Linking:{openSettings:async()=>{}}},'../utils/config':{API_BASE_URL:'https://backend.test'},'./locationSession':{getLocationSession:async()=>({accessToken:'token'})}},Clock);
  return {api,storage,calls,task:data=>handler({data}),tick:()=>now+=5000,setResponse:value=>response=value,counts:()=>({starts,stops,started})};
}
const fix=(timestamp=Date.now())=>({coords:{latitude:3,longitude:101,heading:45,speed:5,accuracy:8},timestamp});
test('native tracking starts once and background GPS uses only the location endpoint',async()=>{
  const h=setup();await h.api.configureBackgroundTracking('ride-1');await h.api.configureBackgroundTracking('ride-1');
  await h.task({locations:[fix()]});assert.equal(h.counts().starts,1);assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][0],'https://backend.test/driver/location');assert.equal(h.calls[0][1].bookingId,'ride-1');assert.equal(h.calls[0][1].trackingOnly,true);
  const status=await h.api.readTrackingStatus();assert.equal(status.lastSentAt,h.calls[0][1].timestamp);assert.equal(status.error,null);
});
test('offline uploads retain the fix, then retry and acknowledge after reconnection',async()=>{
  const h=setup();await h.api.configureBackgroundTracking('ride-1');h.setResponse(new Error('offline'));await h.task({locations:[fix()]});
  assert.ok(h.storage.has('driverPendingLocationV2'));assert.equal((await h.api.readTrackingStatus()).lastSentAt,undefined);
  h.tick();h.setResponse({data:{trackingActive:true}});await h.api.flushPendingLocation();assert.equal(h.calls.length,2);assert.equal(h.storage.has('driverPendingLocationV2'),false);assert.equal((await h.api.readTrackingStatus()).error,null);
});
test('server acknowledgement that a ride ended stops the native task',async()=>{
  const h=setup();await h.api.configureBackgroundTracking('ride-1');h.setResponse({data:{trackingActive:false}});await h.task({locations:[fix()]});
  assert.equal(h.counts().stops,1);assert.equal(h.storage.has('activeBackgroundLocationBookingId'),false);
});
test('a newer fix arriving during an upload survives the older acknowledgement',async()=>{
  const h=setup();await h.api.configureBackgroundTracking('ride-1');let resolve;h.setResponse(()=>new Promise(r=>resolve=r));
  const first=h.task({locations:[fix()]});while(!resolve)await new Promise(r=>setImmediate(r));
  const second=h.task({locations:[fix(Date.now()+1000)]});await new Promise(r=>setImmediate(r));resolve({data:{trackingActive:true}});await Promise.all([first,second]);
  assert.ok(h.storage.has('driverPendingLocationV2'));h.tick();h.setResponse({data:{trackingActive:true}});await h.api.flushPendingLocation();assert.equal(h.calls.length,2);assert.ok(h.calls[1][1].timestamp>h.calls[0][1].timestamp);
});
test('concurrent token refreshes share a request and cannot restore a logged-out session',async()=>{
  let saved=JSON.stringify({accessToken:'old',accessTokenExpiresAt:0,refreshToken:'refresh',refreshTokenExpiresAt:9999999999999});let count=0;let resolve;
  const api=load('src/services/locationSession.ts',{'axios':{post:async()=>{count++;return new Promise(r=>resolve=r)}},'expo-secure-store':{getItemAsync:async()=>saved,setItemAsync:async(key,value)=>saved=value},'../utils/config':{API_BASE_URL:'https://backend.test'},'../types/auth':{isTokenExpired:value=>value<Date.now(),deriveSessionTokens:value=>value}});
  const first=api.getLocationSession();const second=api.getLocationSession();while(!resolve)await new Promise(r=>setImmediate(r));saved=null;resolve({data:{accessToken:'new',refreshToken:'rotated'}});
  assert.equal(await first,null);assert.equal(await second,null);assert.equal(count,1);assert.equal(saved,null);
});

test('temporary refresh failures do not log the driver out, but rejected credentials do',async()=>{
  for(const unauthorized of [false,true]){
    let interceptor;let logouts=0;
    const client=Object.assign(async()=>({}),{interceptors:{request:{use(){}},response:{use:(ok,fail)=>interceptor=fail}}});
    const axios={create:()=>client,isAxiosError:e=>e?.isAxiosError===true};
    const api=load('src/api/client.ts',{'axios':axios,'../utils/config':{API_BASE_URL:'https://backend.test'}});
    api.setSessionTokens({accessToken:'old',refreshToken:'refresh'});
    const failure=Object.assign(new Error('refresh failed'),{isAxiosError:unauthorized,response:unauthorized?{status:401}:undefined});
    api.registerAuthHandlers({onRefresh:async()=>{throw failure},onUnauthorized:()=>logouts++});
    await assert.rejects(interceptor({response:{status:401},config:{headers:{}}}),/refresh failed/);
    assert.equal(logouts,unauthorized?1:0);
  }
});
