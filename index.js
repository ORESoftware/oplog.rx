'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var stream_1 = require("stream");
var mongodb_1 = require("mongodb");
var rxjs_1 = require("rxjs");
var bson_1 = require("bson");
var MONGO_URI = 'mongodb://127.0.0.1:27017/local';
var JSONStdio = require("json-stdio");
exports.regex = function (pattern) {
    pattern = pattern || '*';
    pattern = pattern.replace(/[*]/g, '(.*?)');
    return new RegExp("^" + pattern + "$", 'i');
};
var evs = {
    i: 'insert',
    u: 'update',
    d: 'delete'
};
var ObservableOplog = (function () {
    function ObservableOplog(opts, mongoOpts) {
        this.isTailing = false;
        this.events = {
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
        var self = this;
    }
    ObservableOplog.prototype.getEvents = function () {
        return this.events;
    };
    ObservableOplog.prototype.connect = function () {
        var self = this;
        return mongodb_1.MongoClient.connect(this.uri).then(function (client) {
            var db = client.db('local');
            self.coll = db.collection('oplog.rs');
        });
    };
    ObservableOplog.prototype.getTime = function () {
        var ts = this.ts;
        var coll = this.coll;
        if (ts) {
            return Promise.resolve((typeof ts !== 'number') ? ts : new bson_1.Timestamp(0, ts));
        }
        var q = coll.findOne({}, { ts: 1 });
        return q.then(function (doc) {
            return doc ? doc.ts : new bson_1.Timestamp(0, (Date.now() / 1000 | 0));
        });
    };
    ObservableOplog.prototype.getStream = function () {
        var query = {}, coll = this.coll, ns = this.ns;
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
            return self.changeStream = q.stream();
        });
    };
    ObservableOplog.prototype.getTransformStream2 = function () {
        var t = JSONStdio.createParser();
        this.transformStreams.push(t);
        return t;
    };
    ObservableOplog.prototype.getTransformStream = function () {
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
        var t = this.getTransformStream();
        if (this.changeStream) {
            return this.changeStream.pipe(t);
        }
        return t;
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
    ObservableOplog.prototype.tail = function () {
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
            return Promise.reject(err);
        })
            .then(function (s) {
            self.transformStreams.forEach(function (t) {
                console.log('piping to transform stream');
                s.pipe(t);
            });
            s.once('end', function (v) {
                self.events.all.next({ type: 'end', value: v || true });
                self.events.end.next(true);
                self.readableStreams.forEach(function (r) {
                    return r.strm.push(null);
                });
            });
            s.on('data', function (v) {
                var type = evs[v.op];
                self.readableStreams.forEach(function (r) {
                    if (!r.filter.events || r.filter.events.length < 1) {
                        return r.strm.push(JSON.stringify(v) + '\n');
                    }
                    if (r.filter.events.includes(type)) {
                        return r.strm.push(JSON.stringify(v) + '\n');
                    }
                });
                if (!type) {
                    self.events.all.next({ type: 'unknown', value: v });
                    return;
                }
                self.events[type].next(v);
            });
            s.on('error', function (e) {
                self.events.all.next({ type: 'error', value: e });
                self.events.errors.next(e);
            });
        });
    };
    ObservableOplog.prototype.stop = function () {
        if (!this.changeStream) {
            return Promise.resolve(null);
        }
        var t;
        while (t = this.transformStreams.pop()) {
            t.end();
            t.destroy();
        }
        var self = this;
        return this.changeStream.close().then(function () {
            return self.changeStream.destroy();
        });
    };
    ObservableOplog.prototype.close = function () {
    };
    return ObservableOplog;
}());
exports.ObservableOplog = ObservableOplog;
exports.create = function (opts, mongoOpts) {
    return new ObservableOplog(opts, mongoOpts);
};
