'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var oplog_rx_1 = require("oplog.rx");
var json_stdio_1 = require("json-stdio");
var bson_1 = require("bson");
var oplog = new oplog_rx_1.ObservableOplog({
    query: {
        ts: {
            $gt: bson_1.Timestamp.fromBits(1, Date.now() / 1000 | 0)
        },
        ns: {
            $in: [/foo/]
        }
    }
});
oplog.tail().then(function () {
    console.log('tailing');
})
    .catch(function (err) {
    console.error(err);
});
var ev = oplog.getOps();
ev.delete.filter(function (v) {
    return true;
})
    .subscribe(function (v) {
});
ev.insert.subscribe(function (v) {
});
ev.update.subscribe(function (v) {
});
var count = 0;
oplog.getFilteredStream({}).pipe(json_stdio_1.transformObject2JSON()).on('data', function (v) {
    console.log('all done and well?:', count++);
});
