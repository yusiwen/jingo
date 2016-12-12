/**
 * Renderer for markdown pages 
 */

var MarkdownIt = require("markdown-it");
var cryptoz = require("crypto");
var Nsh = require("node-syntaxhighlighter");
var namer = require("./namer");
var Page = require("./models").Page;
var directives = require("./directives");
var Configurable = require("./configurable");

var Configuration = function () {
  Configurable.call(this);
};

Configuration.prototype = Object.create(Configurable.prototype);

var configuration = new Configuration();
var md = new MarkdownIt({
  html: true,
  xhtmlOut: true,
  linkify: true,
  typographer: true,
  highlight: function (code, lang) {
    lang = lang || "text";
    return Nsh.highlight(code, Nsh.getLanguage(lang) || Nsh.getLanguage("text"), {gutter: lang !== "text"});
  }
}).use(require("markdown-it-footnote"))
  .use(require("markdown-it-task-lists"), {enabled: false});

// Customize <code> block class when rendering code
md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
  var escapeHtml = md.utils.escapeHtml,
    unescapeAll = md.utils.unescapeAll,
    token = tokens[idx],
    info = token.info ? unescapeAll(token.info).trim() : "",
    langName = "",
    highlighted;

  if (info) {
    langName = info.split(/\s+/g)[0];
    token.attrPush([ "class", "md-code " + options.langPrefix + langName ]);
  }
  else {
    token.attrPush([ "class", "md-code" ]);
  }

  if (options.highlight) {
    highlighted = options.highlight(token.content, langName) || escapeHtml(token.content);
  }
  else {
    highlighted = escapeHtml(token.content);
  }

  return  "<code " + slf.renderAttrs(token) + ">"
          + highlighted
          + "</code>\n";
};

var tagmap = {};

// Yields the content with the rendered [[bracket tags]]
// The rules are the same for Gollum https://github.com/github/gollum
function extractTags(text) {
  tagmap = {};

  var matches = text.match(/(.?)\[\[(.+?)\]\]/g);
  var tag;
  var id;

  if (matches) {
    matches.forEach(function (match) {
      match = match.trim();
      tag = /(.?)\[\[(.+?)\]\](.?)/.exec(match);
      if (tag[1] === "'") {
        return;
      }
      id = cryptoz.createHash("sha1").update(tag[2]).digest("hex");
      tagmap[id] = tag[2];
      text = text.replace(tag[0], id);
    });
  }
  return text;
}

function evalTags(text) {
  var parts,
    name,
    url,
    pageName,
    re;

  for (var k in tagmap) {
    if (tagmap.hasOwnProperty(k)) {
      parts = tagmap[k].split("|");
      name = pageName = parts[0];
      if (parts[1]) {
        pageName = parts[1];
      }
      url = Page.urlFor(namer.wikify(pageName), "show", configuration.configObject.getProxyPath());

      tagmap[k] = "<a class=\"internal\" href=\"" + url + "\">" + name + "</a>";
    }
  }

  for (k in tagmap) {
    if (tagmap.hasOwnProperty(k)) {
      re = new RegExp(k, "g");
      text = text.replace(re, tagmap[k]);
    }
  }

  return text;
}

var directiveMap = directives.directiveMap;

function applyDirectives(text) {
  var matches = text.match(/\{\{([^}]*)\}\}/g);

  if (matches) {
    matches.forEach(function (match) {
      var directiveString = /\{\{([^}]*)\}\}/.exec(match)[1];
      var directiveSplit = directiveString.split("\n");
      var directive = directiveSplit[0];
      var args = directiveSplit.slice(1).join("\n");
      if (directive in directiveMap) {
        text = text.replace(match, directiveMap[directive](text, args));
      }
    });
  }
  return text;
}

var Renderer = {

  render: function (content) {
    md.set({breaks: configuration.getConfig().application.gfmBreaks});

    var text = extractTags(content);
    text = evalTags(text);
    text = applyDirectives(text);
    return md.render(text);
  }

};

module.exports = Renderer;
