import {Subject} from "rxjs/Rx";
import {Readable} from "stream";
import EventEmitter = NodeJS.EventEmitter;
import {Timestamp} from "bson";

export interface ReadableStrmWithFilter {
  strm: Readable,
  filter: Partial<OplogStrmFilter>
}

export interface OplogInterpreterOpts {
  useEmitter: boolean,
  useObservers: boolean
}

export interface OplogInterpreter {
  ops: SubjectMap,
  emitter: EventEmitter
}

export type SubjectMap = {
  [key: string]: Subject<Object>,
  all: Subject<any>,
  update: Subject<Object>,
  insert: Subject<Object>,
  delete: Subject<Object>,
  errors: Subject<Object>,
  end: Subject<Object>,
  del: Subject<Object>
}

interface OplogQuery {
  ns?: any,
  ts?: any,
  $and: Array<any>
}

export type ObservableOplogTimestamp =
  { $timestamp: string } |
  { _bsontype: 'Timestamp', low_: number, high_: number } |
  { low: number, high: number } |
  Timestamp;

export type OplogNamespace = string | object | RegExp;

export interface OplogObservableOpts {
  query?: object,
  q?: object,
  ts?: ObservableOplogTimestamp,
  timestamp?: ObservableOplogTimestamp,
  uri?: string,
  url?: string,
  collName?: string;
  ns?: OplogNamespace;
  namespace?: string;
}

export interface OplogStrmFilter {
  events?: Array<'update' | 'insert' | 'delete'>
  namespace?: string,
  ns?: string
}

export interface OplogDoc {
  ts: string,
  t: number,
  h: string,
  v: number,
  op: 'i' | 'd' | 'u',
  ns: string,
  o: Object
}