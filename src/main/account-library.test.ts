import { expect, it, vi } from 'vitest';
import { AccountLibrary, entitlementKind, parseEntitlements } from './account-library.js';
import type { CatalogProduct } from '../shared/types.js';

const A='9AAAAAAAAAAA', B='9BBBBBBBBBBB', C='9CCCCCCCCCCC';
const row=(productId=A, extra={})=>({productId,status:'Active',isTrial:false,sharingSource:'None',endDate:'2099-01-01T00:00:00Z',special:false,...extra});
const output=(entries=[row()],account='one@example.test',market='US')=>JSON.stringify({schema:1,account,market,checkedAt:new Date().toISOString(),entitlements:entries});
const product=(productId:string):CatalogProduct=>({productId,title:productId,description:'',categories:[],installability:'supported',supportNote:''});

it('provides fresh access for content planning without loading unrelated catalog products', async () => {
  const catalog=vi.fn(async (ids:string[])=>ids.map(product));
  const reader=vi.fn(async()=>output([row(),row(B,{satisfiedByProductId:'CFQ7TTC0KGQ8'})]));
  const library=new AccountLibrary(catalog,reader); library.select('one@example.test','/backend','US');
  expect((await library.access(true)).accessByProductId).toEqual({[A]:'owned',[B]:'gamepass'});
  expect(catalog).not.toHaveBeenCalled(); expect(reader).toHaveBeenCalledTimes(1);
  await library.access(true); expect(reader).toHaveBeenCalledTimes(2);
  library.select(undefined,undefined,'US'); await expect(library.access()).rejects.toThrow('Sign in');
});

it('distinguishes direct/owned bundle access from subscriptions, without guessing missing parents',()=>{
  const {entries}=parseEntitlements(output([row(),row(B,{satisfiedByProductId:A}),row(C,{satisfiedByProductId:'CFQ7TTC0KGQ8'})]),'one@example.test','US');
  expect(entitlementKind(A,entries)).toBe('owned');
  expect(entitlementKind(B,entries)).toBe('owned');
  expect(entitlementKind(C,entries)).toBe('gamepass');
  entries.delete(A); expect(entitlementKind(B,entries)).toBeUndefined();
  entries.set(A,row(A,{satisfiedByProductId:B})); expect(entitlementKind(B,entries)).toBeUndefined();
});

it('never labels expired, trial, special, revoked or shared entitlements as owned',()=>{
  for(const extra of [{isTrial:true},{special:true},{status:'Revoked'},{endDate:'2000-01-01T00:00:00Z'},{sharingSource:'Family'}]) {
    const {entries}=parseEntitlements(output([row(A,extra)]),'one@example.test','US');
    expect(entitlementKind(A,entries)).toBeUndefined();
  }
  expect(entitlementKind('CFQ7TTC0KGQ8',new Map([['CFQ7TTC0KGQ8',row('CFQ7TTC0KGQ8')]]))).toBeUndefined();
});

it('rejects foreign identities/market, malformed rows, duplicates and stale protocol data',()=>{
  for(const text of [output([row()],'other'),output([row()],'one@example.test','CZ'),output([row(),row()]),output([row('invalid')]),
    output([row(A,{isTrial:undefined})]),JSON.stringify({...JSON.parse(output()),checkedAt:'2000-01-01T00:00:00Z'})]) {
    expect(()=>parseEntitlements(text,'one@example.test','US')).toThrow();
  }
});

it('loads all/owned/Game Pass using one account read and caches only bound pages in memory',async()=>{
  const reader=vi.fn(async()=>output([row(),row(B,{satisfiedByProductId:'CFQ7TTC0KGQ8'})]));
  const catalog=vi.fn(async(ids:string[])=>ids.map(product));
  const library=new AccountLibrary(catalog,reader); library.select('one@example.test','/backend','neutral');
  const all=await library.get('all'); expect(all.products.map(p=>p.access)).toEqual(['owned','gamepass']);
  expect((await library.get('owned')).products.map(p=>p.productId)).toEqual([A]);
  expect((await library.get('gamepass')).products.map(p=>p.productId)).toEqual([B]);
  expect(reader).toHaveBeenCalledTimes(1);
  await library.get('all'); expect(catalog).toHaveBeenCalledTimes(3);
  library.select(undefined,'/backend','US'); await expect(library.get('all')).rejects.toThrow('Sign in');
});

it('does not publish a late response after an account switch',async()=>{
  let finish!:(value:string)=>void;
  const library=new AccountLibrary(async ids=>ids.map(product),()=>new Promise(resolve=>{finish=resolve;}));
  library.select('one@example.test','/backend','US');
  const request=library.get('all'); const rejected=expect(request).rejects.toThrow('changed');
  library.select('two@example.test','/backend','US'); finish(output()); await rejected;
});

it('binds pagination to snapshot and filter, rather than accepting arbitrary product IDs',async()=>{
  const entries=Array.from({length:61},(_,i)=>row(String(i).padStart(12,'0')));
  const library=new AccountLibrary(async ids=>ids.map(product),async()=>output(entries));
  library.select('one@example.test','/backend','US');
  const first=await library.get('all'); expect(first.products).toHaveLength(60); expect(first.cursor).toBeTruthy();
  const last=await library.get('all',first.cursor); expect(last.products).toHaveLength(1); expect(last.cursor).toBeUndefined();
  await expect(library.get('owned',first.cursor)).rejects.toThrow('Invalid');
  await library.get('all',undefined,true); await expect(library.get('all',first.cursor)).rejects.toThrow('expired');
});
