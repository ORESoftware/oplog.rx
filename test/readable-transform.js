const {Readable, Transform} = require('stream');

const readable = new Readable({
  objectMode: true,
  read: function () {
    return true;
  }
});

const transform = new Transform({
  objectMode: true,
  transform (chunk, enc, cb) {
    this.push(chunk);
    cb();
  }
});

// transform.once('readable',function(){});

// readable.pipe(transform);
//
// readable.push({foo: 'bar'});


transform.write({foo:'bar'});

setTimeout(function(){

},1000);