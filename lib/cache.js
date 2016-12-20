var LRU = require("lru-cache");

var cache = LRU({ max: 100 * 1024 * 50,
  length: function (page, key) {
    return page.content.length; 
  },
  maxAge: 1000 * 60 * 60
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
      this.cache.del(key);  
    });
  },

  log: function () {
    console.log(this.cache.keys());
  }
};

module.exports = pageCache;