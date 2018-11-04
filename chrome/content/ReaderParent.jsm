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

XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode", "resource://gre/modules/ReaderMode.jsm");

const gGlobalStringBundle = Services.strings.createBundle("chrome://global/locale/aboutReader.properties");
const gLocalStringBundle = Services.strings.createBundle("chrome://readerview/locale/aboutReader.properties");

var ReaderParent = {
  updateReaderButton: function(browser, UIPrefs) {
    let win = browser.ownerGlobal;
    if (browser != win.gBrowser.selectedBrowser) {
      return;
    }

    let buttonFloat = win.document.getElementById("reader-mode-button");
    let buttonFixed = win.document.getElementById("reader-mode-button-fixed");
    let menuItem = win.document.getElementById("menu_readerModeItem");
    let command = win.document.getElementById("View:ReaderView");
    let key = win.document.getElementById("key_toggleReaderMode");
    let prefKey = UIPrefs.hotkeyValue;
    if (UIPrefs.hotkeyEnabled)
        menuItem.setAttribute("key", "key_toggleReaderMode");
    else
        menuItem.removeAttribute("key");

    if (browser.currentURI.spec.startsWith("about:reader")) {
      let closeText = gGlobalStringBundle.GetStringFromName("readerView.close");
      if (buttonFloat) {
        buttonFloat.setAttribute("state", "active");
        buttonFloat.disabled = false;
        buttonFloat.setAttribute("tooltiptext", closeText);
        buttonFloat.hidden = UIPrefs.showInUrlbar;
      } if (buttonFixed) {
        buttonFixed.setAttribute("state", "active");
        buttonFixed.hidden = !UIPrefs.showInUrlbar;
        buttonFixed.setAttribute("tooltiptext", closeText);
      }
      command.setAttribute("label", closeText);
      command.setAttribute("hidden", false);
      command.setAttribute("accesskey", gGlobalStringBundle.GetStringFromName("readerView.close.accesskey"));
      key.setAttribute("disabled", !UIPrefs.hotkeyEnabled);
    } else {
      let enterText = gGlobalStringBundle.GetStringFromName("readerView.enter");
      if (!browser.isArticle) {
        enterText = gLocalStringBundle.GetStringFromName("readerView.disabled");
      }
      if (buttonFloat) {
        buttonFloat.setAttribute("state", (browser.isArticle ? "enabled" : "disabled"));
        buttonFloat.disabled = !browser.isArticle;
        buttonFloat.setAttribute("tooltiptext", enterText);
        buttonFloat.hidden = UIPrefs.showInUrlbar;
      } if (buttonFixed) {
        buttonFixed.setAttribute("state", (browser.isArticle ? "enabled" : "disabled"));
        buttonFixed.hidden = !(UIPrefs.showInUrlbar && browser.isArticle);
        buttonFixed.setAttribute("tooltiptext", enterText);
      }
      command.setAttribute("label", enterText);
      command.setAttribute("hidden", !browser.isArticle);
      command.setAttribute("accesskey", gGlobalStringBundle.GetStringFromName("readerView.enter.accesskey"));
      key.setAttribute("disabled", !(browser.isArticle && UIPrefs.hotkeyEnabled));
    }
    menuItem.removeAttribute("acceltext");
    key.removeAttribute("key");
    key.removeAttribute("keycode");
    key.removeAttribute("modifiers");
    if (prefKey.key) {
        key.setAttribute("key", prefKey.key);
    }
    if (prefKey.keycode) {
        key.setAttribute("keycode", prefKey.keycode);
    }
    if (prefKey.modifiers.length > 0) {
        key.setAttribute("modifiers", prefKey.modifiers.join(" "));
    }

    // The key's keyset has to be re-added to its parent node, or the
    // new attributes won't be applied.
    let keyset = win.document.getElementById("mainKeyset");
    keyset.parentNode.appendChild(keyset);
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
