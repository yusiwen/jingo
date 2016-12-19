var router = require("express").Router();
var app = require("../lib/app").getInstance();
var _ = require("lodash");
var passportHTTP = require("passport-http");
var auth = app.locals.config.get("authentication");
var tools = require("../lib/tools");
var pageCache = require("../lib/cache");


var passport = app.locals.passport;
var proxyPath = app.locals.config.getProxyPath();

var components = require("../lib/components");

passport.use(new passportHTTP.BasicStrategy(

  function (username, password, done) {
    var wantedUsername = username.toLowerCase();
    var wantedHash = tools.hashify(password);
    if (auth.local.enabled) {
      var foundUser = _.find(auth.local.accounts, function (account) {
        return account.username.toLowerCase() === wantedUsername &&
              account.passwordHash === wantedHash;
      });
      if (!foundUser) {
        return done(null, false, {
          message: "Incorrect username or password"
        });
      }
      return done(null, foundUser);
    }
    else {
      return done(null, false);
    }
  }
));

router.post("/api/git/:action", passport.authenticate("basic", {
  session: false
}), function (req, res) {

  if (req.params.action === "pull")
    _doGitPull();
  else {
    res.statusCode = 405;
    res.json({ response: "Unsupported action: " + req.params.action});
    res.end();
    return;
  }
  
  res.statusCode = 202;
  res.json({ response: "Triggered" });
});

function _doGitPull() {
  console.log((new Date()) + " - Trigger git pull...");
  Git.pull(function (err) {
    if (err) {
      console.log((new Date()) + " - Git pull error: " + err);
    }
    else {
      console.log((new Date()) + " - Git pull success");
      components.generateAsync().then(function () {
        pageCache.cache.reset();
        console.log((new Date()) + " - Generate files success, reset cache...");
      }).catch(function (err) {
        console.log((new Date()) + " - Generate files catch exception: " + err);
      }).error(function (err) {
        console.log((new Date()) + " - Generate files error: " + err);
      });
    }
  });
}

module.exports = router;
