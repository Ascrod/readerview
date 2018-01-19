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
  updateReaderButton: function(browser, showInUrlbar) {
    let win = browser.ownerGlobal;
    if (browser != win.gBrowser.selectedBrowser) {
      return;
    }

    let buttonFloat = win.document.getElementById("reader-mode-button");
    let buttonFixed = win.document.getElementById("reader-mode-button-fixed");
    let command = win.document.getElementById("View:ReaderView");
    let key = win.document.getElementById("key_toggleReaderMode");
    if (browser.currentURI.spec.startsWith("about:reader")) {
      let closeText = gStringBundle.GetStringFromName("readerView.close");
      if (buttonFloat) {
        buttonFloat.setAttribute("state", "active");
        buttonFloat.disabled = false;
        buttonFloat.setAttribute("tooltiptext", closeText);
        buttonFloat.hidden = showInUrlbar;
      } if (buttonFixed) {
        buttonFixed.setAttribute("state", "active");
        buttonFixed.hidden = !showInUrlbar;
        buttonFixed.setAttribute("tooltiptext", closeText);
      }
      command.setAttribute("label", closeText);
      command.setAttribute("hidden", false);
      command.setAttribute("accesskey", gStringBundle.GetStringFromName("readerView.close.accesskey"));
      key.setAttribute("disabled", false);
    } else {
      let enterText = gStringBundle.GetStringFromName((browser.isArticle ? "readerView.enter" : "readerView.disabled"));
      if (buttonFloat) {
        buttonFloat.setAttribute("state", (browser.isArticle ? "enabled" : "disabled"));
        buttonFloat.disabled = !browser.isArticle;
        buttonFloat.setAttribute("tooltiptext", enterText);
        buttonFloat.hidden = showInUrlbar;
      } if (buttonFixed) {
        buttonFixed.setAttribute("state", (browser.isArticle ? "enabled" : "disabled"));
        buttonFixed.hidden = !(showInUrlbar && browser.isArticle);
        buttonFixed.setAttribute("tooltiptext", enterText);
      }
      command.setAttribute("label", enterText);
      command.setAttribute("hidden", !browser.isArticle);
      command.setAttribute("accesskey", gStringBundle.GetStringFromName("readerView.enter.accesskey"));
      key.setAttribute("disabled", !browser.isArticle);
    }
  },

  forceShowReaderIcon(browser) {
    browser.isArticle = true;
    this.updateReaderButton(browser);
  },

  buttonClick(event) {
    this.toggleReaderMode(event);
  },

  toggleReaderMode(event) {
    let win = event.target.ownerGlobal;
    win.AboutReaderListener.toggleReaderMode();
  }
};
