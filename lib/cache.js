var LRU = require("lru-cache");
var Configurable = require("./configurable");

var Configuration = function () {
  Configurable.call(this);
};

Configuration.prototype = Object.create(Configurable.prototype);

var configuration = new Configuration(); // eslint-disable-line no-unused-vars

var expired = configuration.getConfig().pages.expired * 60 * 1000;

var cache = LRU({ max: 100 * 1024 * 50,
  length: function (page, key) {
    return page.content.length; 
  },
  maxAge: expired
});

var pageCache = {
  cache: cache,

  getKey: function (name, version) {
    // LRU key = pageName/revision
    // if version is null, revision is HEAD
    var v = version ? version : "HEAD";
    return name + "/" + v; 
  },

  // Remove all keys start with "name/"
  // It means remove all cache pages related to 'name' whatever the revision is.
  removeKeys: function (name) {
    var keysWantRemove = [];
    this.cache.forEach( function (value, key, cache) {
      if (key.startsWith(name + "/"))
        keysWantRemove.push(key);
    }); 

    keysWantRemove.forEach(function (key) {
      console.log((new Date()) + " - Remove key[%s] from cache.", key);
      this.cache.del(key);  
    }.bind(this));
  },

  log: function () {
    console.log(this.cache.keys());
  }
};

module.exports = pageCache;