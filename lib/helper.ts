'use strict';

import {ObservableOplog, evs} from "../";
import {OplogInterpreter, OplogInterpreterOpts} from "./interfaces";
import {Subject} from "rxjs/Rx";
import {Stream} from "stream";
import {EventEmitter} from "events";

const log = {
  info: console.log.bind(console, '[oplog.rx]'),
  error: console.error.bind(console, '[oplog.rx]'),
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