var stream = require('stream');
var util = require('util');


var Transform = stream.Transform;

function Filter(filterProps, options) {
  if (!options) options = {}; // ensure object
  options.objectMode = true; // forcing object mode
  Transform.call(this, options);
  this.filterProps = filterProps;
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
    },
    {}
  );

  // push the filtered obj out
  this.push(filteredObj);
  cb();
};


var filter = new Filter([ 'phone', 'email' ]);
filter.on('readable', function () {
  var obj;
  while (null !== (obj = filter.read())) {
    console.log('vooop:',obj);
  }
});


filter.write({zoom:'bar'});
filter.write({one:'bar'});
filter.write({two:'bar'});
filter.write({three:'bar'});


// readableStream.pipe(filter);
//
// readableStream.push({zoom:'bar'});