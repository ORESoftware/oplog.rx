'use strict';

import {ObservableOplog} from 'oplog.rx';
import {transformObject2JSON} from 'json-stdio';
import {Timestamp} from "bson";

const oplog = new ObservableOplog({
  query: {
    ts: {
      $gt: Timestamp.fromBits(1, Date.now() / 1000 | 0)
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

const ev = oplog.getOps();

ev.delete.filter(v => {
  return true;
})
.subscribe(v => {
  // console.log('delete happened.')
});

ev.insert.subscribe(v => {
  // console.log('insert happened.')
});

ev.update.subscribe(v => {
  // console.log('update happened.')
});

// const strm = oplog.getReadableStream({events: ['delete']});

// strm.on('data', function (d) {
//   console.log(String(d));
// });

let count = 0;
oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function (v) {
  console.log('all done and well?:', count++);
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

