/// <reference types="node" />
import { Readable, Transform } from "stream";
import { ChangeStream } from 'mongodb';
import { Subject } from "rxjs";
import { Timestamp } from "bson";
import EventEmitter = require('events');
export declare type ObservableOplogTimestamp = {
    $timestamp: string;
} | {
    _bsontype: 'Timestamp';
    low_: number;
    high_: number;
} | {
    low: number;
    high: number;
} | Timestamp;
export declare type OplogNamespace = string | object | RegExp;
export interface OplogObservableOpts {
    query?: object;
    q?: object;
    ts?: ObservableOplogTimestamp;
    timestamp?: ObservableOplogTimestamp;
    uri?: string;
    url?: string;
    collName?: string;
    ns?: OplogNamespace;
    namespace?: string;
}
export interface OplogStrmFilter {
    events?: Array<'update' | 'insert' | 'delete'>;
    namespace?: string;
    ns?: string;
}
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
    getOps(): {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
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
export declare const create: (opts: OplogObservableOpts, mongoOpts: any) => ObservableOplog;
