/// <reference types="node" />
import { Transform } from 'stream';
export declare class Filter extends Transform {
    constructor(options: any);
    _transform(chunk: any, encoding: any, callback: any): void;
    _flush(cb: Function): void;
    _sync(): void;
    _pattern(stack: Array<any>): any;
    _allowAll(): boolean;
}
