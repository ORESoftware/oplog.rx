'use strict';

import {ObservableOplog} from 'oplog.rx';
import {transformObject2JSON} from 'json-stdio';

const oplog = new ObservableOplog();

oplog.tail().then(function () {
  console.log('tailing');
  return oplog.stop();
})
.then(function(){
  debugger;
  return oplog.tail().then(function () {
    console.log('tailing');
    let count = 0;
    oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function(v){
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


// let count = 0;
// oplog.getFilteredStream({}).pipe(transformObject2JSON()).on('data', function(v){
//   console.log('all done and well?:', count++);
// });

// setTimeout(function(){
//   oplog.stop().then(function(){
//      console.log('stopped tailing.');
//   });
//
// },1000);

// oplog.getRawStream().on('data', function (v) {
//    console.log('here we go:', v);
// });

