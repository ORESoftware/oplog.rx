
 # Oplog.Rx 
 
 Tails the MongoDB Oplog for you.
 An improvement over existing libraries. 
 This has interfaces for Observables and Node.js streams + better TypeScript typings.
 
 ### Installation => `npm install oplog.rx -S`
 
 ### Main features
 
 Has interfaces for both Node.js streams and RxJS Observables.
 This library will switch to native Observables once they become available.
 Until then, simply using the latest version of RxJS.
 
 
 ### How the Oplog works
 
 The MongoDB oplog is simply a capped collection that is tailable, using Cursor.stream();
 The structure of an Oplog document is like so:
 
 ```json
 {"ts":"6533791416483577857","t":4,"h":"8859258976700926266","v":2,"op":"i","ns":"test.foo","o":{"_id":"5ab94bb","username":"fox"}}
```

| field | mr. arrow | description                                                                                       |
|-------|-----------|---------------------------------------------------------------------------------------------------|
| ts    | =>        | 64bit timestamp                                                                                   |
| op    | =>        | the type of operation (i is insert, u is update, d is delete, etc.)                               |
| ns    | =>        | \<db\>.\<collection\>                                                                                 |
| o     | =>        | the document that changed (it should always be the complete document, not just the changed part). |
| t     | =>        | the election "term" of the replicaset (not really important)                                      |
| v     | =>        | Version of the oplog format (unfortunately not the version of the document object)                |
| h     | =>        | The hash field gives each oplog entry a unique id                                                 |



This article is pretty good on the subject:
https://engineering.tes.com/post/mongodb-oplog/
 
 
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

### Useful Query/Filter options

```js
import {ObservableOplog} from 'oplog.rx';
import {Timestamp} from 'bson';

const oplog = new ObservableOplog({
  ts: Timestamp.fromInt(Date.now() - 45000),  // search for documents that are younger than 45 seconds ago
  ns: {
    $in: ['mydb.coll1', 'mydb.coll2', /mydb2\.*/],
  }
});

// or if you need something very custom use query:

const oplog = new ObservableOplog({
  query: {
    ts: {
      $gt: Timestamp.fromInt(Date.now() - 45000)
    }, 
    $and: [
      {ns: {$nin: [/foo/, /rolo/]}},
      {ns: {$in: [/bar/]}},
    ]
  }
});

// if the query parameter is provided, it will be sent directly to:

const coll = db.collection('oplog.rs');
const cursor = coll.find(query);


```



###  Usage with Observables

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


### Usage with Node.js Streams

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

 const socket = getClientConnection();  // get a tcp connection from wherever
 t.pipe(transform).pipe(socket);
 
 // with the above code, you can listen for certain events
 // and pipe the data to wherever it needs to go
 // streams are especially useful for performant networking between processes.

```


### Advanced usage - Client receives stream data

In the above section, we piped JSON into a socket connection.
The above might have been a TCP server that's tailing the oplog.
Below we have code that might reside on a client process that's connected to the TCP server.
The client receives JSON (representing oplog events) through a socket stream.
We use a helper function from the 'oplog.rx' library to parse oplog events from the stream.


```typescript

import net = require('net');
import JSONStdio = require('json-stdio');
import {getOplogStreamInterpreter} from 'oplog.rx';

const c = net.createConnection(6969, 'localhost');
const jsonParser = JSONStdio.createParser();
const strm = c.pipe(jsonParser);  // parse the JSON stream into JS objects
const {ops, emitter} = getOplogStreamInterpreter(strm); // listen for data events


// we can use observables

ops.delete.subscribe(v => {
  console.log('delete happened.');
});

ops.insert.subscribe(v => {
  console.log('insert happened.');
});

ops.update.subscribe(v => {
  console.log('update happened.');
});


// or just use an event emitter

emitter.on('update', function(){
  console.log('update happened.');
});

emitter.on('delete', function () {
  console.log('delete happened.');
});

emitter.on('insert', function () {
  console.log('insert happened.');
});
```
 
 