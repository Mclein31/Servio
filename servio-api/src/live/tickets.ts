// live tickets
import { timingSafeEqualString, toBase64Url } from '../lib/crypto';
import { ApiError } from '../lib/errors';
export interface LiveTicket { resource:string; userId:string; sessionHash:string; exp:number; nonce:string }
const invalid=()=>new ApiError(401,'LIVE_TICKET_INVALID','Reconnect to live updates.');
async function signature(secret:string|undefined,payload:string) {
  if (!secret) throw new ApiError(503,'LIVE_UNAVAILABLE','Live updates are unavailable.');
  const bytes=Uint8Array.from(atob(secret),(c)=>c.charCodeAt(0));
  if(bytes.length<32) throw new ApiError(503,'LIVE_UNAVAILABLE','Live updates are unavailable.');
  const key=await crypto.subtle.importKey('raw',bytes,{ name:'HMAC',hash:'SHA-256' },false,['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`servio:live-ticket:v1:${payload}`))));
}
export async function mintLiveTicket(secret:string|undefined,resource:string,userId:string,sessionHash:string) {
  const ticket:LiveTicket={ resource,userId,sessionHash,exp:Date.now()+60000,nonce:crypto.randomUUID() };
  const payload=toBase64Url(new TextEncoder().encode(JSON.stringify(ticket)));
  return `${payload}.${await signature(secret,payload)}`;
}
export async function readLiveTicket(secret:string|undefined,token:string|undefined):Promise<LiveTicket> {
  if (!token || token.length>2048) throw invalid();
  const [payload,sig,...rest]=token.split('.');
  if (!payload || !sig || rest.length || !timingSafeEqualString(sig,await signature(secret,payload))) throw invalid();
  try {
    const ticket=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))) as LiveTicket;
    if (!/^(booking|pro|user):[0-9a-f-]{36}$/.test(ticket.resource) || !/^[0-9a-f-]{36}$/.test(ticket.userId) || !/^[0-9a-f]{64}$/.test(ticket.sessionHash) || !/^[0-9a-f-]{36}$/.test(ticket.nonce) || !Number.isSafeInteger(ticket.exp) || ticket.exp<=Date.now() || ticket.exp>Date.now()+61000) throw invalid();
    return ticket;
  } catch { throw invalid(); }
}
