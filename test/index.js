var ObservableOplog = require('oplog.rx').ObservableOplog;
var transformObject2JSON = require('json-stdio').transformObject2JSON;
var oplog = new ObservableOplog();
oplog.tail().then(function () {
    console.log('tailing');
})
    .catch(function (err) {
    console.error(err);
});
var events = oplog.getEvents();
events.delete.filter(function (v) {
    return true;
})
    .subscribe(function (v) {
});
events.insert.subscribe(function (v) {
});
events.update.subscribe(function (v) {
});
var count = 0;
oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function (v) {
    console.log('all done and well?:', count++);
});
