'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var _1 = require("../");
var Rx_1 = require("rxjs/Rx");
var events_1 = require("events");
var log = {
    info: console.log.bind(console, '[oplog.rx]'),
    error: console.error.bind(console, '[oplog.rx]'),
};
exports.getOplogStreamInterpreter = function (s, opts) {
    opts = opts || { useEmitter: true, useObservers: true };
    var ret = {
        ops: opts.useObservers && {
            all: new Rx_1.Subject(),
            update: new Rx_1.Subject(),
            insert: new Rx_1.Subject(),
            delete: new Rx_1.Subject(),
            errors: new Rx_1.Subject(),
            end: new Rx_1.Subject(),
        },
        emitter: opts.useEmitter && new events_1.EventEmitter()
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
        var type = _1.evs[v.op];
        if (type) {
            ret.emitter.emit(type, v);
            ret.ops[type].next(v);
        }
    });
    return ret;
};
