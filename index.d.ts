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
export interface OplogObservableOpts {
    ts?: ObservableOplogTimestamp;
    timestamp?: ObservableOplogTimestamp;
    uri?: string;
    url?: string;
    collName?: string;
}
export interface OplogStrmFilter {
    events?: Array<'update' | 'insert' | 'delete'>;
    namespace?: string;
    ns?: string;
}
export { getOplogStreamInterpreter } from './lib/helper';
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
    private ops;
    private mongoOpts;
    private transformStreams;
    private rawStream;
    private readableStreams;
    constructor(opts?: OplogObservableOpts, mongoOpts?: any);
    getEvents(): {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
    getOps(): {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
    getEmitter(): EventEmitter;
    connect(): Promise<void>;
    private handleOplogError(e);
    private handleOplogEnd(v);
    private handleOplogData(v);
    private getTime();
    private getStream();
    getFilteredStream(opts: OplogStrmFilter): Transform;
    getRawStream(): ChangeStream;
    getReadableStream(filter?: Partial<OplogStrmFilter>): Readable;
    tail(cb?: ErrorFirstCB): Promise<any>;
    stop(): Promise<any>;
    close(): Promise<any>;
}
export declare const create: (opts: OplogObservableOpts, mongoOpts: any) => ObservableOplog;
