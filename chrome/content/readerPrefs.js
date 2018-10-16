/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");

var AboutReaderPrefs = {
    onLoad: function()
    {
    },

    onReset: function() {
        var branch = Services.prefs.getBranch("extensions.reader.");
        branch.clearUserPref("location.urlbar");
        branch.clearUserPref("hotkey.enabled");
    }
}
