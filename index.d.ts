/// <reference types="node" />
import { Readable } from "stream";
import { Subject } from "rxjs";
export interface OplogObservableOpts {
    uri: string;
    url: string;
    collName: string;
}
export declare const regex: (pattern: string) => RegExp;
export declare class OplogObservable {
    private uri;
    private coll;
    collName: string;
    isTailing: boolean;
    events: {
        all: Subject<any>;
        update: Subject<Object>;
        insert: Subject<Object>;
        delete: Subject<Object>;
        errors: Subject<Object>;
        end: Subject<Object>;
    };
    private readableStream;
    constructor(opts: OplogObservableOpts, mongoOpts: any);
    connect(): Promise<void>;
    private getTime();
    private getStream();
    getReadableStream(): Readable;
    tail(): Promise<void> | Promise<boolean>;
    stop(): void;
    close(): void;
}
export declare const create: (opts: OplogObservableOpts, mongoOpts: any) => OplogObservable;
