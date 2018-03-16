'use strict';

import assert = require('assert');
import {Readable, Stream, Transform} from "stream";
import {ChangeStream, Collection, FindOneOptions, MongoClient, ServerOptions} from 'mongodb';
import {ReplaySubject, Subject} from "rxjs";
import {Timestamp} from "bson";
const MONGO_URI = 'mongodb://127.0.0.1:27017/local';
import * as JSONStdio from 'json-stdio';
const FilterTransform = require('./filter-strm');
import {FilterStream} from './filter-strm';
import EventEmitter = require('events');

const log = {
  info: console.log.bind(console, '[oplog.rx]'),
  error: console.error.bind(console, '[oplog.rx]'),
};

export interface OplogObservableOpts {
  uri: string,
  url: string,
  collName: string;
}

export interface OplogStrmFilter {
  events?: Array<'update' | 'insert' | 'delete'>
  namespace?: string,
  ns?: string
}

// *Open A Change Stream*
// You can only open a change stream against replica sets or sharded clusters.
// For a sharded cluster, you must issue the open change stream operation against the mongos.
// https://docs.mongodb.com/manual/changeStreams/

export const regex = function (pattern: string) {
  pattern = pattern || '*';
  pattern = pattern.replace(/[*]/g, '(.*?)');
  return new RegExp(`^${pattern}$`, 'i')
};

interface EventsSignature {
  [key: string]: string,
  i: 'insert',
  u: 'update',
  d: 'delete'
}

const evs = <EventsSignature>{
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
  ops?: {
    all: Subject<any>,
    update: Subject<Object>,
    insert: Subject<Object>,
    delete: Subject<Object>,
    errors: Subject<Object>,
    end: Subject<Object>
  },
  emitter?: EventEmitter
}

export const getOplogStreamInterpreter = function (s: Stream, opts?: OplogInterpreterOpts): OplogInterpreter {
  
  opts = opts || {useEmitter: true, useObservers: true};
  
  const ret = {
    ops: opts.useObservers && {
      all: new Subject<any>(),
      update: new Subject<Object>(),
      insert: new Subject<Object>(),
      delete: new Subject<Object>(),
      errors: new Subject<Object>(),
      end: new Subject<Object>(),
    },
    emitter: opts.useEmitter && new EventEmitter()
  };
  
  s.on('error', function (e) {
    ret.emitter.emit('error', e);
    ret.ops.errors.next(e);
  });
  
  s.on('data', function (v) {
    
    if (!v) {
      log.error('Unexpected error: empty changeStream event data [2].');
      return;
    }
    
    ret.ops.all.next(v);
    
    const type = evs[v.op];
    
    if (type) {
      ret.emitter.emit(type, v);
      ret.ops[type].next(v);
    }
    
  });
  
  return ret;
};

export class ObservableOplog {
  
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
    this.uri = opts.uri || MONGO_URI;
    this.mongoOpts = mongoOpts || {};
  }
  
  getEvents() {
    return this.ops;
  }
  
  getOps() {
    return this.ops;
  }
  
  getEmitter(){
    return this.emitter;
  }
  
  connect() {
    const self = this;
    return MongoClient.connect(this.uri).then(function (client) {
      const db = client.db('local');
      self.coll = db.collection('oplog.rs');
    });
  }
  
  private getTime(): Promise<Timestamp> {
    
    const ts = this.ts;
    const coll = this.coll;
    
    if (ts) {
      return Promise.resolve((typeof ts !== 'number') ? ts : new Timestamp(0, ts));
    }
    
    const q = coll.findOne({}, {ts: 1});
    
    return q.then(function (doc) {
      return doc ? doc.ts : new Timestamp(0, (Date.now() / 1000 | 0))
    });
    
  }
  
  private getStream(): Promise<ChangeStream> {
    
    const query = {}, coll = this.coll, ns = this.ns;
    
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
  
  tail(): Promise<any> {
    
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
      return Promise.reject(err);
    })
    .then(function (s) {
      
      s.once('end', function (v: any) {
        self.ops.all.next({type: 'end', value: v || true});
        self.ops.end.next(true);
        
        self.transformStreams.forEach(function (t) {
          t.write(null);
        });
        
        self.readableStreams.forEach(function (r) {
          return r.strm.push(null);
        });
      });
      
      s.on('data', function (v: any) {
        
        if (!v) {
          log.error('Unexpected error: empty changeStream event data [1].');
          return;
        }
        
        const type = evs[v.op];
        
        self.transformStreams.forEach(function (t) {
          t.write(v);
        });
        
        self.readableStreams.forEach(function (r) {
          
          if (!r.filter.events || r.filter.events.length < 1) {
            return r.strm.push(JSON.stringify(v) + '\n');
          }
          
          if (r.filter.events.includes(type as any)) {
            return r.strm.push(JSON.stringify(v) + '\n');
          }
        });
        
        if (!type) {
          self.ops.all.next({type: 'unknown', value: v});
          return;
        }
        
        self.emitter.emit(type, v);
        self.ops[type].next(v);
        
      });
      
      s.on('error', function (e: Error) {
        self.ops.all.next({type: 'error', value: e});
        self.ops.errors.next(e);
      });
      
    });
    
  }
  
  stop(): Promise<any> {
    
    if (!this.rawStream) {
      return Promise.resolve(null);
    }
    
    let t;
    while (t = this.transformStreams.pop()) {
      t.end();
      t.destroy();
    }
    
    const self = this;
    return this.rawStream.close().then(function () {
      return self.rawStream.destroy();
    });
  }
  
  close() {
  
  }
  
}

export const create = function (opts: OplogObservableOpts, mongoOpts: any) {
  return new ObservableOplog(opts, mongoOpts);
};