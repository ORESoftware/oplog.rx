'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var stream_1 = require("stream");
var mongodb_1 = require("mongodb");
var rxjs_1 = require("rxjs");
var bson_1 = require("bson");
var EventEmitter = require("events");
var MONGO_URI = 'mongodb://127.0.0.1:27017/local';
var log = {
    info: console.log.bind(console, '[oplog.rx]'),
    error: console.error.bind(console, '[oplog.rx]'),
};
var helper_1 = require("./lib/helper");
exports.getOplogStreamInterpreter = helper_1.getOplogStreamInterpreter;
exports.regex = function (pattern) {
    pattern = pattern || '*';
    pattern = pattern.replace(/[*]/g, '(.*?)');
    return new RegExp("^" + pattern + "$", 'i');
};
exports.evs = {
    i: 'insert',
    u: 'update',
    d: 'delete'
};
var ObservableOplog = (function () {
    function ObservableOplog(opts, mongoOpts) {
        this.isTailing = false;
        this.emitter = new EventEmitter();
        this.ops = {
            all: new rxjs_1.Subject(),
            update: new rxjs_1.Subject(),
            insert: new rxjs_1.Subject(),
            delete: new rxjs_1.Subject(),
            errors: new rxjs_1.Subject(),
            end: new rxjs_1.Subject()
        };
        this.transformStreams = [];
        this.readableStreams = [];
        opts = opts || {};
        this.uri = opts.uri || MONGO_URI;
        this.mongoOpts = mongoOpts || {};
    }
    ObservableOplog.prototype.getEvents = function () {
        return this.ops;
    };
    ObservableOplog.prototype.getOps = function () {
        return this.ops;
    };
    ObservableOplog.prototype.getEmitter = function () {
        return this.emitter;
    };
    ObservableOplog.prototype.connect = function () {
        var self = this;
        return mongodb_1.MongoClient.connect(this.uri).then(function (client) {
            var db = client.db('local');
            self.coll = db.collection('oplog.rs');
        });
    };
    ObservableOplog.prototype.handleOplogError = function (e) {
        this.ops.all.next({ type: 'error', value: e });
        this.ops.errors.next(e);
    };
    ObservableOplog.prototype.handleOplogEnd = function (v) {
        this.ops.all.next({ type: 'end', value: v || true });
        this.ops.end.next(true);
        this.transformStreams.forEach(function (t) {
            t.write(null);
        });
        this.readableStreams.forEach(function (r) {
            return r.strm.push(null);
        });
    };
    ;
    ObservableOplog.prototype.handleOplogData = function (v) {
        if (!v) {
            log.error('Unexpected error: empty changeStream event data [1].');
            return;
        }
        var type = exports.evs[v.op];
        this.transformStreams.forEach(function (t) {
            t.write(v);
        });
        this.readableStreams.forEach(function (r) {
            if (!r.filter.events || r.filter.events.length < 1) {
                return r.strm.push(JSON.stringify(v) + '\n');
            }
            if (r.filter.events.includes(type)) {
                return r.strm.push(JSON.stringify(v) + '\n');
            }
        });
        if (!type) {
            this.ops.all.next({ type: 'unknown', value: v });
            return;
        }
        this.emitter.emit(type, v);
        this.ops[type].next(v);
    };
    ObservableOplog.prototype.getTime = function () {
        var ts = this.ts;
        var coll = this.coll;
        if (ts) {
            throw new Error('whoops');
            return Promise.resolve((typeof ts !== 'number') ? ts : new bson_1.Timestamp(0, ts));
        }
        var q = coll.findOne({}, { ts: 1 });
        return q.then(function (doc) {
            return doc ? doc.ts : new bson_1.Timestamp(0, (Date.now() / 1000 | 0));
        });
    };
    ObservableOplog.prototype.getStream = function () {
        var query = {
            $and: [
                { op: { $ne: 'n' } },
                { op: { $ne: 'c' } }
            ]
        };
        var coll = this.coll;
        var ns = this.ns;
        if (ns) {
            query.ns = { $regex: exports.regex(ns) };
        }
        var self = this;
        return this.getTime().then(function (t) {
            query.ts = { $gt: t };
            var q = coll.find(query, {
                tailable: true,
                awaitData: true,
                oplogReplay: true,
                noCursorTimeout: true,
                numberOfRetries: Number.MAX_VALUE
            });
            return self.rawStream = q.stream();
        });
    };
    ObservableOplog.prototype.getFilteredStream = function (opts) {
        var t = new stream_1.Transform({
            objectMode: true,
            readableObjectMode: true,
            writableObjectMode: true,
            transform: function (chunk, encoding, cb) {
                this.push(chunk);
                cb();
            },
            flush: function (cb) {
                cb();
            }
        });
        this.transformStreams.push(t);
        return t;
    };
    ObservableOplog.prototype.getRawStream = function () {
        if (this.rawStream) {
            return this.rawStream;
        }
        throw new Error('You need to await the result of tail(), before requesting access to raw stream.');
    };
    ObservableOplog.prototype.getReadableStream = function (filter) {
        if (filter) {
            if (filter.events) {
                assert(Array.isArray(filter.events), 'filter.events must be an array');
                filter.events.forEach(function (v) {
                    assert(v);
                });
            }
        }
        var readableStream = new stream_1.Readable({
            read: function (size) {
                return false;
            }
        });
        this.readableStreams.push({ filter: filter || {}, strm: readableStream });
        return readableStream;
    };
    ObservableOplog.prototype.tail = function (cb) {
        if (this.isTailing) {
            return Promise.resolve(true);
        }
        this.isTailing = true;
        var self = this;
        return this.connect()
            .then(function () {
            return self.stop();
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
            s.once('end', function (v) {
                self.handleOplogEnd(v);
            });
            s.on('data', function (v) {
                self.handleOplogData(v);
            });
            s.on('error', function (e) {
                self.handleOplogError(e);
            });
        });
    };
    ObservableOplog.prototype.stop = function () {
        if (!this.rawStream) {
            return Promise.resolve(null);
        }
        var t;
        while (t = this.transformStreams.pop()) {
            t.push(null);
            t.end();
            t.destroy();
        }
        while (t = this.readableStreams.pop()) {
            t.strm.push(null);
            t.strm.destroy();
        }
        var self = this;
        return this.rawStream.close().then(function () {
            return self.rawStream.destroy();
        });
    };
    ObservableOplog.prototype.close = function () {
        return this.stop();
    };
    return ObservableOplog;
}());
exports.ObservableOplog = ObservableOplog;
exports.create = function (opts, mongoOpts) {
    return new ObservableOplog(opts, mongoOpts);
};
