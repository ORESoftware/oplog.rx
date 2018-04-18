'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var stream_1 = require("stream");
var mongodb_1 = require("mongodb");
var rxjs_1 = require("rxjs");
var EventEmitter = require("events");
var MONGO_URI = 'mongodb://127.0.0.1:27017/local';
var helpers = require("./lib/helper");
var log = {
    info: console.log.bind(console, '[oplog.rx]'),
    error: console.error.bind(console, '[oplog.rx]'),
};
var helper_1 = require("./lib/helper");
exports.getOplogStreamInterpreter = helper_1.getOplogStreamInterpreter;
var helper_2 = require("./lib/helper");
exports.oplogStreamInterpreter = helper_2.getOplogStreamInterpreter;
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
            end: new rxjs_1.Subject(),
            del: null
        };
        this.transformStreams = [];
        this.readableStreams = [];
        opts = opts || {};
        if (opts.query && (opts.ts || opts.namespace || opts.ns || opts.timestamp)) {
            throw new Error('if the "query" option is supplied, then "ns", "timestamp", "namespace", and "ts" are redundant.');
        }
        if (opts.ts && opts.timestamp) {
            throw new Error('Cannot use both "timestamp" and "ts" options - pick one.');
        }
        if (opts.ns && opts.namespace) {
            throw new Error('Cannot use both "namespace" and "ns" options - pick one.');
        }
        this.ops.del = this.ops.delete;
        this.query = opts.query || opts.q;
        this.ts = opts.ts || opts.timestamp;
        this.uri = opts.uri || MONGO_URI;
        this.ns = opts.ns || opts.namespace;
        this.mongoOpts = mongoOpts || {};
    }
    ObservableOplog.prototype.getOps = function () {
        return this.ops;
    };
    ObservableOplog.prototype.getEmitter = function () {
        return this.emitter;
    };
    ObservableOplog.prototype.connect = function () {
        var self = this;
        debugger;
        if (this.client && this.client.isConnected('xxx')) {
            log.info('MongoClient was already connected.');
            return Promise.resolve(null);
        }
        return mongodb_1.MongoClient.connect(this.uri).then(function (client) {
            var db = client.db('local');
            self.client = client;
            self.coll = db.collection('oplog.rs');
            return null;
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
            t.end();
        });
        this.readableStreams.forEach(function (r) {
            r.strm.destroy();
        });
    };
    ;
    ObservableOplog.prototype.handleOplogData = function (v) {
        if (!v) {
            log.error('Unexpected error: empty changeStream event data [1].');
            return;
        }
        if (!v.op) {
            log.error('Unexpected error: "op" field was not defined on data object. [1].');
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
            log.error('"op" filed does not appear to be in [i,u,d]');
            this.ops.all.next({ type: 'unknown', value: v });
            return;
        }
        this.emitter.emit(type, v);
        this.ops[type].next(v);
    };
    ObservableOplog.prototype.getTime = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ts, coll;
            return __generator(this, function (_a) {
                ts = this.ts;
                coll = this.coll;
                return [2, helpers.getValidTimestamp(ts, coll)];
            });
        });
    };
    ObservableOplog.prototype.getStream = function () {
        var query = {
            $and: [
                { op: { $ne: 'n' } },
                { op: { $ne: 'c' } }
            ]
        };
        if (this.query) {
            if (this.query.$and) {
                assert(Array.isArray(this.query.$and), 'Your $and clause in your query is not an array.');
                this.query.$and = this.query.$and.concat(query.$and);
            }
            else {
                this.query.$and = query.$and.slice(0);
            }
        }
        var coll = this.coll;
        var ns = this.ns;
        if (ns) {
            query.ns = ns;
        }
        var self = this;
        return this.getTime().then(function (t) {
            query.ts = { $gt: t };
            if (self.query) {
                log.info('using a custom query:', JSON.stringify(self.query));
            }
            var q = self.rawCursor = coll.find(self.query || query)
                .addCursorFlag('tailable', true)
                .addCursorFlag('awaitData', true)
                .addCursorFlag('noCursorTimeout', true)
                .addCursorFlag('oplogReplay', true)
                .setCursorOption('numberOfRetries', Number.MAX_VALUE)
                .setCursorOption('tailableRetryInterval', 200);
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
            return self.stop(true);
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
            s.once('end', function (v) {
                self.handleOplogEnd(v);
            });
            s.on('data', function (v) {
                self.handleOplogData(v);
            });
            s.on('error', function (e) {
                self.handleOplogError(e);
            });
            cb && cb();
        });
    };
    ObservableOplog.prototype.stop = function (isLog) {
        if (!this.rawStream) {
            !isLog && log.error('stop() called on a oplog instance that probably had not been initialized (was not already tailing).');
            return Promise.resolve(null);
        }
        !isLog && log.info('stop() called on oplog instance.');
        var t;
        while (t = this.transformStreams.pop()) {
            t.end();
            t.destroy();
        }
        while (t = this.readableStreams.pop()) {
            t.strm.destroy();
        }
        var self = this;
        return this.rawStream.close().then(function () {
            self.isTailing = false;
            !isLog && log.info('successfully stopped tailing the oplog.');
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
