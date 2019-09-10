'use strict';

import {Readable} from 'stream';
import {Timestamp} from 'bson';
import {Subject} from 'rxjs';
import {EventEmitter} from 'events';

export const log = {
  info: console.log.bind(console, 'oplog.rx:'),
  error: console.error.bind(console, 'oplog.rx:'),
};

export interface EventsSignature {
  [key: string]: string,
  i: 'insert',
  u: 'update',
  d: 'delete'
}

export const evs = <EventsSignature>{
  i: 'insert',
  u: 'update',
  d: 'delete'
};

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

export interface OplogQuery {
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