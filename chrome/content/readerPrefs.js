/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The hotkey handling code is based on code used in several S3 add-ons
 * such as Menu Wizard and Download Manager. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");

var AboutReaderPrefs = {
  keyLinux: {
    modifiers: ["accel", "alt"],
    key: "R",
    keycode: ""
  },

  keyWindows: {
    modifiers: [],
    key: "",
    keycode: "VK_F9"
  },

  get prefReaderViewLocationURLBar() {
    delete this.prefReaderViewLocationURLBar;
    return this.prefReaderViewLocationURLBar =
      document.getElementById("pref-readerview-location-urlbar");
  },

  get prefReaderViewHotkeyEnabled() {
    delete this.prefReaderViewHotkeyEnabled;
    return this.prefReaderViewHotkeyEnabled =
      document.getElementById("pref-readerview-hotkey-enabled");
  },

  get prefReaderViewHotkeyValue() {
    delete this.prefReaderViewHotkeyValue;
    return this.prefReaderViewHotkeyValue =
      document.getElementById("pref-readerview-hotkey-value");
  },

  onLoad: function()
  {
    this.onHotkeyEnabledChange();
    this.initRadioGroup();
  },

  onAccept: function() {
    if (!Services.prefs.getBoolPref("browser.preferences.instantApply") && this.keyCurrent)
      Services.prefs.setCharPref("extensions.reader.hotkey.value", JSON.stringify(this.keyCurrent));
  },

  onReset: function() {
    this.prefReaderViewLocationURLBar.value = this.prefReaderViewLocationURLBar.defaultValue;
    this.prefReaderViewHotkeyEnabled.value = this.prefReaderViewHotkeyEnabled.defaultValue;
    this.prefReaderViewHotkeyValue.value = this.prefReaderViewHotkeyValue.defaultValue;

    this.initRadioGroup();
  },

  onHotkeyEnabledChange: function() {
    var gb = document.getElementById("groupbox-readerview-hotkey");
    var rg = document.getElementById("radiogroup-readerview-hotkey");
    var tb = document.getElementById("textbox-readerview-hotkey-display");

    var enabled  = this.prefReaderViewHotkeyEnabled.value;

    gb.childNodes.forEach(function(child) {
      child.disabled = !enabled;
    });

    if ((enabled) && (rg.selectedItem.value != "custom")) {
      tb.disabled = true;
    }
  },

  onHotkeySelectionChange: function() {
    var rg = document.getElementById("radiogroup-readerview-hotkey");
    var tb = document.getElementById("textbox-readerview-hotkey-display");
    var key = { modifiers: [], key: "", keycode: "" };
    switch (rg.selectedItem.value) {
      case "linux":
        key = this.keyLinux;
        tb.disabled = true;
        break;
      case "windows":
        key = this.keyWindows;
        tb.disabled = true;
        break;
      default:
        try {
          key = JSON.parse(this.prefReaderViewHotkeyValue.value);
        } catch(e) {
          Cu.reportError("Failed to parse Reader View hotkey configuration: " + e.message);
        }
        tb.select();
        tb.disabled = false;
        break;
    }
    tb.value = this.keyToString(key);
    this.updateHotkey(key);
  },

  onHotkeyCustomInput: function(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    var tb = event.target;
    var key = { modifiers: [], key: "", keycode: "" };
    for (var k of [ 'ctrl','meta','alt','shift' ]) {
      if (event[k + 'Key']) {
        if (k == 'ctrl') {
          k = 'control';
        }
        key.modifiers.push(k);
      }
    }

    // Ignore ENTER and ESC if no modifiers are present
    if ((key.modifiers.length == 0) &&
      ((event.keyCode == 13) || (event.keyCode == 27))) {
      tb.select();
      return;
    }

    // Set key or keycode as appropriate
    if (event.charCode == Ci.nsIDOMKeyEvent.DOM_VK_SPACE) {
      key.keycode = "VK_SPACE";
    } else if (event.keyCode == 8) {
      key.keycode = "VK_BACK";
    } else if (event.charCode) {
      key.key = String.fromCharCode(event.charCode).toUpperCase();
    } else {
      for (let [keycode, val] in Iterator(Ci.nsIDOMKeyEvent)) {
        if (val == event.keyCode) {
          key.keycode = keycode.replace("DOM_","");
          break;
        }
      }
    }

    // If we don't have a key or a keycode, give up.
    if ((key.key == '') && (key.keycode == '')) {
      tb.select();
      return;
    }

    // Set the display value
    tb.value = this.keyToString(key);
    tb.select();

    // Insert the "accel" modifier into the final value
    if (key.modifiers.length > 0) {
      for (var i = 0; i < key.modifiers.length; i++) {
        if (key.modifiers[i] == this.getAccelKey()) {
          key.modifiers[i] = 'accel';
        }
      }
    }

    this.updateHotkey(key);
  },

  updateHotkey: function(key) {
    if (Services.prefs.getBoolPref("browser.preferences.instantApply")) {
      this.prefReaderViewHotkeyValue.value = JSON.stringify(key);
      delete this.keyCurrent;
    } else {
      // If instant apply is off, we need to manually store the pref
      // value until the user clicks the Accept button.
      this.keyCurrent = key;
    }
  },

  initRadioGroup: function() {
    var key = this.prefReaderViewHotkeyValue.value;
    var rg = document.getElementById("radiogroup-readerview-hotkey");

    if (key == JSON.stringify(this.keyLinux)) {
      rg.selectedIndex = 0;
    } else if (key == JSON.stringify(this.keyWindows)) {
      rg.selectedIndex = 1;
    } else {
      rg.selectedIndex = 2;
    }

    this.onHotkeySelectionChange();
  },

  keyToString: function(key) {
    var result = [];
    var platformKeys_string = Services.strings.createBundle("chrome://global-platform/locale/platformKeys.properties");

    if (key.modifiers.length > 0) {
      for (var k of key.modifiers) {
        if (k == 'accel') {
          k = this.getAccelKey();
        }
        try {
          result.push(platformKeys_string.GetStringFromName("VK_" + k.toUpperCase()));
        } catch(e) {
          //Do nothing
        }
      }
    }

    if (key.key == " ") {
      key.key = "";
      key.keycode = "VK_SPACE";
    }
    if (key.key) {
      result.push(key.key.toUpperCase());
    }
    else if (key.keycode) {
      try {
        var keys_string = Services.strings.createBundle("chrome://global/locale/keys.properties");
        result.push(keys_string.GetStringFromName(key.keycode));
      } catch (e) {
        result.push('<' + key.keycode + '>');
      }
    }
    var separator = platformKeys_string.GetStringFromName("MODIFIER_SEPARATOR");
    return result.join(' ' + separator + ' ');
  },

  getAccelKey: function() {
    switch (Services.prefs.getIntPref("ui.key.accelKey")) {
      case 17:  return "control"; break;
      case 18:  return "alt"; break;
      case 224: return "meta"; break;
      default:  return "control";
    }
  },
}
