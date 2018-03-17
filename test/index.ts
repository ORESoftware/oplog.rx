const {ObservableOplog} = require('oplog.rx');
const {transformObject2JSON} = require('json-stdio');

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

// const strm = oplog.getReadableStream({events: ['delete']});

// strm.on('data', function (d) {
//   console.log(String(d));
// });


oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function(v){
  console.log('all done and well?:', v);
});

// setTimeout(function(){
//   oplog.stop().then(function(){
//      console.log('stopped tailing.');
//   });
//
// },1000);

// oplog.getRawStream().on('data', function (v) {
//    console.log('here we go:', v);
// });

