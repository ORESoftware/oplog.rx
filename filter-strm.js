'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var stream_1 = require("stream");
var Filter = (function (_super) {
    __extends(Filter, _super);
    function Filter(options) {
        var _this = _super.call(this, options) || this;
        _this._writableState.objectMode = true;
        _this._readableState.objectMode = true;
        var f = options.filter;
        if (typeof f == 'function') {
            _this._func = f;
        }
        else if (f instanceof RegExp) {
            _this._regexp = f;
            _this._func = _this._pattern;
        }
        else {
            _this._func = _this._allowAll;
        }
        _this._separator = options.separator || '.';
        _this._defaultValue = options.defaultValue || [{ name: 'nullValue', value: null }];
        _this._previous = [];
        _this._stack = [];
        _this._collectKey = false;
        _this._key = '';
        return _this;
    }
    Filter.prototype._transform = function (chunk, encoding, callback) {
        if (this._collectKey) {
            if (chunk.name === 'endKey') {
                this._collectKey = false;
                this._stack.pop();
                this._stack.push(this._key);
                this._key = '';
            }
            else {
                this._key += chunk.value;
            }
            callback();
            return;
        }
        switch (chunk.name) {
            case 'startKey':
                this._collectKey = true;
            case 'keyValue':
                callback();
                return;
            case 'startObject':
            case 'startArray':
            case 'startString':
            case 'startNumber':
            case 'nullValue':
            case 'trueValue':
            case 'falseValue':
                if (this._stack.length) {
                    var top = this._stack[this._stack.length - 1];
                    if (top === false) {
                        this._stack[this._stack.length - 1] = 0;
                    }
                    else if (typeof top == 'number') {
                        this._stack[this._stack.length - 1] = top + 1;
                    }
                }
                break;
        }
        switch (chunk.name) {
            case 'startObject':
                this._stack.push(true);
                break;
            case 'startArray':
                this._stack.push(false);
                break;
            case 'endObject':
            case 'endArray':
                this._stack.pop();
                break;
        }
        if (this._func(this._stack, chunk)) {
            switch (chunk.name) {
                case 'startObject':
                case 'startArray':
                case 'endObject':
                case 'endArray':
                    this._sync();
                    break;
                default:
                    this._sync();
                    this.push(chunk);
                    break;
            }
        }
        callback();
    };
    ;
    Filter.prototype._flush = function (cb) {
        this._stack = [];
        this._sync();
        cb();
    };
    Filter.prototype._sync = function () {
        var p = this._previous, pl = p.length, s = this._stack, sl = s.length, n = Math.min(pl, sl), i, j, k, value;
        for (i = 0; i < n && p[i] === s[i]; ++i)
            ;
        if (pl === sl && i >= n) {
            return;
        }
        for (j = pl - 1, k = n && i < n ? i : i - 1; j > k; --j) {
            value = p[j];
            if (value === true) {
                this.push({ name: 'startObject' });
                this.push({ name: 'endObject' });
            }
            else if (value === false) {
                this.push({ name: 'startArray' });
                this.push({ name: 'endArray' });
            }
            else {
                this.push({ name: typeof value == 'number' ? 'endArray' : 'endObject' });
            }
        }
        if (n && i < n) {
            if (p[i] === true || typeof p[i] == 'string') {
                if (p[i] === true) {
                    this.push({ name: 'startObject' });
                }
                value = s[i];
                this.push({ name: 'startKey' });
                this.push({ name: 'stringChunk', value: value });
                this.push({ name: 'endKey' });
                this.push({ name: 'keyValue', value: value });
            }
            else if (p[i] === false || typeof p[i] == 'number') {
                if (p[i] === false) {
                    this.push({ name: 'startArray' });
                }
                if (this._defaultValue.length) {
                    value = s[i] || 0;
                    for (j = (p[i] || 0) + 1; j < value; ++j) {
                        this._defaultValue.forEach(function (chunk) {
                            this.push(chunk);
                        }, this);
                    }
                }
            }
        }
        for (j = n && i < n ? i + 1 : i; j < sl; ++j) {
            value = s[j];
            switch (typeof value) {
                case 'string':
                    this.push({ name: 'startObject' });
                    this.push({ name: 'startKey' });
                    this.push({ name: 'stringChunk', value: value });
                    this.push({ name: 'endKey' });
                    this.push({ name: 'keyValue', value: value });
                    break;
                case 'number':
                    this.push({ name: 'startArray' });
                    if (this._defaultValue.length) {
                        for (k = 0; k < value; ++k) {
                            this._defaultValue.forEach(function (chunk) {
                                this.push(chunk);
                            }, this);
                        }
                    }
                    break;
            }
        }
        this._previous = s.slice(0);
    };
    ;
    Filter.prototype._pattern = function (stack) {
        var path = stack.filter(function (value) {
            return typeof value != 'boolean';
        })
            .join(this._separator);
        return this._regexp.test(path);
    };
    Filter.prototype._allowAll = function () {
        return true;
    };
    return Filter;
}(stream_1.Transform));
exports.Filter = Filter;
