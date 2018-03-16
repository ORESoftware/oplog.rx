'use strict';

import {Readable} from "stream";
import {Collection, MongoClient, ServerOptions} from 'mongodb';
import {ReplaySubject, Subject} from "rxjs";
import {Timestamp} from "bson";
const MONGO_URI = 'mongodb://127.0.0.1:27017/local';

export interface OplogObservableOpts {
  uri: string,
  url: string,
  collName: string;
}

export const regex = function (pattern: string) {
  pattern = pattern || '*';
  pattern = pattern.replace(/[*]/g, '(.*?)');
  return new RegExp(`^${pattern}$`, 'i')
};

const events = {
  i: 'insert',
  u: 'update',
  d: 'delete'
};

export class OplogObservable {
  
  private uri: string;
  private coll: Collection;
  collName: string;
  isTailing = false;
  
  events = {
    all: new Subject<any>(),
    update: new Subject<Object>(),
    insert: new Subject<Object>(),
    delete: new Subject<Object>(),
    errors: new Subject<Object>(),
    end: new Subject<Object>()
  };
  
  // private internalEvs: Array<string> = [];
  private readableStream: Readable;
  
  constructor(opts: OplogObservableOpts, mongoOpts: any) {
    
    opts = opts || {} as any;
    this.uri = opts.uri || MONGO_URI;
    
    const self = this;
    
    // this.readableStream = new Readable({
    //   read(size) {
    //     return true;
    //   }
    // });
  
    this.readableStream = new Readable({
      read(size) {
        return true;
      }
    });
    
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
    
    debugger;
    const q = coll.findOne({}, {ts: 1});
    
    return q.then(function (doc) {
      return doc ? doc.ts : new Timestamp(0, (Date.now() / 1000 | 0))
    });
    
  }
  
  private getStream() {
    
    const query = {}, coll = this.coll, ns = this.ns;
    
    if (ns) {
      query.ns = {$regex: regex(ns)};
    }
    
    return this.getTime().then(function (t) {
      
      query.ts = {$gt: t};
      
      const q = coll.find(query, {
        tailable: true,
        awaitData: true,
        oplogReplay: true,
        noCursorTimeout: true,
        numberOfRetries: Number.MAX_VALUE
      });
      
      debugger;
      
      return q.stream();
    });
    
  }
  
  getReadableStream() {
    return this.readableStream;
  }
  
  tail() {
    
    if (this.isTailing) {
      return Promise.resolve(true);
    }
    
    this.isTailing = true;
    
    const self = this;
    const readable = this.readableStream;
    return this.connect().then(function () {
      return self.getStream();
    })
    .catch(function (err) {
      self.isTailing = false;
      return Promise.reject(err);
    })
    .then(function (s) {
      
      s.once('end', function (v) {
        self.events.all.next({type: 'end', value: true});
        self.events.end.next(true);
      });
      
      s.on('data', function (v: any, x: any) {
        
        debugger;
        
        const type = events[v.op] as 'update' | 'insert' | 'delete';
        self.readableStream.push(JSON.stringify(v) + '\n');
        
        if (!type) {
          // console.error('op type not recognized:', type, 'data:', v);
          self.events.all.next({type: 'unknown', value: v});
          return;
        }
        
        self.events[type].next(v);
      });
      
      s.on('error', function (e) {
        self.events.all.next({type: 'error', value: e});
        self.events.errors.next(e);
      });
      
    });
    
  }
  
  stop() {
  
  }
  
  close() {
  
  }
  
}

export const create = function (opts: OplogObservableOpts, mongoOpts: any) {
  return new OplogObservable(opts, mongoOpts);
};