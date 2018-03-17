/// <reference types="node" />
import { OplogInterpreter, OplogInterpreterOpts } from "./interfaces";
import { Stream } from "stream";
export declare const getOplogStreamInterpreter: (s: Stream, opts?: OplogInterpreterOpts) => OplogInterpreter;
