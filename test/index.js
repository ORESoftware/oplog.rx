const {OplogObservable} = require('oplog.rx');

const oplog = new OplogObservable();

oplog.tail().then(function () {
  console.log('tailing');
})
.catch(function (err) {
  console.error(err);
});


oplog.events.delete.subscribe(v => {
  console.log('delete happened.')
});


oplog.events.insert.subscribe(v => {
  console.log('insert happened.')
});


oplog.events.update.subscribe(v => {
   console.log('update happened.')
});



const strm = oplog.getReadableStream();

strm.on('data',function (d) {
  console.log(String(d));
});