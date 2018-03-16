'use strict';

var stream = require('stream');
var util = require('util');

var Transform = stream.Transform;

function Filter(filterProps, options) {
  if (!options) options = {}; // ensure object
  options.objectMode = true; // forcing object mode
  options.writableObjectMode = true;
  Transform.call(this, options);
  this.filterProps = filterProps || [];
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (obj, enc, cb) {
  var self = this;
  // determine what keys to keep
  var filteredKeys = Object.keys(obj).filter(
    function (key) {
      // only those keys not in this list
      return (self.filterProps.indexOf(key) === -1);
    }
  );

  // create clone with only these keys
  var filteredObj = filteredKeys.reduce(
    function (accum, key) {
      accum[key] = obj[key];
      return accum;
    }, {});

  // push the filtered obj out
  console.log('pushing object:', util.inspect(filteredObj));
  this.push(filteredObj);
  cb();
};

exports.FilterStream = Filter;


// var filter = new Filter(['phone', 'email']);
// // filter.on('readable', function () {
// //   var obj;
// //   while (null !== (obj = filter.read())) {
// //     console.log('vooop:', obj);
// //   }
// // });
//
// filter.write({zoom: 'bar'});
// filter.write({one: 'bar'});
// filter.write({two: 'bar'});
// filter.write({three: 'bar'});

// import util = require('util');
// import {Transform} from 'stream';
//
// const Filter = function (filterProps, options) {
//   // allow use without new
//   if (!(this instanceof Filter)) {
//     return new Filter(filterProps, options);
//   }
//
//   // init Transform
//   if (!options) {
//     options = {};
//   }
//
//   options.objectMode = true; // forcing object mode
//   Transform.call(this, options);
//   this.filterProps = filterProps || [];
// };
//
// util.inherits(Filter, Transform);
//
// /* filter each object's sensitive properties */
// Filter.prototype._transform = function (obj, enc, cb) {
//
//   const self = this;
//   // determine what keys to keep
//   const filteredKeys = Object.keys(obj).filter(
//     function (key) {
//       // only those keys not in this list
//       return (self.filterProps.indexOf(key) === -1);
//     }
//   );
//
//   // create clone with only these keys
//   const filteredObj = filteredKeys.reduce(
//     function (accum, key) {
//       accum[key] = obj[key];
//       return accum;
//     },
//     {}
//   );
//
//   // push the filtered obj out
//   this.push(filteredObj);
//   cb();
// };

// module.exports = Filter;

// export const getFilterStream = function () {
//
//   const strm = new Transform({
//
//     objectMode: true,
//
//     transform(chunk: any, encoding: string, cb: Function) {
//
//       if(chunk){
//         this.push(chunk);
//       }
//
//       cb();
//
//     },
//
//     flush(cb: Function) {
//       cb();
//     }
//
//   });
//
//   return strm;
//
// };

// export class Filter extends Transform {
//
//   constructor(options: any) {
//     super(options);
//
//     this._writableState.objectMode = true;
//     this._readableState.objectMode = true;
//
//     let f = options.filter;
//
//     if (typeof f == 'function') {
//
//       this._func = f;
//     }
//     else if (f instanceof RegExp) {
//       this._regexp = f;
//       this._func = this._pattern;
//     }
//     else {
//       this._func = this._allowAll;
//     }
//
//     this._separator = options.separator || '.';
//     this._defaultValue = options.defaultValue || [{name: 'nullValue', value: null}];
//
//     this._previous = [];
//     this._stack = [];
//     this._collectKey = false;
//     this._key = '';
//   }
//
//   _transform(chunk, encoding, callback) {
//     // skip keys
//     if (this._collectKey) {
//       if (chunk.name === 'endKey') {
//         this._collectKey = false;
//         this._stack.pop();
//         this._stack.push(this._key);
//         this._key = '';
//       } else {
//         this._key += chunk.value;
//       }
//       callback();
//       return;
//     }
//
//     switch (chunk.name) {
//       case 'startKey':
//         this._collectKey = true;
//       // intentional fall down
//       case 'keyValue':
//         callback();
//         return;
//       case 'startObject':
//       case 'startArray':
//       case 'startString':
//       case 'startNumber':
//       case 'nullValue':
//       case 'trueValue':
//       case 'falseValue':
//         // update array's index
//         if (this._stack.length) {
//           var top = this._stack[this._stack.length - 1];
//           if (top === false) {
//             this._stack[this._stack.length - 1] = 0;
//           } else if (typeof top == 'number') {
//             this._stack[this._stack.length - 1] = top + 1;
//           }
//         }
//         break;
//     }
//
//     switch (chunk.name) {
//       case 'startObject':
//         this._stack.push(true);
//         break;
//       case 'startArray':
//         this._stack.push(false);
//         break;
//       case 'endObject':
//       case 'endArray':
//         this._stack.pop();
//         break;
//     }
//
//     // check if the chunk should be outputted
//     if (this._func(this._stack, chunk)) {
//       switch (chunk.name) {
//         case 'startObject':
//         case 'startArray':
//         case 'endObject':
//         case 'endArray':
//           this._sync();
//           break;
//         default:
//           this._sync();
//           this.push(chunk);
//           break;
//       }
//     }
//
//     callback();
//   };
//
//   _flush(cb: Function) {
//     this._stack = [];
//     this._sync();
//     cb();
//   }
//
//   _sync() {
//     var p = this._previous, pl = p.length,
//       s = this._stack, sl = s.length,
//       n = Math.min(pl, sl), i, j, k, value;
//     for (i = 0; i < n && p[i] === s[i]; ++i) ;
//     if (pl === sl && i >= n) {
//       return;
//     }
//     for (j = pl - 1, k = n && i < n ? i : i - 1; j > k; --j) {
//       value = p[j];
//       if (value === true) {
//         this.push({name: 'startObject'});
//         this.push({name: 'endObject'});
//       } else if (value === false) {
//         this.push({name: 'startArray'});
//         this.push({name: 'endArray'});
//       } else {
//         this.push({name: typeof value == 'number' ? 'endArray' : 'endObject'});
//       }
//     }
//     if (n && i < n) {
//       if (p[i] === true || typeof p[i] == 'string') {
//         if (p[i] === true) {
//           this.push({name: 'startObject'});
//         }
//         value = s[i];
//         this.push({name: 'startKey'});
//         this.push({name: 'stringChunk', value: value});
//         this.push({name: 'endKey'});
//         this.push({name: 'keyValue', value: value});
//       } else if (p[i] === false || typeof p[i] == 'number') {
//         if (p[i] === false) {
//           this.push({name: 'startArray'});
//         }
//         if (this._defaultValue.length) {
//           value = s[i] || 0;
//           for (j = (p[i] || 0) + 1; j < value; ++j) {
//             this._defaultValue.forEach(function (chunk) {
//               this.push(chunk);
//             }, this);
//           }
//         }
//       }
//     }
//     for (j = n && i < n ? i + 1 : i; j < sl; ++j) {
//       value = s[j];
//       switch (typeof value) {
//         case 'string':
//           this.push({name: 'startObject'});
//           this.push({name: 'startKey'});
//           this.push({name: 'stringChunk', value: value});
//           this.push({name: 'endKey'});
//           this.push({name: 'keyValue', value: value});
//           break;
//         case 'number':
//           this.push({name: 'startArray'});
//           if (this._defaultValue.length) {
//             for (k = 0; k < value; ++k) {
//               this._defaultValue.forEach(function (chunk) {
//                 this.push(chunk);
//               }, this);
//             }
//           }
//           break;
//       }
//     }
//     this._previous = s.slice(0);
//   };
//
//   _pattern(stack: Array<any>) {
//     let path = stack.filter(function (value) {
//       return typeof value != 'boolean';
//     })
//     .join(this._separator);
//     return this._regexp.test(path);
//   }
//
//   _allowAll() {
//     return true;
//   }
// }
//
//
//


