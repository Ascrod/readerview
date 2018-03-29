/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ReaderParent", "resource://readerview/ReaderParent.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode", "resource://readerview/ReaderMode.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AboutReader", "resource://readerview/AboutReader.jsm");

var AboutReaderListener = {

  init() {
    this.checkInstall();
    gBrowser.addEventListener("AboutReaderContentLoaded", this, false, true);
    gBrowser.addEventListener("AboutReaderContentReady", this, false, true);
    gBrowser.addEventListener("DOMContentLoaded", this, false);
    gBrowser.addEventListener("pageshow", this, false);
    gBrowser.addEventListener("pagehide", this, false);
    gBrowser.addProgressListener(this.browserWindowListener);
    gBrowser.addTabsProgressListener(this.tabsProgressListener);
    window.addEventListener("aftercustomization", this.onCustomizeEnd, false);
    window.addEventListener("SSTabRestored", this.onTabRestored, false);
  },

  //Adds the reader button to the urlbar on first run.
  checkInstall() {
    var first_run = Services.prefs.getBoolPref("extensions.reader.first_run");
    if (first_run == true) {
      Services.prefs.setBoolPref("extensions.reader.first_run", false);
      const afterId = "urlbar-container";
      const buttonId = "reader-mode-button";
      var prevNode = document.getElementById(afterId);
      var button = document.getElementById(buttonId);
      if (prevNode && !button) {
        var toolbar = prevNode.parentNode;
        toolbar.insertItem(buttonId, prevNode.nextSibling);
        toolbar.setAttribute("currentset", toolbar.currentSet);
        document.persist(toolbar.id, "currentset");
      }
    }
  },

  //Get overlay preferences
  get UIPrefs() {
    delete this.uiPrefs;

    Services.prefs.addObserver("extensions.reader.location.urlbar", this.UIPrefObserver, false);
    Services.prefs.addObserver("extensions.reader.hotkey.enabled", this.UIPrefObserver, false);

    var location_pref = Services.prefs.getBoolPref("extensions.reader.location.urlbar");
    var hotkey_pref = Services.prefs.getBoolPref("extensions.reader.hotkey.enabled");

    this.uiPrefs = {
      showInUrlbar: location_pref,
      hotkeyEnabled: hotkey_pref
    }

    return this.uiPrefs;
  },

  //Observe UI preference value change
  UIPrefObserver: {
    observe(aMessage, aTopic, aData) {
      if (aTopic != "nsPref:changed") {
        return;
      }
      if (aData == "extensions.reader.location.urlbar" || aData == "extensions.reader.hotkey.enabled")
        ReaderParent.updateReaderButton(gBrowser.selectedBrowser, AboutReaderListener.UIPrefs);
    }
  },

  //Updates the reader button on change of the URL.
  browserWindowListener: {
    onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags) {
      ReaderParent.updateReaderButton(gBrowser.selectedBrowser, AboutReaderListener.UIPrefs);
    }
  },

  //Updates the reader button on anchor navigation and history change.
  tabsProgressListener: {
    onLocationChange(aBrowser, aWebProgress, aRequest, aLocationURI,
                               aFlags) {
      // Filter out location changes caused by anchor navigation
      // or history.push/pop/replaceState.
      if (aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
        // Reader mode actually cares about these:
        AboutReaderListener.updateReaderButton(aBrowser, aBrowser.isArticle);
        return;
      }
    }
  },

  //Updates the reader button after customization.
  onCustomizeEnd(aEvent) {
    ReaderParent.updateReaderButton(gBrowser.selectedBrowser, AboutReaderListener.UIPrefs);
  },

  //Begins restoring the scroll position after tab restore
  onTabRestored(aEvent) {
    var tab = aEvent.originalTarget;
    var browser = aEvent.originalTarget.linkedBrowser;
    if (!browser) {
      return;
    }

    if (!this.AboutReaderListener.isAboutReader(browser)) {
      return;
    }

    // Don't restore the scroll position of an about:reader page at this
    // point; listen for the custom event dispatched from AboutReader.jsm.
    var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
    var tabData = ss.getTabState(tab);
    tabData = JSON.parse(tabData);
    var scrollData = tabData.entries[0].scroll;
    browser._scrollData = scrollData;
  },

  toggleReaderMode() {
    var browser = gBrowser.selectedBrowser;
    if (!this.isAboutReader(browser)) {
      browser._articlePromise = ReaderMode.parseDocument(browser.contentWindow.document).catch(Cu.reportError);
      ReaderMode.enterReaderMode(browser.contentWindow.document.docShell, browser.contentWindow);
    } else {
      browser._isLeavingReaderableReaderMode = this.isReaderableAboutReader(browser);
      ReaderMode.leaveReaderMode(browser.contentWindow.document.docShell, browser.contentWindow);
    }
  },

  isAboutReader(browser) {
    if (!browser.contentWindow) {
      return false;
    }
    return browser.contentWindow.document.documentURI.startsWith("about:reader");
  },

  isReaderableAboutReader(browser) {
    return this.isAboutReader(browser) &&
      !browser.contentWindow.document.documentElement.dataset.isError;
  },

  handleEvent(aEvent) {
    var browser = gBrowser.getBrowserForDocument(aEvent.target.defaultView.document);
    if (!browser) {
      return;
    }

    switch (aEvent.type) {
      case "AboutReaderContentLoaded":
        if (!this.isAboutReader(browser)) {
          return;
        }

        if (browser.contentWindow.document.body) {
          // Update the toolbar icon to show the "reader active" icon.
          ReaderParent.updateReaderButton(browser, this.UIPrefs);
          new AboutReader(browser.contentWindow, browser._articlePromise);
          delete browser._articlePromise;
        }
        break;

      case "AboutReaderContentReady":
        if (!this.isAboutReader(browser) || !browser._scrollData) {
          return;
        }

        var scrollData = browser._scrollData;
        scrollData = scrollData.split(",");
        scrollData = [parseInt(scrollData[0]) || 0, parseInt(scrollData[1]) || 0];
        browser.contentWindow.scrollTo(scrollData[0], scrollData[1]);
        delete browser._scrollData;
        break;

      case "pagehide":
        this.cancelPotentialPendingReadabilityCheck(browser);
        // browser._isLeavingReaderableReaderMode is used here to keep the Reader Mode icon
        // visible in the location bar when transitioning from reader-mode page
        // back to the readable source page.
        browser.isArticle = (browser._isLeavingReaderableReaderMode || false);
        ReaderParent.updateReaderButton(browser, this.UIPrefs);
        if (browser._isLeavingReaderableReaderMode) {
          delete browser._isLeavingReaderableReaderMode;
        }
        break;

      case "pageshow":
        // If a page is loaded from the bfcache, we won't get a "DOMContentLoaded"
        // event, so we need to rely on "pageshow" in this case.
        if (aEvent.persisted) {
          this.updateReaderButton(browser);
        }
        break;
      case "DOMContentLoaded":
        this.updateReaderButton(browser);
        break;
    }
  },

  /**
   * NB: this function will update the state of the reader button asynchronously
   * after the next mozAfterPaint call (assuming reader mode is enabled and
   * this is a suitable document). Calling it on things which won't be
   * painted is not going to work.
   */
  updateReaderButton(browser, forceNonArticle) {
    if (!ReaderMode.isEnabledForParseOnLoad || this.isAboutReader(browser) ||
        !browser.contentWindow || !(browser.contentWindow.document instanceof browser.contentWindow.HTMLDocument) ||
        browser.contentWindow.document.mozSyntheticDocument) {
      return;
    }

    this.scheduleReadabilityCheckPostPaint(browser, forceNonArticle);
  },

  cancelPotentialPendingReadabilityCheck(browser) {
    if (browser._pendingReadabilityCheck) {
      browser.removeEventListener("MozAfterPaint", browser._pendingReadabilityCheck);
      delete browser._pendingReadabilityCheck;
    }
  },

  scheduleReadabilityCheckPostPaint(browser, forceNonArticle) {
    if (browser._pendingReadabilityCheck) {
      // We need to stop this check before we re-add one because we don't know
      // if forceNonArticle was true or false last time.
      this.cancelPotentialPendingReadabilityCheck(browser);
    }
    browser._pendingReadabilityCheck = this.onPaintWhenWaitedFor.bind(this, browser, forceNonArticle);
    browser.addEventListener("MozAfterPaint", browser._pendingReadabilityCheck);
  },

  onPaintWhenWaitedFor(browser, forceNonArticle, event) {
    // In non-e10s, we'll get called for paints other than ours, and so it's
    // possible that this page hasn't been laid out yet, in which case we
    // should wait until we get an event that does relate to our layout. We
    // determine whether any of our content got painted by checking if there
    // are any painted rects.
    if (!event.clientRects.length) {
      return;
    }

    this.cancelPotentialPendingReadabilityCheck(browser);
    // Only send updates when there are articles; there's no point updating with
    // |false| all the time.
    if (ReaderMode.isProbablyReaderable(browser.contentWindow.document)) {
      browser.isArticle = true;
    } else if (forceNonArticle) {
      browser.isArticle = false;
    }
    ReaderParent.updateReaderButton(browser, this.UIPrefs);
  }
};

//Do initialization only once window has fully loaded
Services.obs.addObserver(function() {
  AboutReaderListener.init();
}, "browser-delayed-startup-finished", false);
