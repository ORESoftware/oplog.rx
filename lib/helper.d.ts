/// <reference types="node" />
import { OplogInterpreter, OplogInterpreterOpts } from "./interfaces";
import { Stream } from "stream";
import { Timestamp } from "bson";
import { Collection } from "mongodb";
export declare const getValidTimestamp: (ts: any, coll: Collection<any>) => Timestamp;
export declare const getOplogStreamInterpreter: (s: Stream, opts?: OplogInterpreterOpts) => OplogInterpreter;
