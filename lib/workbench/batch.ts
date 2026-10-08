export const maxBatchBytes=64*1024*1024;
export function validateBatch(files:readonly {size:number}[]) {
 if(!files.length)throw new Error('Choose at least one PNG file.');
 if(files.length>20)throw new Error('Choose at most 20 files per batch.');
 if(files.some(f=>f.size>16*1024*1024))throw new Error('Each source file must be 16 MiB or smaller.');
 if(files.reduce((sum,f)=>sum+f.size,0)>maxBatchBytes)throw new Error('The batch must be 64 MiB or smaller.');
}
export function batchFilename(name:string,index:number,extension:string){return `${String(index+1).padStart(2,'0')}-${name.replace(/\.[^.]*$/,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'image'}.${extension}`;}
