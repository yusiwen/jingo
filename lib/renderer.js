/**
 * Renderer for markdown pages
 * */
var MarkdownIt = require("markdown-it");
var cryptoz = require("crypto");
var Nsh = require("node-syntaxhighlighter");
var Page = require("./models").Page;
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
  .use(require("markdown-it-task-lists"), {enabled: false})
  .use(require("markdown-it-container"), "note")
  .use(require("./markdown-it-arrow"), "arrow")
  .use(require("markdown-it-deflist"))
  .use(require("markdown-it-anchor"), {
    level: 2,
    permalink: true,
    permalinkBefore: true
  });

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

// Add attribute 'data-toc-text' in every headings
// for bootstap-toc to show its text in the TOC
md.core.ruler.push("headingClass", function (state) {

  var tokens = state.tokens;

  tokens
      .filter(function (token) {
        return token.type === "heading_open";
      })
      .forEach(function (token) {
        var heading = tokens[tokens.indexOf(token) + 1];
        if (heading.type === "inline") {
          // The next token will be heading text
          var title = tokens[tokens.indexOf(token) + 1].content;

          token.attrPush(["data-toc-text", title]);
        }
      });
});

var tagmap = {};

var Renderer = {

  render: function (content) {
    md.set({breaks: configuration.getConfig().application.gfmBreaks});

    return md.render(content);
  }

};

module.exports = Renderer;
