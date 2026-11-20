const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createClient, mapTrack, pickAudio, baseURL, videoID, playWithFallback} = require('../sources.js');
const id='abcdefghijk';
const pipedRow={type:'stream',url:'/watch?v='+id,title:'Title <safe>',uploaderName:'Artist',duration:210,thumbnail:'https://img.example/cover.jpg'};
const invRow={type:'video',videoId:id,title:'Song',author:'Artist',lengthSeconds:210,videoThumbnails:[]};
const track={videoId:id,provider:'invidious',endpoint:'https://yt.chocolatemoo53.com'};
const aac={url:'https://media.example/a.m4a',mimeType:'audio/mp4',bitrate:128000};

test('server configuration accepts HTTPS and rejects credentials, query and non-HTTPS schemes',()=>{
 assert.equal(baseURL('https://example.com/base/'),'https://example.com/base');
 for(const value of ['http://example.com','javascript:alert(1)','https://user:secret@example.com','https://example.com?token=secret']) assert.throws(()=>baseURL(value));
});
test('identifiers and track mapping reject unrelated results and unsafe thumbnails',()=>{
 assert.equal(videoID('/watch?v='+id),id); assert.equal(videoID('/channel/bad'),'');
 assert.equal(mapTrack({...pipedRow,url:'/watch?v=bad'},'piped','https://example.com'),null);
 assert.equal(mapTrack({...invRow,liveNow:true},'invidious','https://example.com'),null);
 const t=mapTrack({...pipedRow,thumbnail:'javascript:bad'},'piped','https://example.com');
 assert.equal(t.thumb,''); assert.equal(t.canSave,false); assert.equal(t.link,'https://www.youtube.com/watch?v='+id);
});
test('Piped search preserves query encoding and ignores playlist results',async()=>{
 const calls=[];const api=createClient({request:async url=>{calls.push(new URL(url));return {items:[pipedRow,{type:'playlist',url:'/playlist?list=abc'}],nextpage:'token & +='};}});
 const r=await api.search('piped','A&B canción'); assert.equal(r.items.length,1); assert.equal(r.hasMore,true);
 assert.equal(calls[0].searchParams.get('q'),'A&B canción'); assert.equal(calls[0].searchParams.get('filter'),'music_songs');
 await api.search('piped','A&B canción',r);
 assert.equal(calls[1].pathname,'/nextpage/search'); assert.equal(calls[1].origin,calls[0].origin); assert.equal(calls[1].searchParams.get('nextpage'),'token & +=');
});
test('Piped retries malformed instance responses and accepts a real empty result',async()=>{
 let count=0;const api=createClient({request:async()=>++count===1 ? {error:'offline'} : {items:[]}});
 const r=await api.search('piped','test'); assert.equal(count,2); assert.equal(r.items.length,0); assert.equal(r.hasMore,false);
});
test('Invidious uses numbered pages and a custom endpoint',async()=>{
 const calls=[];const api=createClient({endpoints:{invidious:'https://own.example'},request:async url=>{calls.push(new URL(url));return [invRow];}});
 const r=await api.search('invidious','song');await api.search('invidious','song',r);
 assert.equal(calls[0].origin,'https://own.example'); assert.equal(calls[0].pathname,'/api/v1/search'); assert.equal(calls[0].searchParams.get('page'),'1'); assert.equal(calls[1].searchParams.get('page'),'2');
});
test('API failure is distinguished from zero results and empty query makes no requests',async()=>{
 let calls=0;const api=createClient({request:async()=>{calls++;throw new Error('offline');}});
 assert.equal((await api.search('piped','')).items.length,0);assert.equal(calls,0);
 await assert.rejects(api.search('piped','test'),/No se pudo consultar/);assert.equal(calls,2);
});
test('audio selection uses compatible audio only, prefers AAC and respects selected bitrate',()=>{
 const formats=[{url:'https://media.example/video',mime:'video/mp4',bitrate:1e6},{url:'https://media.example/opus',mime:'audio/webm',bitrate:160000},
 {url:'https://media.example/high',mime:'audio/mp4',bitrate:128000},{url:'https://media.example/low',mime:'audio/mp4',bitrate:48000},
 {url:'javascript:bad',mime:'audio/mp4',bitrate:96000}];
 assert.equal(pickAudio(formats,96).url,'https://media.example/low');assert.equal(pickAudio(formats,320).url,'https://media.example/high');
 assert.equal(pickAudio(formats,320,()=>''),null);
});
test('Invidious resolves local proxied audio instead of video formats',async()=>{
 const calls=[];const api=createClient({request:async url=>{calls.push(new URL(url));return {adaptiveFormats:[{url:aac.url,type:aac.mimeType,bitrate:'128000'},{url:'https://media.example/video',type:'video/mp4',bitrate:'1000000'}]};}});
 const r=await api.resolve(track,160);assert.equal(r.url,aac.url);assert.equal(calls[0].searchParams.get('local'),'true');
});
test('a blocked resolver can fall back to the other provider without sending credentials',async()=>{
 const calls=[];const api=createClient({request:async url=>{calls.push(url);return url.includes('/api/v1/videos') ? {error:'not available'} : {audioStreams:[aac]};}});
 const r=await api.resolve(track,160);assert.equal(r.provider,'piped');assert.equal(r.url,aac.url);assert.equal(calls.length,2);
});
test('all blocked audio resolvers fail explicitly, never substitute video or claim playback',async()=>{
 const api=createClient({request:async()=>({error:'LOGIN_REQUIRED'})});
 await assert.rejects(api.resolve(track,160),/No hay audio disponible/);
});
test('changing the configured instance does not reuse a queued track old server',async()=>{
 const calls=[];const api=createClient({endpoints:{invidious:'https://own.example'},request:async url=>{calls.push(url);return {adaptiveFormats:[{url:aac.url,type:aac.mimeType,bitrate:128000}]};}});
 await api.resolve(track,160);assert.ok(calls.every(url=>url.startsWith('https://own.example/')));
});


test('media rejection after successful resolution retries another endpoint', async () => {
 const attempts=[];
 const client=createClient({request:async url=>url.includes('/videos/')
   ? {adaptiveFormats:[{url:'https://media.example/rejected',type:'audio/mp4',bitrate:128000}]}
   : {audioStreams:[aac]}});
 const result=await playWithFallback({track,quality:160,resolve:client.resolve,start:async url=>{
   attempts.push(url);if(attempts.length===1)throw new Error('Media request returned HTTP 403');
 }});
 assert.equal(result.provider,'piped');assert.deepEqual(attempts,['https://media.example/rejected',aac.url]);
});
test('browser permission rejection stops retries and preserves permission error',async()=>{
 let attempts=0;
 await assert.rejects(playWithFallback({track,quality:160,
   resolve:async()=>({endpoint:'https://instance.example',url:aac.url}),
   start:async()=>{attempts++;const e=new Error('Gesture required');e.name='NotAllowedError';throw e;}
 }),{name:'NotAllowedError'});
 assert.equal(attempts,1);
});
test('switching tracks during failed playback cancels fallback instead of replacing new audio',async()=>{
 let active=true,attempts=0;
 const result=await playWithFallback({track,quality:160,isCurrent:()=>active,
   resolve:async()=>({endpoint:'https://instance.example',url:aac.url}),
   start:async()=>{attempts++;active=false;throw new Error('Old audio failed');}
 });
 assert.equal(result,null);assert.equal(attempts,1);
});
test('unplayable URLs from every endpoint fail after a bounded number of attempts',async()=>{
 let count=0;
 await assert.rejects(playWithFallback({track,quality:160,
   resolve:async(t,q,excluded)=>({endpoint:'https://instance'+excluded.length+'.example',url:aac.url}),
   start:async()=>{count++;throw new Error('Unsupported audio');}
 }),/rechazaron el audio/);
 assert.equal(count,3);
});
