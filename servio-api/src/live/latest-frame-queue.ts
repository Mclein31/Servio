export class LatestFrameQueue<K,V> {
  private readonly pending=new Map<K,V>();
  private running?:Promise<void>;
  constructor(private readonly process:(key:K,value:V)=>Promise<void>){}
  enqueue(key:K,value:V):Promise<void>{
    this.pending.set(key,value);
    if(!this.running)this.running=this.drain();
    return this.running;
  }
  remove(key:K):void{this.pending.delete(key);}
  private async drain():Promise<void>{
    try{
      while(this.pending.size){
        const [key,value]=this.pending.entries().next().value!;
        this.pending.delete(key);await this.process(key,value);
      }
    }finally{this.running=undefined;}
  }
}
