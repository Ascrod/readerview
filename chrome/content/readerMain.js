/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ReaderParent", "chrome://readerview/content/ReaderParent.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode", "resource://gre/modules/ReaderMode.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AboutReader", "resource://gre/modules/AboutReader.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Readerable", "resource://gre/modules/Readerable.jsm");

var gStrings = Services.strings.createBundle("chrome://readerview/locale/aboutReader.properties");

var AboutReaderListener = {

  get version() {
    return "2.2.0";
  },

  init() {
    this.checkInstall();
    this.initContextMenu();

    gBrowser.addEventListener("AboutReaderContentLoaded", this, false, true);
    gBrowser.addEventListener("AboutReaderContentReady", this, false, true);
    gBrowser.addEventListener("DOMContentLoaded", this, false);
    gBrowser.addEventListener("pageshow", this, false);
    gBrowser.addEventListener("pagehide", this, false);
    gBrowser.addEventListener("AboutReaderOnSetup", this, false, true);
    gBrowser.addEventListener("AboutReaderButtonClicked-show-images-button", this, false, true);
    gBrowser.addEventListener("AboutReaderButtonClicked-hide-images-button", this, false, true);
    gBrowser.addProgressListener(this.browserWindowListener);
    gBrowser.addTabsProgressListener(this.tabsProgressListener);

    window.addEventListener("aftercustomization", this.onCustomizeEnd, false);
    window.addEventListener("SSTabRestored", this.onTabRestored, false);
  },

  //Check the install environment and determine whether we need to do any
  //first-run actions or preference migration.
  checkInstall() {
    var pb_rv = Services.prefs.getBranch("extensions.reader.");

    //Check if we have a version string.
    if (pb_rv.getPrefType("version") == Services.prefs.PREF_INVALID) {

      //Check for the first_run pref used in version 1.x.
      if (pb_rv.getPrefType("first_run") != Services.prefs.PREF_INVALID) {

        //Need to migrate preference values to toolkit.
        var pb_tk = Services.prefs.getBranch("reader.");
        var prefs = [
          "color_scheme",
          "color_scheme.values",
          "content_width",
          "errors.includeURLs",
          "font_size",
          "font_type",
          "has_used_toolbar",
          "line_height",
          "parse-node-limit",
          "parse-on-load.enabled",
          "parse-on-load.force-enabled",
          "toolbar.vertical"
        ];

        prefs.forEach(function(pref) {
          if (!pb_rv.prefHasUserValue(pref)) {
            return;
          }
          var type = pb_rv.getPrefType(pref);
          switch (type) {
            case Services.prefs.PREF_BOOL:
              pb_tk.setBoolPref(pref, pb_rv.getBoolPref(pref));
              break;
            case Services.prefs.PREF_INT:
              pb_tk.setIntPref(pref, pb_rv.getIntPref(pref));
              break;
            case Services.prefs.PREF_STRING:
              pb_tk.setCharPref(pref, pb_rv.getCharPref(pref));
              break;
          }
          pb_rv.clearUserPref(pref);
        });
        //Clear the first_run pref.
        pb_rv.clearUserPref("first_run");

      } else {

        //Fresh install.
        //Add the reader button to the urlbar.
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
    } else {
      //TODO: Check if our current version is higher than the saved version.
      //If so, do any other preference migration here.
      //Version numbers must follow the standard GNU versioning scheme:
      //  Major.Minor.Revision
    }

    //Set the current version
    pb_rv.setCharPref("version", this.version);
  },

  initContextMenu() {
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu)
      contextMenu.addEventListener("popupshowing", function(event) {
        var menuItem = document.getElementById("context-readerView");
        menuItem.hidden = !gContextMenu.onLink;
      }, false);
  },

  //Get overlay preferences
  get UIPrefs() {
    delete this.uiPrefs;

    Services.prefs.addObserver("extensions.reader.location.urlbar", this.UIPrefObserver, false);
    Services.prefs.addObserver("extensions.reader.hotkey.enabled", this.UIPrefObserver, false);
    Services.prefs.addObserver("extensions.reader.hotkey.value", this.UIPrefObserver, false);

    var location_pref = Services.prefs.getBoolPref("extensions.reader.location.urlbar");
    var hotkey_enabled_pref = Services.prefs.getBoolPref("extensions.reader.hotkey.enabled");
    var hotkey_value_pref = Services.prefs.getCharPref("extensions.reader.hotkey.value");

    // Parse the hotkey value
    var hotkey_value_obj = { modifiers: [], key: "", keycode: "" };
    try {
      hotkey_value_obj = JSON.parse(hotkey_value_pref);
    } catch (e) {
      Cu.reportError("Failed to parse Reader View hotkey configuration: " + e.message);
    }

    this.uiPrefs = {
      showInUrlbar: location_pref,
      hotkeyEnabled: hotkey_enabled_pref,
      hotkeyValue: hotkey_value_obj,
    }

    return this.uiPrefs;
  },

  //Observe UI preference value change
  UIPrefObserver: {
    observe(aMessage, aTopic, aData) {
      if (aTopic != "nsPref:changed") {
        return;
      }
      if (aData == "extensions.reader.location.urlbar" ||
          aData == "extensions.reader.hotkey.enabled" ||
          aData == "extensions.reader.hotkey.value")
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
    var scrollData = tabData.entries[tabData.entries.length-1].scroll;
    browser._scrollData = scrollData;
  },

  toggleReaderMode() {
    var browser = gBrowser.selectedBrowser;
    if (!this.isAboutReader(browser)) {
      browser._articlePromise = ReaderMode.parseDocument(browser.contentDocument).catch(Cu.reportError);
      ReaderMode.enterReaderMode(browser.contentDocument.docShell, browser.contentWindow);
    } else {
      browser._isLeavingReaderableReaderMode = this.isReaderableAboutReader(browser);
      ReaderMode.leaveReaderMode(browser.contentDocument.docShell, browser.contentWindow);
    }
  },

  openLink(url, newTab) {
    openReaderLinkIn(url, newTab ? "tab" : "current", { relatedToCurrent: true });
  },

  isAboutReader(browser) {
    if (!browser.contentWindow) {
      return false;
    }
    return browser.contentDocument.documentURI.startsWith("about:reader");
  },

  isReaderableAboutReader(browser) {
    return this.isAboutReader(browser) &&
      !browser.contentDocument.documentElement.dataset.isError;
  },

  handleEvent(aEvent) {
    var browser = gBrowser.getBrowserForDocument(aEvent.target.defaultView.document);
    if (!browser) {
      return;
    }

    switch (aEvent.type) {
      case "AboutReaderOnSetup":
        var showImages = Services.prefs.getBoolPref("extensions.reader.show_images");
        this.setupImageButton(browser.contentWindow, showImages);
        break;

      case "AboutReaderContentLoaded":
        if (!this.isAboutReader(browser)) {
          return;
        }

        if (browser.contentDocument.body) {
          // Update the toolbar icon to show the "reader active" icon.
          ReaderParent.updateReaderButton(browser, this.UIPrefs);
          new AboutReader(browser.contentWindow, browser._articlePromise);
          delete browser._articlePromise;
        }
        break;

      case "AboutReaderContentReady":
        if (!this.isAboutReader(browser)) {
          return;
        }

        //Update image visibility
        var showImages = Services.prefs.getBoolPref("extensions.reader.show_images");
        this.setImageVisibility(browser.contentDocument, showImages);

        if (!browser._scrollData) {
          return;
        }

        //Restore scroll position from session data
        var scrollData = browser._scrollData;
        scrollData = scrollData.split(",");
        scrollData = [parseInt(scrollData[0]) || 0, parseInt(scrollData[1]) || 0];
        browser.contentWindow.scrollTo(scrollData[0], scrollData[1]);
        delete browser._scrollData;
        break;

      case "AboutReaderButtonClicked-show-images-button":
          this.removeImageButton(browser.contentWindow, "show-images-button");
          this.setupImageButton(browser.contentWindow, false);
          this.setImageVisibility(browser.contentDocument, false);
          Services.prefs.setBoolPref("extensions.reader.show_images", false);
        break;

      case "AboutReaderButtonClicked-hide-images-button":
          this.removeImageButton(browser.contentWindow, "hide-images-button");
          this.setupImageButton(browser.contentWindow, true);
          this.setImageVisibility(browser.contentDocument, true);
          Services.prefs.setBoolPref("extensions.reader.show_images", true);
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

  setupImageButton(win, showImages) {
    if (showImages) {
      var button = {
        id: "show-images-button",
        title: gStrings.GetStringFromName("aboutReader.toolbar.hideImages"),
        image: "chrome://readerview/skin/reader/RM-Image-Show-24x24.svg"
      };
    } else {
      var button = {
        id: "hide-images-button",
        title: gStrings.GetStringFromName("aboutReader.toolbar.showImages"),
        image: "chrome://readerview/skin/reader/RM-Image-Hide-24x24.svg"
      };
    }
    win.dispatchEvent(new CustomEvent("AboutReaderAddButton", { detail: button }));
  },

  removeImageButton(win, id) {
    var data = { id: id };
    win.dispatchEvent(new CustomEvent("AboutReaderRemoveButton", { detail: data }));
  },

  setImageVisibility(doc, showImages) {
    let imgs = doc.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      let img = imgs[i];

      if (showImages)
        img.style.display = "";
      else
        img.style.display = "none";
    }
    Services.prefs.setBoolPref("extensions.reader.show_images", showImages);
  },

  /**
   * NB: this function will update the state of the reader button asynchronously
   * after the next mozAfterPaint call (assuming reader mode is enabled and
   * this is a suitable document). Calling it on things which won't be
   * painted is not going to work.
   */
  updateReaderButton(browser, forceNonArticle) {
    if (!Readerable.isEnabledForParseOnLoad || this.isAboutReader(browser) ||
        !browser.contentWindow || !(browser.contentDocument instanceof browser.contentWindow.HTMLDocument) ||
        browser.contentDocument.mozSyntheticDocument) {
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
    if (Readerable.isProbablyReaderable(browser.contentDocument)) {
      browser.isArticle = true;
    } else if (forceNonArticle) {
      browser.isArticle = false;
    }
    ReaderParent.updateReaderButton(browser, this.UIPrefs);

    //Automatically load reader view if requested to do so.
    if (browser.autoLoadReader && browser.isArticle)
    {
        delete browser.autoLoadReader;
        browser._articlePromise = ReaderMode.parseDocument(browser.contentDocument).catch(Cu.reportError);
        ReaderMode.enterReaderMode(browser.contentDocument.docShell, browser.contentWindow);
    }
  }
};

//Do initialization only once window has fully loaded
Services.obs.addObserver(function() {
  AboutReaderListener.init();
}, "browser-delayed-startup-finished", false);
