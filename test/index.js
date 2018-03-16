const {ObservableOplog} = require('oplog.rx');

const oplog = new ObservableOplog();

oplog.tail().then(function () {
  console.log('tailing');
})
.catch(function (err) {
  console.error(err);
});

const events = oplog.getEvents();

events.delete.filter(v => {
  return true;
})
.subscribe(v => {
  // console.log('delete happened.')
});

events.insert.subscribe(v => {
  // console.log('insert happened.')
});

events.update.subscribe(v => {
  // console.log('update happened.')
});

const strm = oplog.getReadableStream({events: ['delete']});

strm.on('data', function (d) {
  console.log(String(d));
});


oplog.getRawStream().pipe(process.stdout);