'use strict';

import assert = require('assert');
import {Readable, Stream, Transform} from "stream";
import {ChangeStream, Collection, Cursor, MongoClient, ObjectId} from 'mongodb';
import {Subject} from "rxjs";
import {Timestamp} from "bson";
import EventEmitter = require('events');
const MONGO_URI = 'mongodb://127.0.0.1:27017/local';
import helpers = require('./lib/helper');

import {
  OplogInterpreter,
  OplogInterpreterOpts,
  ReadableStrmWithFilter,
  SubjectMap,
  OplogQuery,
  OplogStrmFilter, OplogObservableOpts, ObservableOplogTimestamp, OplogNamespace, OplogDoc
} from "./lib/interfaces";


export {OplogDoc} from './lib/interfaces';

const log = {
  info: console.log.bind(console, '[oplog.rx]'),
  error: console.error.bind(console, '[oplog.rx]'),
};



export {getOplogStreamInterpreter} from './lib/helper';
export {getOplogStreamInterpreter as oplogStreamInterpreter} from './lib/helper';

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
  private client: MongoClient;
  private ns: OplogNamespace;
  private query: any;
  
  private ops = <SubjectMap>{
    all: new Subject<any>(),
    update: new Subject<Object>(),
    insert: new Subject<Object>(),
    delete: new Subject<Object>(),
    errors: new Subject<Object>(),
    end: new Subject<Object>(),
    del: null as Subject<Object>
  };
  
  private rawCursor: Cursor;
  private mongoOpts: any;
  private transformStreams: Array<Transform> = [];
  private rawStream: ChangeStream;
  private readableStreams: ReadableStrmWithFilter[] = [];
  
  constructor(opts?: OplogObservableOpts, mongoOpts?: any) {
    opts = opts || {} as any;
    
    if (opts.query && (opts.ts || opts.namespace || opts.ns || opts.timestamp)) {
      throw new Error('if the "query" option is supplied, then "ns", "timestamp", "namespace", and "ts" are redundant.');
    }
    
    if (opts.ts && opts.timestamp) {
      throw new Error('Cannot use both "timestamp" and "ts" options - pick one.');
    }
    
    if (opts.ns && opts.namespace) {
      throw new Error('Cannot use both "namespace" and "ns" options - pick one.');
    }
    
    this.ops.del = this.ops.delete;  // create alias
    this.query = opts.query || opts.q;
    this.ts = opts.ts || opts.timestamp;
    this.uri = opts.uri || MONGO_URI;
    this.ns = opts.ns || opts.namespace;
    this.mongoOpts = mongoOpts || {};
  }
  
  getOps() {
    return this.ops;
  }
  
  getEmitter() {
    return this.emitter;
  }
  
  connect(): Promise<null> {
    const self = this;
    
    debugger;
    
    if (this.client && this.client.isConnected('xxx')) {
      log.info('MongoClient was already connected.');
      return Promise.resolve(null);
    }
    
    return MongoClient.connect(this.uri).then(function (client) {
      const db = client.db('local');
      // db.oplog.rs.find()
      self.client = client;
      self.coll = db.collection('oplog.rs');
      return null;
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
  
  private handleOplogData(v: OplogDoc) {
    
    if (!v) {
      log.error('Unexpected error: empty changeStream event data [1].');
      return;
    }
  
    if (!v.op) {
      log.error('Unexpected error: "op" field was not defined on data object. [1].');
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
      log.error('"op" filed does not appear to be in [i,u,d]')
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
    
    const query = <OplogQuery> {
      // we don't want op to be either n or c
      $and: [
        {op: {$ne: 'n'}},
        {op: {$ne: 'c'}}
      ]
    };
    
    if (this.query) {
      if (this.query.$and) {
        assert(Array.isArray(this.query.$and), 'Your $and clause in your query is not an array.');
        this.query.$and = this.query.$and.concat(query.$and);
      }
      else {
        this.query.$and = query.$and.slice(0);
      }
    }
    
    const coll = this.coll;
    const ns = this.ns;
    
    if (ns) {
      query.ns = ns;
    }
    
    const self = this;
    
    return this.getTime().then(function (t) {
      
      query.ts = {$gt: t};
      
      // const q = coll.find(query, {
      //   // raw: true,
      //   tailable: true,
      //   awaitData: true,
      //   oplogReplay: true,
      //   noCursorTimeout: true,
      //   numberOfRetries: Number.MAX_VALUE
      // });
      
      // const q2 = coll.find(query).addOption();
      
      if (self.query) {
        log.info('using a custom query:', JSON.stringify(self.query));
      }
      
      const q = self.rawCursor = coll.find(self.query || query)
      .addCursorFlag('tailable', true)
      .addCursorFlag('awaitData', true)  // true or false?
      .addCursorFlag('noCursorTimeout', true)
      .addCursorFlag('oplogReplay', true)
      .setCursorOption('numberOfRetries', Number.MAX_VALUE)
      .setCursorOption('tailableRetryInterval', 200);
      
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
      return self.stop(true);  // if we are already tailing, then stop
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
      
      s.once('end', function (v: any) {
        self.handleOplogEnd(v);
      });
      
      s.on('data', function (v: OplogDoc) {
        self.handleOplogData(v);
      });
      
      s.on('error', function (e: Error) {
        self.handleOplogError(e);
      });
      
      cb && cb();
      
    });
    
  }
  
  stop(isLog?: boolean): Promise<any> {
    
    if (!this.rawStream) {
      !isLog && log.error('stop() called on a oplog instance that probably had not been initialized (was not already tailing).');
      return Promise.resolve(null);
    }
    
    !isLog && log.info('stop() called on oplog instance.');
    
    let t;
    while (t = this.transformStreams.pop()) {
      // t.push(null);
      t.end();
      t.destroy();
    }
    
    while (t = this.readableStreams.pop()) {
      // t.strm.push(null);
      t.strm.destroy();
    }
    
    const self = this;
    return this.rawStream.close().then(function () {
      self.isTailing = false;
      !isLog && log.info('successfully stopped tailing the oplog.');
      return self.rawStream.destroy();
    });
  }
  
  close() {
    return this.stop();
  }
  
}

export const create = function (opts?: OplogObservableOpts, mongoOpts?: any) {
  return new ObservableOplog(opts, mongoOpts);
};