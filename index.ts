'use strict';

import assert = require('assert');
import {Readable, Stream, Transform} from "stream";
import {ChangeStream, Collection, MongoClient, ObjectId} from 'mongodb';
import {Subject} from "rxjs";
import {Timestamp} from "bson";
import EventEmitter = require('events');
const MONGO_URI = 'mongodb://127.0.0.1:27017/local';
import helpers = require('./lib/helper');
import {OplogInterpreter, OplogInterpreterOpts, ReadableStrmWithFilter} from "./lib/interfaces";

const log = {
  info: console.log.bind(console, '[oplog.rx]'),
  error: console.error.bind(console, '[oplog.rx]'),
};

export type ObservableOplogTimestamp =
  { $timestamp: string } |
  { _bsontype: 'Timestamp', low_: number, high_: number } |
  { low: number, high: number } |
  Timestamp;

export interface OplogObservableOpts {
  ts?: ObservableOplogTimestamp,
  timestamp?: ObservableOplogTimestamp,
  uri?: string,
  url?: string,
  collName?: string;
}

export interface OplogStrmFilter {
  events?: Array<'update' | 'insert' | 'delete'>
  namespace?: string,
  ns?: string
}

export {getOplogStreamInterpreter} from './lib/helper';

// *Open A Change Stream*
// You can only open a change stream against replica sets or sharded clusters.
// For a sharded cluster, you must issue the open change stream operation against the mongos.
// https://docs.mongodb.com/manual/changeStreams/

export const regex = function (pattern: string) {
  pattern = pattern || '*';
  pattern = pattern.replace(/[*]/g, '(.*?)');
  return new RegExp(`^${pattern}$`, 'i')
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

export type ErrorFirstCB = (err?: Error) => void;

export class ObservableOplog {
  
  private ts: ObservableOplogTimestamp;
  private uri: string;
  private coll: Collection;
  collName: string;
  isTailing = false;
  private emitter = new EventEmitter();
  
  private ops = {
    all: new Subject<any>(),
    update: new Subject<Object>(),
    insert: new Subject<Object>(),
    delete: new Subject<Object>(),
    errors: new Subject<Object>(),
    end: new Subject<Object>()
  };
  
  private mongoOpts: any;
  private transformStreams: Array<Transform> = [];
  private rawStream: ChangeStream;
  private readableStreams: ReadableStrmWithFilter[] = [];
  
  constructor(opts?: OplogObservableOpts, mongoOpts?: any) {
    opts = opts || {} as any;
    this.ts = opts.ts;
    this.uri = opts.uri || MONGO_URI;
    this.mongoOpts = mongoOpts || {};
  }
  
  getEvents() {
    return this.ops;
  }
  
  getOps() {
    return this.ops;
  }
  
  getEmitter() {
    return this.emitter;
  }
  
  connect() {
    const self = this;
    return MongoClient.connect(this.uri).then(function (client) {
      const db = client.db('local');
      // db.oplog.rs.find()
      self.coll = db.collection('oplog.rs');
    });
  }
  
  private handleOplogError(e: Error) {
    this.ops.all.next({type: 'error', value: e});
    this.ops.errors.next(e);
  }
  
  private handleOplogEnd(v: any) {
    this.ops.all.next({type: 'end', value: v || true});
    this.ops.end.next(true);
    
    this.transformStreams.forEach(function (t) {
      t.end();
    });
    
    this.readableStreams.forEach(function (r) {
      r.strm.destroy();
    });
  };
  
  private handleOplogData(v: Object) {
    
    if (!v) {
      log.error('Unexpected error: empty changeStream event data [1].');
      return;
    }
    
    const type = evs[v.op];
    
    this.transformStreams.forEach(function (t) {
      t.write(v);
    });
    
    this.readableStreams.forEach(function (r) {
      
      if (!r.filter.events || r.filter.events.length < 1) {
        return r.strm.push(JSON.stringify(v) + '\n');
      }
      
      if (r.filter.events.includes(type as any)) {
        return r.strm.push(JSON.stringify(v) + '\n');
      }
    });
    
    if (!type) {
      this.ops.all.next({type: 'unknown', value: v});
      return;
    }
    
    this.emitter.emit(type, v);
    this.ops[type].next(v);
  }
  
  private async getTime(): Promise<Timestamp> {
    
    const ts = this.ts as any;
    const coll = this.coll;
    return helpers.getValidTimestamp(ts, coll);
  }
  
  private getStream(): Promise<ChangeStream> {
    
    const query = {
      // we don't want op to be either n or c
      $and: [
        {op: {$ne: 'n'}},
        {op: {$ne: 'c'}}
      ]
    };
    
    const coll = this.coll;
    const ns = this.ns;
    
    if (ns) {
      query.ns = {$regex: regex(ns)};
    }
    
    const self = this;
    
    return this.getTime().then(function (t) {
      
      query.ts = {$gt: t};
      
      const q = coll.find(query, {
        // raw: true,
        tailable: true,
        awaitData: true,
        oplogReplay: true,
        noCursorTimeout: true,
        numberOfRetries: Number.MAX_VALUE
      });
      
      return self.rawStream = q.stream();
    });
    
  }
  
  getFilteredStream(opts: OplogStrmFilter) {
    
    const t = new Transform({
      objectMode: true,
      readableObjectMode: true,
      writableObjectMode: true,
      transform(chunk, encoding, cb) {
        this.push(chunk);
        cb();
      },
      flush(cb) {
        cb();
      }
    });
    
    this.transformStreams.push(t);
    return t;
  }
  
  getRawStream() {
    if (this.rawStream) {
      return this.rawStream;
    }
    throw new Error('You need to await the result of tail(), before requesting access to raw stream.')
  }
  
  getReadableStream(filter?: Partial<OplogStrmFilter>) {
    
    if (filter) {
      if (filter.events) {
        assert(Array.isArray(filter.events), 'filter.events must be an array');
        filter.events.forEach(function (v) {
          assert(v)
        });
      }
    }
    
    const readableStream = new Readable({
      read(size) {
        return false;
      }
    });
    
    this.readableStreams.push({filter: filter || {}, strm: readableStream});
    return readableStream;
  }
  
  tail(cb?: ErrorFirstCB): Promise<any> {
    
    if (this.isTailing) {
      return Promise.resolve(true);
    }
    
    this.isTailing = true;
    const self = this;
    
    return this.connect()
    .then(function () {
      return self.stop();  // if we are already tailing, then stop
    })
    .then(function () {
      return self.getStream();
    })
    .catch(function (err) {
      self.isTailing = false;
      cb && cb(err);
      return Promise.reject(err);
    })
    .then(function (s) {
      
      cb && cb();
      
      s.once('end', function (v: any) {
        self.handleOplogEnd(v);
      });
      
      s.on('data', function (v: any) {
        self.handleOplogData(v);
      });
      
      s.on('error', function (e: Error) {
        self.handleOplogError(e);
      });
      
    });
    
  }
  
  stop(): Promise<any> {
    
    if (!this.rawStream) {
      return Promise.resolve(null);
    }
    
    let t;
    while (t = this.transformStreams.pop()) {
      t.push(null);
      t.end();
      t.destroy();
    }
    
    while (t = this.readableStreams.pop()) {
      t.strm.push(null);
      t.strm.destroy();
    }
    
    const self = this;
    return this.rawStream.close().then(function () {
      return self.rawStream.destroy();
    });
  }
  
  close() {
    return this.stop();
  }
  
}

export const create = function (opts: OplogObservableOpts, mongoOpts: any) {
  return new ObservableOplog(opts, mongoOpts);
};