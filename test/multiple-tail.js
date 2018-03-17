'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var oplog_rx_1 = require("oplog.rx");
var json_stdio_1 = require("json-stdio");
var oplog = new oplog_rx_1.ObservableOplog();
oplog.tail().then(function () {
    console.log('tailing');
    return oplog.stop();
})
    .then(function () {
    debugger;
    return oplog.tail().then(function () {
        console.log('tailing');
        var count = 0;
        oplog.getFilteredStream({}).pipe(json_stdio_1.transformObject2JSON()).on('data', function (v) {
            console.log('all done and well?:', count++);
        });
    })
        .catch(function (err) {
        console.error(err);
    });
})
    .catch(function (err) {
    console.error(err);
});
var ev = oplog.getEvents();
ev.delete.filter(function (v) {
    return true;
})
    .subscribe(function (v) {
});
ev.insert.subscribe(function (v) {
});
ev.update.subscribe(function (v) {
});
