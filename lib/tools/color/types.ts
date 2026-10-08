export type Color={r:number;g:number;b:number;a:number};
export type ColorValues=Record<string,unknown>;
export type ColorResult={text?:string;data:Record<string,unknown>;warnings?:string[]};
export class ColorError extends Error{constructor(message:string,public field?:string){super(message);this.name="ColorError";}}
