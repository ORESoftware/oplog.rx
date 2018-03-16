/// <reference types="node" />
import { Readable, Stream, Transform } from "stream";
import { ChangeStream } from 'mongodb';
import { Subject } from "rxjs";
import EventEmitter = require('events');
export interface OplogObservableOpts {
    uri: string;
    url: string;
    collName: string;
}
export interface OplogStrmFilter {
    events?: Array<'update' | 'insert' | 'delete'>;
    namespace?: string;
    ns?: string;
}
export declare const regex: (pattern: string) => RegExp;
export interface ReadableStrmWithFilter {
    strm: Readable;
    filter: Partial<OplogStrmFilter>;
}
export interface OplogInterpreterOpts {
    useEmitter: boolean;
    useObservers: boolean;
}
export interface OplogInterpreter {
    ops?: {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
    emitter?: EventEmitter;
}
export declare const getOplogStreamInterpreter: (s: Stream, opts?: OplogInterpreterOpts) => OplogInterpreter;
export declare class ObservableOplog {
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
    private getTime();
    private getStream();
    getFilteredStream(opts: OplogStrmFilter): Transform;
    getRawStream(): ChangeStream;
    getReadableStream(filter?: Partial<OplogStrmFilter>): Readable;
    tail(): Promise<any>;
    stop(): Promise<any>;
    close(): void;
}
export declare const create: (opts: OplogObservableOpts, mongoOpts: any) => ObservableOplog;
