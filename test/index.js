/* jshint expr: true, unused: false */
/* global describe, it, before, after, beforeEach, afterEach */

var async      = require('async')
  , mongoose   = require('mongoose')
  , cachegoose = require('../')
  , should     = require('should')
  , mongoose   = require('mongoose')
  , Schema     = mongoose.Schema
  , RecordSchema
  , Record
  , cache
  , db
  ;

describe('cachegoose', function() {
  before(function(done) {
    cachegoose(mongoose, {}, true);

    cache = cachegoose._cache;

    mongoose.connect('mongodb://127.0.0.1/mongoose-cachegoose-testing');
    db = mongoose.connection;

    db.on('error', done);
    db.on('open', done);

    RecordSchema = new Schema({
      num: Number,
      str: String,
      date: {
        type: Date,
        default: Date.now
      }
    });

    Record = mongoose.model('Record', RecordSchema);
  });

  beforeEach(function(done) {
    generate(10, done);
  });

  afterEach(function(done) {
    Record.remove(function() {
      cache.clear(done);
    });
  });

  it('should have cache method after initialization', function () {
    Record.find({}).cache.should.be.a.Function;
  });

  it('should cache a simple query that uses callbacks', function(done) {
    getAll({ ttl: 60 }, function(err, res) {
      res.length.should.equal(10);
      Boolean(res._fromCache).should.be.false;

      getAll({ ttl: 60 }, function(err, res) {
        res.length.should.equal(10);
        Boolean(res._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should cache a simple query that uses promises', function(done) {
    getAll({ ttl: 60 }).then(function(res) {
      res.length.should.equal(10);
      Boolean(res._fromCache).should.be.false;

      getAll({ ttl: 60 }).then(function(res) {
        res.length.should.equal(10);
        Boolean(res._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should not cache the same query w/out a ttl defined', function(done) {
    getAll({ ttl: 60 }).then(function(res) {
      getAllNoCache(function(err, res) {
        Boolean(res._fromCache).should.be.false;
        done();
      });
    });
  });

  it('should return a Mongoose model from cached and non-cached results', function(done) {
    getAll({ ttl: 60 }, function(err, res) {
      var first = res[0];

      getAll({ ttl: 60 }, function(err2, res2) {
        var cachedFirst = res2[0];
        first.constructor.name.should.equal('model');
        cachedFirst.constructor.name.should.equal('model');

        res[0].isNew.should.be.false;
        res2[0].isNew.should.be.false;

        done();
      });
    });
  });

  it('should return lean models from cached and non-cached results', function(done) {
    getAllLean({ ttl: 10 }, function(err, res) {
      res.length.should.equal(10);
      Boolean(res._fromCache).should.be.false;

      getAllLean({ ttl: 10 }, function(err, res2) {
        res2.length.should.equal(10);
        Boolean(res2._fromCache).should.be.true;
        res[0].constructor.name.should.not.equal('model');
        res2[0].constructor.name.should.not.equal('model');
        done();
      });
    });
  });

  it('should cache a query that returns no results', function(done) {
    getNone({ ttl: 10 }, function(err, res) {
      res.length.should.equal(0);
      Boolean(res._fromCache).should.be.false;

      getNone({ ttl: 10 }, function(err, res2) {
        res2.length.should.equal(0);
        Boolean(res2._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should distinguish between lean and non lean for the same conditions', function(done) {
    getAll({ ttl: 10 }, function(err, res) {
      getAll({ ttl: 10 }, function(err, res2) {
        res2.length.should.equal(10);
        Boolean(res2._fromCache).should.be.true;
        res2[0].constructor.name.should.equal('model');

        getAllLean({ ttl: 10 }, function(err, res3) {
          Boolean(res3._fromCache).should.be.false;
          res3[0].constructor.name.should.not.equal('model');
          done();
        });
      });
    });
  });

  it('should correctly cache queries using skip', function(done) {
    getWithSkip(1, { ttl: 10 }, function(err, res) {
      Boolean(res._fromCache).should.be.false;
      res.length.should.equal(9);

      getWithSkip(1, { ttl: 10 }, function(err, res2) {
        Boolean(res2._fromCache).should.be.true;
        res2.length.should.equal(9);

        getWithSkip(2, { ttl: 10 }, function(err, res3) {
          Boolean(res3._fromCache).should.be.false;
          res3.length.should.equal(8);
          done();
        });
      });
    });
  });

  it('should correctly cache queries using limit', function(done) {
    getWithLimit(5, { ttl: 10 }, function(err, res) {
      Boolean(res._fromCache).should.be.false;
      res.length.should.equal(5);

      getWithLimit(5, { ttl: 10 }, function(err, res2) {
        Boolean(res2._fromCache).should.be.true;
        res2.length.should.equal(5);

        getWithLimit(4, { ttl: 10 }, function(err, res3) {
          Boolean(res3._fromCache).should.be.false;
          res3.length.should.equal(4);
          done();
        });
      });
    });
  });

  it('should correctly cache the same query with different condition orders', function(done) {
    getWithUnorderedQuery({ ttl: 10 }, function(err, res) {
      Boolean(res._fromCache).should.be.false;
      getWithUnorderedQuery({ ttl: 10 }, function(err, res2) {
        Boolean(res2._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should cache a findOne query', function(done) {
    getOne({ ttl: 10 }, function(err, res) {
      res.constructor.name.should.equal('model');

      getOne({ ttl: 10 }, function(err, res2) {
        res2.constructor.name.should.equal('model');
        Boolean(res2._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should cache a regex condition properly', function(done){
    getAllWithRegex({ ttl: 10 }, function(err, res) {
      Boolean(res._fromCache).should.be.false;

      getAllWithRegex({ ttl: 10 }, function(err, res) {
        Boolean(res._fromCache).should.be.true;

        getNoneWithRegex({ ttl: 10 }, function(err, res) {
          Boolean(res._fromCache).should.be.false;
          done();
        });
      });
    });
  });

  it('should cache a query rerun many times', function(done) {
    getAll({ ttl: 60 }).then(function(res) {
      res.length.should.equal(10);
      Boolean(res._fromCache).should.be.false;

      async.series(
        new Array(20).join('.').split('').map(function() {
          return function(done) {
            getAll({ ttl: 60 }, done);
          };
        })
      , function() {
        getAll({ ttl: 60 }, function(err, res) {
          res.length.should.equal(10);
          Boolean(res._fromCache).should.be.true;
          done();
        });
      });
    });
  });

  it('should expire the cache', function(done) {
    getAll({ ttl: 1 }, function() {
      setTimeout(function() {
        getAll({ ttl: 1 }, function(err, res) {
          Boolean(res._fromCache).should.be.false;
          done();
        });
      }, 1200);
    });
  });

  it('should cache aggregate queries', function(done) {
    aggregate({ ttl: 60 }, function(err, res) {
      Boolean(res._fromCache).should.be.false;
      aggregate({ ttl: 60 }, function(err, res2) {
        Boolean(res2._fromCache).should.be.true;
        done();
      });
    });
  });

  it('should clear a custom cache key', function(done) {
    getAll({ ttl: 60, key: 'custom-key' }, function(err, res) {
      Boolean(res._fromCache).should.be.false;
      getAll({ ttl: 60, key: 'custom-key' }, function(err, res2) {
        Boolean(res2._fromCache).should.be.true;
        cachegoose.clearCache('custom-key');
        getAll({ ttl: 60, key: 'custom-key' }, function(err, res3) {
          Boolean(res3._fromCache).should.be.false;
          done();
        });
      });
    });
  });
});

function getAll(opts, cb) {
  return Record.find({}).cache(opts).exec(cb);
}

function getAllNoCache(cb) {
  return Record.find({}).exec(cb);
}

function getAllLean(opts, cb) {
  return Record.find({}).lean().cache(opts).exec(cb);
}

function getOne(opts, cb) {
  return Record.findOne({ num: { $gt: 2 } }).cache(opts).exec(cb);
}

function getWithSkip(skip, opts, cb) {
  return Record.find({}).skip(skip).cache(opts).exec(cb);
}

function getWithLimit(limit, opts, cb) {
  return Record.find({}).limit(limit).cache(opts).exec(cb);
}

function getNone(opts, cb) {
  return Record.find({ notFound: true }).cache(opts).exec(cb);
}

function getAllWithRegex(opts, cb) {
  return Record.find({ str: { $regex: /\d/ } }).cache(opts).exec(cb);
}

function getNoneWithRegex(opts, cb) {
  return Record.find({ str: { $regex: /\d\d/ } }).cache(opts).exec(cb);
}

var flag = true;
function getWithUnorderedQuery(opts, cb) {
  flag = !flag;
  if (flag) {
    return Record.find({ a: true, b: false }).cache(opts).exec(cb);
  } else {
    return Record.find({ b: false, a: true }).cache(opts).exec(cb);
  }
}

function aggregate(opts, cb) {
  return Record.aggregate()
    .group({ _id: null, total: { $sum: '$num' } })
    .cache(opts)
    .exec(cb);
}

function generate (amount, cb) {
  var records = [];
  var count = 0;
  while (count < amount) {
    records.push({
      num: count,
      str: count.toString()
    });
    count++;
  }

  Record.create(records, cb);
}
