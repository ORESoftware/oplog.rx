'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var _1 = require("../");
var rxjs_1 = require("rxjs");
var events_1 = require("events");
var bson_1 = require("bson");
var log = {
    info: console.log.bind(console, '[oplog.rx]'),
    error: console.error.bind(console, '[oplog.rx]'),
};
exports.getValidTimestamp = function (ts, coll) {
    if (ts && ts instanceof bson_1.Timestamp) {
        log.info('using timestamp instance:', JSON.stringify(ts));
        return ts;
    }
    else if (ts && ts._bsontype === 'Timestamp' && typeof ts.low_ === 'number' && typeof ts.high_ === 'number') {
        log.info('using pseudo timestamp instance:', JSON.stringify(ts));
        return bson_1.Timestamp.fromBits(ts.low_, ts.high_);
    }
    else if (ts && typeof ts.low === 'number' && typeof ts.high === 'number') {
        log.info('using pseudo timestamp instance:', JSON.stringify(ts));
        return bson_1.Timestamp.fromBits(ts.low, ts.high);
    }
    else if (ts && typeof ts.$timestamp === 'string') {
        log.info('using POJO timestamp instance:', JSON.stringify(ts));
        return bson_1.Timestamp.fromString(ts.$timestamp);
    }
    else if (ts) {
        throw new Error('"ts" field needs to be an instance of Timestamp.');
    }
    log.info('using internal timestamp instance representing the current time.');
    return new bson_1.Timestamp(1, Math.ceil(Date.now() / 1000));
};
exports.getOplogStreamInterpreter = function (s, opts) {
    opts = opts || { useEmitter: true, useObservers: true };
    var ret = {
        ops: {
            all: new rxjs_1.Subject(),
            update: new rxjs_1.Subject(),
            insert: new rxjs_1.Subject(),
            delete: new rxjs_1.Subject(),
            errors: new rxjs_1.Subject(),
            end: new rxjs_1.Subject(),
        },
        emitter: new events_1.EventEmitter()
    };
    ret.ops.del = ret.ops.delete;
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
        var type = _1.evs[v.op];
        if (type) {
            ret.emitter.emit(type, v);
            ret.ops[type].next(v);
        }
    });
    return ret;
};
