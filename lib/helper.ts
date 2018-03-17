'use strict';

import {ObservableOplog, evs} from "../";
import {OplogInterpreter, OplogInterpreterOpts} from "./interfaces";
import {Subject} from "rxjs/Rx";
import {Stream} from "stream";
import {EventEmitter} from "events";
import {Timestamp} from "bson";
import {Collection} from "mongodb";

const log = {
  info: console.log.bind(console, '[oplog.rx]'),
  error: console.error.bind(console, '[oplog.rx]'),
};


export const getValidTimestamp = function (ts: any, coll: Collection) : Timestamp{
  
  if (ts && ts instanceof Timestamp) {
    log.info('using timestamp instance:', JSON.stringify(ts));
    return ts;
  }
  else if (ts && ts._bsontype === 'Timestamp' && typeof ts.low_ === 'number' && typeof ts.high_ === 'number') {
    log.info('using pseudo timestamp instance:', JSON.stringify(ts));
    return Timestamp.fromBits(ts.low_, ts.high_);
  }
  else if (ts && typeof ts.low === 'number' && typeof ts.high === 'number') {
    log.info('using pseudo timestamp instance:', JSON.stringify(ts));
    return Timestamp.fromBits(ts.low, ts.high);
  }
  else if (ts && typeof ts.$timestamp === 'string') {
    log.info('using POJO timestamp instance:', JSON.stringify(ts));
    return Timestamp.fromString(ts.$timestamp);
  }
  else if (ts) {
    throw new Error('"ts" field needs to be an instance of Timestamp.');
  }
  
  log.info('using internal timestamp instance representing the current time.');
  return new Timestamp(1, Math.ceil(Date.now() / 1000));
  
  // return Promise.resolve(new Timestamp(0,));
  
  // if (ts) {
  //   throw new Error('whoops');
  //   return Promise.resolve((typeof ts !== 'number') ? ts : new Timestamp(0, ts));
  // }
  //
  // const q = coll.findOne({}, {ts: 1});
  //
  // return q.then(function (doc) {
  //   return doc ? doc.ts : new Timestamp(0, (Date.now() / 1000 | 0))
  // });
  
  // find the most recent document in the oplog
  // const q = coll.findOne({}, { sort: { ts: -1 }, limit: 1 });
  //
  // return q.then(function (doc) {
  //   return doc ? doc.ts : new Timestamp(1, Math.ceil(Date.now()/1000));
  // });
};

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