// -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

this.EXPORTED_SYMBOLS = [ "ReaderParent" ];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode", "resource://readerview/ReaderMode.jsm");

const gStringBundle = Services.strings.createBundle("chrome://readerview/locale/aboutReader.properties");

var ReaderParent = {
  updateReaderButton: function(browser) {
    let win = browser.ownerGlobal;
    if (browser != win.gBrowser.selectedBrowser) {
      return;
    }

    let button = win.document.getElementById("reader-mode-button");
    let command = win.document.getElementById("View:ReaderView");
    let key = win.document.getElementById("toggleReaderMode");
    if (browser.currentURI.spec.startsWith("about:reader")) {
      let closeText = gStringBundle.GetStringFromName("readerView.close");
      if (button) {
        button.setAttribute("state", "active");
        button.disabled = false;
        button.setAttribute("tooltiptext", closeText);
      }
      command.setAttribute("label", closeText);
      command.setAttribute("hidden", false);
      command.setAttribute("accesskey", gStringBundle.GetStringFromName("readerView.close.accesskey"));
      key.setAttribute("disabled", false);
    } else {
      let enterText = gStringBundle.GetStringFromName((browser.isArticle ? "readerView.enter" : "readerView.disabled"));
      if (button) {
        button.setAttribute("state", (browser.isArticle ? "enabled" : "disabled"));
        button.disabled = !browser.isArticle;
        button.setAttribute("tooltiptext", enterText);
      }
      command.setAttribute("label", enterText);
      command.setAttribute("hidden", !browser.isArticle);
      command.setAttribute("accesskey", gStringBundle.GetStringFromName("readerView.enter.accesskey"));
      key.setAttribute("disabled", !browser.isArticle);
    }
  },

  forceShowReaderIcon: function(browser) {
    browser.isArticle = true;
    this.updateReaderButton(browser);
  },

  buttonClick(event) {
    this.toggleReaderMode(event);
  },

  toggleReaderMode: function(event) {
    let win = event.target.ownerGlobal;
    win.AboutReaderListener.toggleReaderMode();
  }
};
