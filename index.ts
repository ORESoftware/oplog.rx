'use strict';

import assert = require('assert');
import {Readable, Transform} from "stream";
import {ChangeStream, Collection, FindOneOptions, MongoClient, ServerOptions} from 'mongodb';
import {ReplaySubject, Subject} from "rxjs";
import {Timestamp} from "bson";
const MONGO_URI = 'mongodb://127.0.0.1:27017/local';
import * as JSONStdio from 'json-stdio';

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

export class ObservableOplog {
  
  private uri: string;
  private coll: Collection;
  collName: string;
  isTailing = false;
  
  private events = {
    all: new Subject<any>(),
    update: new Subject<Object>(),
    insert: new Subject<Object>(),
    delete: new Subject<Object>(),
    errors: new Subject<Object>(),
    end: new Subject<Object>()
  };
  
  
  private transformStreams : Array<Transform> = [];
  private changeStream: ChangeStream;
  
  private readableStreams: ReadableStrmWithFilter[] = [];
  
  constructor(opts: OplogObservableOpts, mongoOpts: any) {
    
    opts = opts || {} as any;
    this.uri = opts.uri || MONGO_URI;
    
    const self = this;
    
  }
  
  getEvents() {
    return this.events;
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
      
      return self.changeStream = q.stream();
    });
    
  }
  
  private getTransformStream2() {
    const t = JSONStdio.createParser();
    this.transformStreams.push(t);
    return t;
  }
  
  private getTransformStream(){
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
    const t = this.getTransformStream();
    if(this.changeStream){
      return this.changeStream.pipe(t);
    }
    return t;
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
      
      self.transformStreams.forEach(function(t){
          console.log('piping to transform stream');
          s.pipe(t);
      });
      
      s.once('end', function (v: any) {
        self.events.all.next({type: 'end', value: v || true});
        self.events.end.next(true);
        self.readableStreams.forEach(function (r) {
          return r.strm.push(null);
        });
      });
      
      s.on('data', function (v: any) {
        
        const type = evs[v.op];
        
        self.readableStreams.forEach(function (r) {
          
          if (!r.filter.events || r.filter.events.length < 1) {
            return r.strm.push(JSON.stringify(v) + '\n');
          }
          
          if (r.filter.events.includes(type as any)) {
            return r.strm.push(JSON.stringify(v) + '\n');
          }
          
        });
        
        if (!type) {
          // console.error('op type not recognized:', type, 'data:', v);
          self.events.all.next({type: 'unknown', value: v});
          return;
        }
        
        self.events[type].next(v);
        
      });
      
      s.on('error', function (e: Error) {
        self.events.all.next({type: 'error', value: e});
        self.events.errors.next(e);
      });
      
    });
    
  }
  
  stop(): Promise<any> {
    
    if (!this.changeStream) {
      return Promise.resolve(null);
    }
  
    let t;
    while(t = this.transformStreams.pop()){
      t.end();
      t.destroy();
    }
    
    const self = this;
    return this.changeStream.close().then(function () {
      return self.changeStream.destroy();
    });
  }
  
  close() {
  
  }
  
}

export const create = function (opts: OplogObservableOpts, mongoOpts: any) {
  return new ObservableOplog(opts, mongoOpts);
};