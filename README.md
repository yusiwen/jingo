# JINGO

A **git based** _wiki engine_ written for **node.js**, with a decent design, a search capability and a good typography.

## Introduction

This is my fork of [claudioc](https://github.com/claudioc)'s [original Jingo](https://github.com/claudioc/jingo).

## Enhancements

- Upgrade `jade` to `pug`.
- Change markdown renderer from [marked](https://github.com/chjj/marked) to [markdown-it](https://github.com/markdown-it/markdown-it), and add some plugins of it:
  - [markdown-it-footnote](https://github.com/markdown-it/markdown-it-footnote) to support footnotes.
  - [markdown-it-task-lists](https://github.com/revin/markdown-it-task-lists) to support checklists like `[x]`.
  - [markdown-it-anchor](https://github.com/valeriangalliat/markdown-it-anchor) to add permalinks to headings.
  - [markdown-it-container](https://github.com/markdown-it/markdown-it-container) to add custom containers in markdown files. Currently there is only one custom container `::: note` for notes and warnings in the documents.
  - [markdown-it-deflist](https://github.com/markdown-it/markdown-it-deflist) to support definition list (`<dl>`).
- Add remote APIs to trigger git actions.
  - `/api/git/:action` route.
  - Currently only git pull action is supported to be triggered.
  - Use [passport-http](https://github.com/jaredhanson/passport-http) to authenticate local user accounts in API calls. Other authentication methods are WIP.
- Disable polling to do git pull by default, remote pull can be triggered by API.
- Generate markdown TOC on the client side by using [bootstrap-toc](https://afeld.github.io/bootstrap-toc/) and remove [markdown-toc](https://github.com/jonschlinkert/markdown-toc).
- Using [lru-cache](https://github.com/isaacs/node-lru-cache) to cache pages, avoiding git operations on every page request, decreasing unnecessary I/O actions.
- Add support for GitBash running on Windows. Some git commands can't be executed on Windows GitBash. 
- Remove [Gollum](https://github.com/gollum/gollum)'s directives format support for cross-reference links. 
- Customizations: index page and sidebar page can't be editted, they are generated automatically according the markdown files in the repository. If no index page and sidebar page is assigned, user will be redirected to welcome page or list page.
- Some layout adjustments.
  - Toggle sidebar, if `customizations.sidebar` is assigned.
  - Add page meta data about creation date and user at the footer.
  - Redirect more system errors to 500 page
  - Check if there no change to the file when submit editting on the client side, avoiding git commit error.
  - Adjust text font to 'Palatino Linotype'.
  
## Installation

See original guide.

## Authentication and Authorization

No change.

## Configuration options changes

- [**NEW**] application.polling (false)

  If true, Jingo will try to polling to pull & push to the remote.

- [**REMOVED**] ~~application.pedanticMarkdown (boolean: true)~~

  No need to set this option, using [markdown-it](https://github.com/markdown-it/markdown-it) now.

- [**REMOVED**] ~~pages.index (string: "Home")~~

  Using `customizations.index` instead.

- [**NEW**] customizations.expired (number: 60)

  How long will customizations files expired in the cache. Default time is 60 minutes. Now every change to pages will automatically generate index page, and make its cache expired. Git pull trigger also does that.

- [**NEW**] customizations.index (string: "Home.md")

  The index file name. This file will be automatically generated.
