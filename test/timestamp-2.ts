'use strict';

import {ObservableOplog} from 'oplog.rx';
import {transformObject2JSON} from 'json-stdio';

const oplog = new ObservableOplog({
  ts: {low: 1, high: 1521257592},
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

const evs = oplog.getEvents();

evs.delete.filter(v => {
  return true;
})
.subscribe(v => {
  // console.log('delete happened.')
});

evs.insert.subscribe(v => {
  // console.log('insert happened.')
});

evs.update.subscribe(v => {
  // console.log('update happened.')
});

// const strm = oplog.getReadableStream({events: ['delete']});

// strm.on('data', function (d) {
//   console.log(String(d));
// });

let count = 0;
oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function (v) {
  console.log('all done and well?:', count++);
  console.log('zoom:::', v);
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

