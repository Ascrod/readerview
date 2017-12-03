/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var factory;
const ABOUTPAGE_DESCRIPTION = "about:reader";
const ABOUTPAGE_ID = "c0bbcc77-8951-4c37-97a4-59e907358680";
const ABOUTPAGE_WORD = "reader";
const ABOUTPAGE_URI = "chrome://readerview/content/aboutReader.html";

function AboutReader() { }

AboutReader.prototype = Object.freeze({
  classDescription: ABOUTPAGE_DESCRIPTION,
  contractID: "@mozilla.org/network/protocol/about;1?what=" + ABOUTPAGE_WORD,
  classID: Components.ID("{" + ABOUTPAGE_ID + "}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    let channel = Services.io.newChannel(ABOUTPAGE_URI, null, null);
    channel.originalURI = aURI;
    return channel;
  }
});

let NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutReader]);
