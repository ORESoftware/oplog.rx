/// <reference types="node" />
import { Readable, Transform } from "stream";
import { Subject } from "rxjs";
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
export declare class ObservableOplog {
    private uri;
    private coll;
    collName: string;
    isTailing: boolean;
    private events;
    private transformStreams;
    private changeStream;
    private readableStreams;
    constructor(opts: OplogObservableOpts, mongoOpts: any);
    getEvents(): {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
    connect(): Promise<void>;
    private getTime();
    private getStream();
    private getTransformStream2();
    private getTransformStream();
    getRawStream(): Transform;
    getReadableStream(filter?: Partial<OplogStrmFilter>): Readable;
    tail(): Promise<any>;
    stop(): Promise<any>;
    close(): void;
}
export declare const create: (opts: OplogObservableOpts, mongoOpts: any) => ObservableOplog;
