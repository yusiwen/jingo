/* global Git */

var router = require("express").Router();
var namer = require("../lib/namer");
var app = require("../lib/app").getInstance();
var models = require("../lib/models");
var components = require("../lib/components");
var pageCache = require("../lib/cache");


models.use(Git);

router.get("/pages/new", _getPagesNew);
router.get("/pages/new/:page", _getPagesNew);
router.get("/pages/:page/edit", _getPagesEdit);
router.post("/pages", _postPages); // For create new page
router.put("/pages/:page", _putPages); // For update page
router.delete("/pages/:page", _deletePages);
router.get("/pages/:page/revert/:version", _getRevert);

var pagesConfig = app.locals.config.get("pages");
var proxyPath = app.locals.config.getProxyPath();

function _deletePages(req, res) {
  var page = new models.Page(req.params.page);

  if (page.isIndex() || !page.exists()) {
    req.session.notice = "The page cannot be deleted.";
    res.redirect(proxyPath + "/");
    return;
  }

  page.author = req.user.asGitAuthor;

  page.remove().then(function () {
    return components.generateAsync();
  }).then(function () {
    page.unlock();

    if (page.isFooter()) {
      app.locals._footer = null;
    }

    if (page.isSidebar()) {
      app.locals._sidebar = null;
    }

    pageCache.removeKeys(req.params.page);
    
    req.session.notice = "The page `" + page.wikiname + "` has been deleted.";
    res.redirect(proxyPath + "/");
  });
}

function _getPagesNew(req, res) {
  var page;
  var title = "";

  if (req.params.page && !req.session.errors) {
    // If there is no error and page title is not null, check page existence
    title = namer.unwikify(req.params.page);
    page = new models.Page(title);
    if (page.exists()) {
      res.redirect(page.urlForShow());
      return;
    }
  }

  res.locals.errors = req.session.errors;
  res.locals.formData = req.session.formData || {};
  delete req.session.errors;
  delete req.session.formData;

  res.render("create", {
    title: "Jingo – Create page " + title,
    pageTitle: title,
    pageName: page ? page.wikiname : ""
  });
}

function _postPages(req, res) {
  var errors, pageName;

  if (pagesConfig.title.fromFilename) {
    // pageName (from url) is not considered
    pageName = req.body.pageTitle;
  }
  else {
    // pageName (from url) is more important
    pageName = (namer.unwikify(req.body.pageName) || req.body.pageTitle);
  }

  var page = new models.Page(pageName);

  // Check if page is one of components, if true, redirect back with notice
  if (components.isComponent(pageName)) {
    console.log((new Date()) + "- Create component files is not allowed");
    req.session.errors = [{msg: "The component page `" + pageName + "` can't be created. It'll be generated automatically. Please change title."}];
    req.session.formData = {
      pageTitle: req.body.pageTitle
    };
    res.redirect(page.urlForNewWithError());
    return;
  }

  req.check("pageTitle", "The page title cannot be empty").notEmpty();
  req.check("content", "The page content cannot be empty").notEmpty();

  errors = req.validationErrors();

  if (errors) {
    req.session.errors = errors;
    // If the req.body is too big, the cookie session-store will crash,
    // logging out the user. For this reason we use the sessionStorage
    // on the client to save the body when submitting
    //    req.session.formData = req.body;
    req.session.formData = {
      pageTitle: req.body.pageTitle
    };
    res.redirect(page.urlForNewWithError());
    return;
  }

  req.sanitize("pageTitle").trim();
  req.sanitize("content").trim();

  if (page.exists()) {
    req.session.errors = [{msg: "A document with this title already exists"}];
    req.session.formData = {
      pageTitle: req.body.pageTitle
    };
    res.redirect(page.urlForNewWithError());
    return;
  }

  page.author = req.user.asGitAuthor;
  page.title = req.body.pageTitle;
  page.content = req.body.content;

  page.save().then(function () {
    return components.generateAsync();
  }).then(function () {
    req.session.notice = "The page has been created. <a href=\"" + page.urlForEdit() + "\">Edit it again?</a>";
    res.redirect(page.urlForShow());
  }).catch(function (err) {
    res.locals.title = "500 - Internal server error";
    res.statusCode = 500;
    console.log(err);
    res.render("500.pug", {
      message: "Sorry, something went wrong and I cannot recover. If you think this might be a bug in Jingo, please file a detailed report about what you were doing here: https://github.com/claudioc/jingo/issues . Thank you!",
      error: err
    });
  });
}

function _putPages(req, res) {
  var errors, page;

  page = new models.Page(req.params.page);

  req.check("pageTitle", "The page title cannot be empty").notEmpty();
  req.check("content", "The page content cannot be empty").notEmpty();

  errors = req.validationErrors();

  if (errors) {
    fixErrors();
    return;
  }

  // Highly unluckly (someone deleted the page we were editing)
  if (!page.exists()) {
    req.session.notice = "The page does not exist anymore.";
    res.redirect(proxyPath + "/");
    return;
  }

  req.sanitize("pageTitle").trim();
  req.sanitize("content").trim();
  req.sanitize("message").trim();

  page.author = req.user.asGitAuthor;

  // Test if the user changed the name of the page and try to rename the file
  // If the title is from filename, we cannot overwrite an existing filename
  // If the title is from content, we never rename a file and the problem does not exist
  if (app.locals.config.get("pages").title.fromFilename &&
      page.name.toLowerCase() !== req.body.pageTitle.toLowerCase()) {
    pageCache.removeKeys(page.name);
    page.renameTo(req.body.pageTitle)
          .then(savePage)
          .catch(function (ex) {
            errors = [{
              param: "pageTitle",
              msg: "A page with this name already exists.",
              value: ""
            }];
            fixErrors();
          });
  }
  else {
    savePage();
  }

  function savePage() {
    page.title = req.body.pageTitle;
    page.content = req.body.content;
    page.save(req.body.message).then(function () {
      return components.generateAsync();
    }).then(function () {
      page.unlock();

      if (pageCache.cache.has(pageCache.getKey(page.name))) {
        pageCache.cache.del(pageCache.getKey(page.name)); // Force reload page next time
      }

      req.session.notice = "The page has been updated. <a href=\"" + page.urlForEdit() + "\">Edit it again?</a>";
      res.redirect(page.urlForShow());
    }).catch(function (err) {
      res.locals.title = "500 - Internal server error";
      res.statusCode = 500;
      console.log(err);
      res.render("500.pug", {
        message: "Sorry, something went wrong and I cannot recover. If you think this might be a bug in Jingo, please file a detailed report about what you were doing here: https://github.com/claudioc/jingo/issues . Thank you!",
        error: err
      });
    });
  }

  function fixErrors() {
    req.session.errors = errors;
    // If the req.body is too big, the cookie session-store will crash,
    // logging out the user. For this reason we use the sessionStorage
    // on the client to save the body when submitting
    //    req.session.formData = req.body;
    req.session.formData = {
      pageTitle: req.body.pageTitle,
      message: req.body.message
    };
    res.redirect(page.urlForEditWithError());
  }
}

function _getPagesEdit(req, res) {
  var page = new models.Page(req.params.page);
  var warning;

  if (!page.lock(req.user)) {
    warning = "Warning: this page is probably being edited by " + page.lockedBy.displayName;
  }

  models.repositories.refreshAsync().then(function () {
    return page.fetch();
  }).then(function () {
    if (!req.session.formData) {
      res.locals.formData = {
        pageTitle: page.title,
        content: page.content
      };
    }
    else {
      res.locals.formData = req.session.formData;
      // FIXME remove this when the sessionStorage fallback will be implemented
      if (!res.locals.formData.content) {
        res.locals.formData.content = page.content;
      }
    }

    res.locals.errors = req.session.errors;

    delete req.session.errors;
    delete req.session.formData;

    res.render("edit", {
      title: "Jingo – Edit page " + page.title,
      page: page,
      warning: warning
    });
  }).error(function (err) {
    res.locals.title = "500 - Internal server error";
    res.statusCode = 500;
    console.log(err);
    res.render("500.pug", {
      message: "Sorry, something went wrong and I cannot recover. If you think this might be a bug in Jingo, please file a detailed report about what you were doing here: https://github.com/claudioc/jingo/issues . Thank you!",
      error: err
    });
  });
}

function _getRevert(req, res) {
  var page = new models.Page(req.params.page, req.params.version);

  page.author = req.user.asGitAuthor;

  page.fetch().then(function () {
    if (!page.error) {
      page.revert();
      
      pageCache.removeKeys(req.params.page);

      res.redirect(page.urlFor("history"));
    }
    else {
      res.locals.title = "500 - Internal Server Error";
      res.statusCode = 500;
      res.render("500.pug");
      return;
    }
  });
}

module.exports = router;
