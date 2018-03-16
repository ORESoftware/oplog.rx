'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var stream_1 = require("stream");
var mongodb_1 = require("mongodb");
var rxjs_1 = require("rxjs");
var bson_1 = require("bson");
var MONGO_URI = 'mongodb://127.0.0.1:27017/local';
exports.regex = function (pattern) {
    pattern = pattern || '*';
    pattern = pattern.replace(/[*]/g, '(.*?)');
    return new RegExp("^" + pattern + "$", 'i');
};
var events = {
    i: 'insert',
    u: 'update',
    d: 'delete'
};
var OplogObservable = (function () {
    function OplogObservable(opts, mongoOpts) {
        this.isTailing = false;
        this.events = {
            all: new rxjs_1.Subject(),
            update: new rxjs_1.Subject(),
            insert: new rxjs_1.Subject(),
            delete: new rxjs_1.Subject(),
            errors: new rxjs_1.Subject(),
            end: new rxjs_1.Subject()
        };
        opts = opts || {};
        this.uri = opts.uri || MONGO_URI;
        var self = this;
        this.readableStream = new stream_1.Readable({
            read: function (size) {
                return true;
            }
        });
    }
    OplogObservable.prototype.connect = function () {
        var self = this;
        return mongodb_1.MongoClient.connect(this.uri).then(function (client) {
            var db = client.db('local');
            self.coll = db.collection('oplog.rs');
        });
    };
    OplogObservable.prototype.getTime = function () {
        var ts = this.ts;
        var coll = this.coll;
        if (ts) {
            return Promise.resolve((typeof ts !== 'number') ? ts : new bson_1.Timestamp(0, ts));
        }
        debugger;
        var q = coll.findOne({}, { ts: 1 });
        return q.then(function (doc) {
            return doc ? doc.ts : new bson_1.Timestamp(0, (Date.now() / 1000 | 0));
        });
    };
    OplogObservable.prototype.getStream = function () {
        var query = {}, coll = this.coll, ns = this.ns;
        if (ns) {
            query.ns = { $regex: exports.regex(ns) };
        }
        return this.getTime().then(function (t) {
            query.ts = { $gt: t };
            var q = coll.find(query, {
                tailable: true,
                awaitData: true,
                oplogReplay: true,
                noCursorTimeout: true,
                numberOfRetries: Number.MAX_VALUE
            });
            debugger;
            return q.stream();
        });
    };
    OplogObservable.prototype.getReadableStream = function () {
        return this.readableStream;
    };
    OplogObservable.prototype.tail = function () {
        if (this.isTailing) {
            return Promise.resolve(true);
        }
        this.isTailing = true;
        var self = this;
        var readable = this.readableStream;
        return this.connect().then(function () {
            return self.getStream();
        })
            .catch(function (err) {
            self.isTailing = false;
            return Promise.reject(err);
        })
            .then(function (s) {
            s.once('end', function (v) {
                self.events.all.next({ type: 'end', value: true });
                self.events.end.next(true);
            });
            s.on('data', function (v, x) {
                debugger;
                var type = events[v.op];
                self.readableStream.push(JSON.stringify(v) + '\n');
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
    OplogObservable.prototype.stop = function () {
    };
    OplogObservable.prototype.close = function () {
    };
    return OplogObservable;
}());
exports.OplogObservable = OplogObservable;
exports.create = function (opts, mongoOpts) {
    return new OplogObservable(opts, mongoOpts);
};
