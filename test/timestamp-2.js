'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var oplog_rx_1 = require("oplog.rx");
var json_stdio_1 = require("json-stdio");
var oplog = new oplog_rx_1.ObservableOplog({
    ts: { low: 1, high: 1521257592 },
    ns: {
        $in: [
            /test.foo$/,
            /test.foo1$/
        ]
    }
});
oplog.tail().then(function () {
    console.log('tailing');
})
    .catch(function (err) {
    console.error(err);
});
var evs = oplog.getOps();
evs.delete.filter(function (v) {
    return true;
})
    .subscribe(function (v) {
});
evs.insert.subscribe(function (v) {
});
evs.update.subscribe(function (v) {
});
var count = 0;
oplog.getFilteredStream({}).pipe(json_stdio_1.transformObject2JSON()).on('data', function (v) {
    console.log('all done and well?:', count++);
    console.log('zoom:::', v);
});
