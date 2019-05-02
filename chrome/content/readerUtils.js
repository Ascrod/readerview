/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Cu.import("resource:///modules/RecentWindow.jsm");

/* openReaderLinkIn opens a URL in a place specified by the parameter |where|.
 * Upon opening the URL and loading the DOM, the tab immediately enters Reader Mode.
 *
 * |where| can be:
 *  "current"     current tab            (if there aren't any browser windows, then in a new window instead)
 *  "tab"         new tab                (if there aren't any browser windows, then in a new window instead)
 *  "tabshifted"  same as "tab" but in background if default is to select new tabs, and vice versa
 *  "window"      new window
 *
 * This method is based on the openLinkIn method found in utilityOverlay.js.
 */
function openReaderLinkIn(url, where, params) {
  if (!where || !url)
    return;

  var aAllowThirdPartyFixup = params.allowThirdPartyFixup;
  var aPostData             = params.postData;
  var aCharset              = params.charset;
  var aReferrerURI          = params.referrerURI;
  var aRelatedToCurrent     = params.relatedToCurrent;
  var aInBackground         = params.inBackground;
  var aDisallowInheritPrincipal = params.disallowInheritPrincipal;
  var aInitiatingDoc        = params.initiatingDoc;
  var aIsPrivate            = params.private;
  var sendReferrerURI       = true;

  const Cc = Components.classes;
  const Ci = Components.interfaces;

  var w = getTopWin();
  if ((where == "tab" || where == "tabshifted") &&
      w && !w.toolbar.visible) {
    w = getTopWin(true);
    aRelatedToCurrent = false;
  }

  if (!w || where == "window") {
    // Strip referrer data when opening a new private window, to prevent
    // regular browsing data from leaking into it.
    if (aIsPrivate) {
      sendReferrerURI = false;
    }

    var sa = Cc["@mozilla.org/supports-array;1"].
             createInstance(Ci.nsISupportsArray);

    var wuri = Cc["@mozilla.org/supports-string;1"].
               createInstance(Ci.nsISupportsString);
    wuri.data = url;

    let charset = null;
    if (aCharset) {
      charset = Cc["@mozilla.org/supports-string;1"]
                  .createInstance(Ci.nsISupportsString);
      charset.data = "charset=" + aCharset;
    }

    var allowThirdPartyFixupSupports = Cc["@mozilla.org/supports-PRBool;1"].
                                       createInstance(Ci.nsISupportsPRBool);
    allowThirdPartyFixupSupports.data = aAllowThirdPartyFixup;

    sa.AppendElement(wuri);
    sa.AppendElement(charset);
    if (sendReferrerURI)
      sa.AppendElement(aReferrerURI);
    sa.AppendElement(aPostData);
    sa.AppendElement(allowThirdPartyFixupSupports);

    let features = "chrome,dialog=no,all";
    if (aIsPrivate) {
      features += ",private";
    }

    Services.ww.openWindow(w || window, getBrowserURL(), null, features, sa);
    return;
  }

  let loadInBackground = where == "current" ? false : aInBackground;
  if (loadInBackground == null) {
    loadInBackground = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
  }

  if (where == "current" && w.gBrowser.selectedTab.pinned) {
    try {
      let uriObj = Services.io.newURI(url, null, null);
      if (!uriObj.schemeIs("javascript") &&
          w.gBrowser.currentURI.host != uriObj.host) {
        where = "tab";
        loadInBackground = false;
      }
    } catch (err) {
      where = "tab";
      loadInBackground = false;
    }
  }

  // Raise the target window before loading the URI, since loading it may
  // result in a new frontmost window (e.g. "javascript:window.open('');").
  w.focus();

  switch (where) {
  case "current":
    let flags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
    if (aAllowThirdPartyFixup) {
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
    }
    if (aDisallowInheritPrincipal)
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_DISALLOW_INHERIT_OWNER;
    w.gBrowser.selectedBrowser.autoLoadReader = true;
    w.gBrowser.loadURIWithFlags(url, flags, aReferrerURI, null, aPostData);
    break;
  case "tabshifted":
    loadInBackground = !loadInBackground;
    // fall through
  case "tab":
    var tab = w.gBrowser.loadOneTab(url, {
                       referrerURI: aReferrerURI,
                       charset: aCharset,
                       postData: aPostData,
                       inBackground: loadInBackground,
                       allowThirdPartyFixup: aAllowThirdPartyFixup,
                       relatedToCurrent: aRelatedToCurrent});
    var browser = gBrowser.getBrowserForTab(tab);
    browser.autoLoadReader = true;
    break;
  }

  w.gBrowser.selectedBrowser.focus();

  if (!loadInBackground && w.isBlankPageURL(url))
    w.focusAndSelectUrlBar();
}
