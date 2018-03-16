

var stream = require('stream');
var util = require('util');
var Transform = stream.Transform ;

function Filter(filterProps, options) {
  if (!options) options = {}; // ensure object
  options.objectMode = true; // forcing object mode
  Transform.call(this, options);
  this.filterProps = filterProps || [];
}
util.inherits(Filter, Transform);

Filter.prototype._transform = function (obj, enc, cb) {
  var self = this;
  var filteredKeys = Object.keys(obj).filter(
    function (key) {
      return (self.filterProps.indexOf(key) === -1);
    }
  );

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
// filter.on('readable', function () {
//   var obj;
//   while (null !== (obj = filter.read())) {
//     console.log(obj);
//   }
// });

// now send some objects to filter through
filter.write({ name: 'Foo', phone: '555-1212',
  email: 'foo@foo.com', id: 123 });
filter.write({ name: 'Bar', phone: '555-1313',
  email: 'bar@bar.com', id: 456 });
filter.end();  // finish