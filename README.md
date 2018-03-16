

 # Oplog.Rx 
 
 Tails the MongoDB Oplog for you.
 An improvement over existing libraries.
 
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
})
.catch(function (err) {
  console.error('error while attempting to tail the oplog:', err.message || err);
});




```
 
 