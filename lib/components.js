/* global Git */
var fs = require("fs");
var models = require("./models");
var Promiser = require("bluebird");
var renderer = require("./renderer");
var Configurable = require("./configurable");

models.use(Git);

function Component(name, file) {
  this.name = name;
  this.file = file;
  this.cache = null;
  this.timer = 0;
  this._exists = false;
  Configurable.call(this);
}

Component.prototype = Object.create(Configurable.prototype);

Component.prototype.exists = function () {
  this._exists = fs.existsSync(Git.absPath(this.file));

  if (!this._exists) {
    this.timer = 0;
    this.cache = null;
    return this._exists;
  }

  // Exists then check expiration
  if ((Date.now() - this.timer) > this.getConfig().customizations.expired * 60 * 1000) {
    console.log((new Date()) + " - Content[%s] expired", this.file);
    this.timer = Date.now();
    this.cache = null;
  }
  
  return this._exists;
};

Component.prototype.fetchAsync = function (cb) {
  if (!this.exists()) {
    cb && cb(null);
    return;
  }

  if (this.cache) {
    cb && cb(null, this.cache);
    return;
  }

  var readfile = Promiser.promisify(fs.readFile);
  readfile(Git.absPath(this.file)).bind(this).then(function (data) {
    this.cache = renderer.render(data.toString());
    cb && cb(null, this.cache);
  }).error(function (error) {
    this.cache = null;
    cb && cb(error, null);
  });
};

Component.prototype.fetchSync = function () {
  if (!this.exists()) {
    return null;
  }

  if (!this.cache) {
    this.cache = fs.readFileSync(Git.absPath(this.file));
  }

  return this.cache;
};

module.exports = (function () {
  
  var Configuration = function () {
    Configurable.call(this);
  };

  Configuration.prototype = Object.create(Configurable.prototype);

  var configuration = new Configuration();

  var components = [
    new Component("index", configuration.getConfig().customizations.index),
    new Component("sidebar", configuration.getConfig().customizations.sidebar),
    new Component("footer", configuration.getConfig().customizations.footer),
    new Component("style", configuration.getConfig().customizations.style),
    new Component("script", configuration.getConfig().customizations.script)
  ];

  function find(name) {
    return components.filter(function (c) {
      return c.name === name;
    })[0];
  }

  function generateFiles(callback) {
    var readDir = Promiser.promisify(fs.readdir);

    readDir(configuration.getConfig().application.repository).then(function (files) {
      var nameArr = [];
      var proxyPath = configuration.getConfig().application.proxyPath;

      files.sort(function (a, b) {
        return a < b ? -1 : 1;
      }).forEach(function (file) {
        if (!file.startsWith(".") && !file.startsWith("_")) { // Omit list page files and hidden files
          if (file.endsWith(".md")) { // Only markdown files
            if (file.toString().trim() === configuration.getConfig().customizations.index) // Omit Index
              return;

            var name = file.replace(/\.md$/, "");
            var nameWithoutDashes = name.replace(/-/g, " ");
            var nameShow = nameWithoutDashes.replace(/\./, ": ");

            var result = "[" + nameShow + "](" + proxyPath + "/wiki/" + name + ")";
          
            nameArr.push(result);
          }
        }
      });

      // Index  
      var outputFileName = configuration.getConfig().customizations.index;
      var title = "Index";
    
      var file = fs.createWriteStream(configuration.getConfig().application.repository + "/" + outputFileName);
      file.on("error", function (err) {
        console.log("ERROR: Write to file error: " + err);
        callback && callback(err);
        return;
      });

      // First line
      var os = require("os");
      if (title)
        file.write("# " + title + os.EOL + os.EOL);

      nameArr.forEach(function (v) {
        file.write(v + os.EOL);
      });
      file.end();
      console.log((new Date()) + " - Generated: " + outputFileName);

      // Sidebar
      outputFileName = configuration.getConfig().customizations.sidebar;
      file = fs.createWriteStream(configuration.getConfig().application.repository + "/" + outputFileName);
      file.on("error", function (err) {
        console.log("ERROR: Write to file error: " + err);
        callback && callback(err);
        return;
      });

      var os = require("os");

      file.write(os.EOL);
      file.write("[New](" + proxyPath + "/pages/new)" + os.EOL);
      file.write("[All](" + proxyPath + "/)" + os.EOL);
      file.write("[List](" + proxyPath + "/wiki)" + os.EOL);

      file.write(os.EOL + "-----" + os.EOL);

      nameArr.filter(function (name) {
        return name.startsWith("[TODO");
      }).forEach(function (v) {
        file.write(v + os.EOL);
      });

      file.write(os.EOL + "-----" + os.EOL);

      nameArr.filter(function (name) {
        return name.startsWith("[Miscs");
      }).forEach(function (v) {
        file.write(v + os.EOL);
      });

      file.end();
      console.log((new Date()) + " - Generated: " + outputFileName);

      callback && callback(null);
    }).error(function (err) {
      console.log(err);
      callback && callback(err);
    });
  }

  var publicMethods = {

    expire: function (name) {
      var c = find(name);
      c.cache = null;
      c.timer = 0;
    },

    // Check if page is one of components
    isComponent: function (page) {
      var result = components.filter(function (component) {
        return component.file === ( page + ".md");
      });

      if (result)
        return true;

      return false;
    },

    hasIndex: function () {
      return find("index").exists();
    },

    hasSidebar: function () {
      return find("sidebar").exists();
    },

    hasFooter: function () {
      return find("footer").exists();
    },

    hasCustomStyle: function () {
      return find("style").exists();
    },

    hasCustomScript: function () {
      return find("script").exists();
    },

    index: function (cb) {
      find("index").fetchAsync(cb);
    },

    generate: function (cb) {
      generateFiles(function (err) {
        if (!err) {
          console.log((new Date()) + " - Generate complete, force files to reload");
          // Force to reload files next time
          find("index").cache = null; 
          find("index").timer = 0; 
          find("sidebar").cache = null; 
          find("sidebar").timer = 0; 
        }
        cb && cb(err);
      });
    },

    sidebar: function (cb) {
      find("sidebar").fetchAsync(cb);
    },

    footer: function (cb) {
      find("footer").fetchAsync(cb);
    },

    customStyle: function () {
      // Read sync because this info is needed by the layout
      return find("style").fetchSync();
    },

    customScript: function () {
      // Read sync because this info is needed by the layout
      return find("script").fetchSync();
    }
  };

  publicMethods.indexAsync = Promiser.promisify(publicMethods.index, publicMethods);
  publicMethods.generateAsync = Promiser.promisify(publicMethods.generate, publicMethods);
  publicMethods.sidebarAsync = Promiser.promisify(publicMethods.sidebar, publicMethods);
  publicMethods.footerAsync = Promiser.promisify(publicMethods.footer, publicMethods);
  
  return publicMethods;
}());
