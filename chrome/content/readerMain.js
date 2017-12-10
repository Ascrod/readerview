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

//Method for adding reader button to toolbar on first run
var checkInstall = function() {
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
};

//Progress listeners for updating reader button
var XULBrowserWindowListener = {
  onLocationChange(aWebProgress, aRequest, aLocationURI, aFLags) {
    ReaderParent.updateReaderButton(gBrowser.selectedBrowser);
  }
};

var TabsProgressListener = {
  onLocationChange(aBrowser, aWebProgress, aRequest, aLocationURI,
                             aFlags) {
    // Filter out location changes caused by anchor navigation
    // or history.push/pop/replaceState.
    if (aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
      // Reader mode actually cares about these:
      AboutReaderListener.updateReaderButton(gBrowser.selectedBrowser.isArticle);
      return;
    }
  }
};

function onCustomizeEnd(event) {
  ReaderParent.updateReaderButton(gBrowser.selectedBrowser);
}

var AboutReaderListener = {

  _articlePromise: null,

  _isLeavingReaderableReaderMode: false,

  init() {
    gBrowser.addEventListener("AboutReaderContentLoaded", this, false, true);
    gBrowser.addEventListener("DOMContentLoaded", this, false);
    gBrowser.addEventListener("pageshow", this, false);
    gBrowser.addEventListener("pagehide", this, false);
  },

  toggleReaderMode() {
    if (!this.isAboutReader) {
      this._articlePromise = ReaderMode.parseDocument(content.document).catch(Cu.reportError);
      ReaderMode.enterReaderMode(content.document.docShell, content);
    } else {
      this._isLeavingReaderableReaderMode = this.isReaderableAboutReader;
      ReaderMode.leaveReaderMode(content.document.docShell, content);
    }
  },

  get isAboutReader() {
    if (!content) {
      return false;
    }
    return content.document.documentURI.startsWith("about:reader");
  },

  get isReaderableAboutReader() {
    return this.isAboutReader &&
      !content.document.documentElement.dataset.isError;
  },

  handleEvent(aEvent) {
    if (aEvent.originalTarget.defaultView != content) {
      return;
    }

    switch (aEvent.type) {
      case "AboutReaderContentLoaded":
        if (!this.isAboutReader) {
          return;
        }

        if (content.document.body) {
          // Update the toolbar icon to show the "reader active" icon.
          ReaderParent.updateReaderButton(gBrowser.selectedBrowser);
          new AboutReader(content, this._articlePromise);
          this._articlePromise = null;
        }
        break;

      case "pagehide":
        this.cancelPotentialPendingReadabilityCheck();
        // this._isLeavingReaderableReaderMode is used here to keep the Reader Mode icon
        // visible in the location bar when transitioning from reader-mode page
        // back to the readable source page.
        var browser = gBrowser.selectedBrowser;
        browser.isArticle = this._isLeavingReaderableReaderMode;
        ReaderParent.updateReaderButton(browser);
        if (this._isLeavingReaderableReaderMode) {
          this._isLeavingReaderableReaderMode = false;
        }
        break;

      case "pageshow":
        // If a page is loaded from the bfcache, we won't get a "DOMContentLoaded"
        // event, so we need to rely on "pageshow" in this case.
        if (aEvent.persisted) {
          this.updateReaderButton();
        }
        break;
      case "DOMContentLoaded":
        this.updateReaderButton();
        break;

    }
  },

  /**
   * NB: this function will update the state of the reader button asynchronously
   * after the next mozAfterPaint call (assuming reader mode is enabled and
   * this is a suitable document). Calling it on things which won't be
   * painted is not going to work.
   */
  updateReaderButton(forceNonArticle) {
    if (!ReaderMode.isEnabledForParseOnLoad || this.isAboutReader ||
        !content || !(content.document instanceof content.HTMLDocument) ||
        content.document.mozSyntheticDocument) {
      return;
    }

    this.scheduleReadabilityCheckPostPaint(forceNonArticle);
  },

  cancelPotentialPendingReadabilityCheck() {
    if (this._pendingReadabilityCheck) {
      gBrowser.removeEventListener("MozAfterPaint", this._pendingReadabilityCheck);
      delete this._pendingReadabilityCheck;
    }
  },

  scheduleReadabilityCheckPostPaint(forceNonArticle) {
    if (this._pendingReadabilityCheck) {
      // We need to stop this check before we re-add one because we don't know
      // if forceNonArticle was true or false last time.
      this.cancelPotentialPendingReadabilityCheck();
    }
    this._pendingReadabilityCheck = this.onPaintWhenWaitedFor.bind(this, forceNonArticle);
    gBrowser.addEventListener("MozAfterPaint", this._pendingReadabilityCheck);
  },

  onPaintWhenWaitedFor(forceNonArticle, event) {
    // In non-e10s, we'll get called for paints other than ours, and so it's
    // possible that this page hasn't been laid out yet, in which case we
    // should wait until we get an event that does relate to our layout. We
    // determine whether any of our content got painted by checking if there
    // are any painted rects.
    if (!event.clientRects.length) {
      return;
    }

    this.cancelPotentialPendingReadabilityCheck();
    // Only send updates when there are articles; there's no point updating with
    // |false| all the time.
    if (ReaderMode.isProbablyReaderable(content.document)) {
      var browser = gBrowser.selectedBrowser;
      browser.isArticle = true;
      ReaderParent.updateReaderButton(browser);
    } else if (forceNonArticle) {
      var browser = gBrowser.selectedBrowser;
      browser.isArticle = false;
      ReaderParent.updateReaderButton(browser);
    }
  }
};

//Do initialization only once window has fully loaded
window.addEventListener("load", function () {
  setTimeout(checkInstall, 5);
  gBrowser.addProgressListener(XULBrowserWindowListener);
  gBrowser.ownerGlobal.addEventListener("aftercustomization", onCustomizeEnd, false);
  gBrowser.addProgressListener(TabsProgressListener);
  AboutReaderListener.init();
}, false);
