/// <reference types="node" />
import { Readable, Transform } from "stream";
import { ChangeStream } from 'mongodb';
import EventEmitter = require('events');
import { SubjectMap, OplogStrmFilter, OplogObservableOpts } from "./lib/interfaces";
export { getOplogStreamInterpreter } from './lib/helper';
export { getOplogStreamInterpreter as oplogStreamInterpreter } from './lib/helper';
export declare const regex: (pattern: string) => RegExp;
export interface EventsSignature {
    [key: string]: string;
    i: 'insert';
    u: 'update';
    d: 'delete';
}
export declare const evs: EventsSignature;
export declare type ErrorFirstCB = (err?: Error) => void;
export declare class ObservableOplog {
    private ts;
    private uri;
    private coll;
    collName: string;
    isTailing: boolean;
    private emitter;
    private client;
    private ns;
    private query;
    private ops;
    private rawCursor;
    private mongoOpts;
    private transformStreams;
    private rawStream;
    private readableStreams;
    constructor(opts?: OplogObservableOpts, mongoOpts?: any);
    getOps(): SubjectMap;
    getEmitter(): EventEmitter;
    connect(): Promise<null>;
    private handleOplogError(e);
    private handleOplogEnd(v);
    private handleOplogData(v);
    private getTime();
    private getStream();
    getFilteredStream(opts: OplogStrmFilter): Transform;
    getRawStream(): ChangeStream;
    getReadableStream(filter?: Partial<OplogStrmFilter>): Readable;
    tail(cb?: ErrorFirstCB): Promise<any>;
    stop(isLog?: boolean): Promise<any>;
    close(): Promise<any>;
}
export declare const create: (opts?: OplogObservableOpts, mongoOpts?: any) => ObservableOplog;
