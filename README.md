
 # Oplog.Rx 
 
 Tails the MongoDB Oplog for you.
 An improvement over existing libraries. 
 This has interfaces for Observables and Node.js streams + better TypeScript typings.
 
 ### Installation => `npm install oplog.rx -S`
 
 ### Main features
 
 Has interfaces for both Node.js streams and RxJS Observables.
 This library will switch to native Observables once they become available.
 Until then, simply using the latest version of RxJS.
 
 ### Basic Usage
 
 ```js
import {ObservableOplog} from 'oplog.rx';

const oplog = new ObservableOplog();

oplog.tail().then(function () {
  console.log('successfully started tailing the oplog.');
});

oplog.getEmitter()
  .on('update', function(){
  
   })
  .on('insert', function(){
    
  })
  .on('delete', function() {
    
  });


```


### Advanced Usage with Observables

Oplog.Rx is designed to support Observables and Node.js streams 

```js
 const oplog = new ObservableOplog();
 
 oplog.tail().then(function () {
   console.log('successfully started tailing the oplog.');
 });
 
 const ops = oplog.getOps();
 
 ops.insert.subscribe(v => {
   
 });
 
 ops.delete.subscribe(v => {
   
 });
 
 ops.update.subscribe(v => {
   
 });

```


### Advanced Usage with Node.js Streams

Oplog.Rx is designed to support Observables and Node.js streams 

```js
 const oplog = new ObservableOplog();
 
 oplog.tail().then(function () {
   console.log('successfully started tailing the oplog.');
 });
 
 // create a transform stream which only forwards the desired data
 const t = oplog.getFilteredStream({namespace:'foobar'});

 // the above stream is a transform stream which you can pipe elsewhere
 // to send the data to another process, convert it to JSON first
 
 const JSONStdio = require('json-stdio');
 const transform = JSONStdio.transformObject2JSON();

 const socket = getTCPConnection();  // get a tcp connection from wherever
 t.pipe(transform).pipe(socket);
 
 // with the above code, you can listen for certain events
 // and pipe the data to wherever it needs to go
 // streams are especially useful for performant networking between processes.

```
 
 