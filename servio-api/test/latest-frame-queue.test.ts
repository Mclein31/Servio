// gps queue tests
import {describe,it,expect} from 'vitest';
import {LatestFrameQueue} from '../src/live/latest-frame-queue';
describe('latest GPS processing',()=>{
 it('keeps the latest queued fix while an earlier fix is in flight',async()=>{
  const seen:number[]=[];let release!:()=>void;const first=new Promise<void>(r=>release=r);
  const queue=new LatestFrameQueue<string,number>(async(_key,value)=>{seen.push(value);if(value===1)await first;});
  const done=queue.enqueue('pro',1);queue.enqueue('pro',2);queue.enqueue('pro',3);queue.enqueue('pro',4);
  expect(seen).toEqual([1]);release();await done;expect(seen).toEqual([1,4]);
  await queue.enqueue('pro',5);expect(seen).toEqual([1,4,5]);
 });
});
