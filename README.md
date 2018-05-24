# Reader View

As described on the Firefox support page, Reader View strips away clutter like buttons, ads, and background images, and changes the page's text size, contrast, and layout for better readability. This add-on brings that functionality to Pale Moon.

## Usage

This extension adds a button with the Reader Mode icon to the Pale Moon interface. When the add-on detects that a page is compatible with Reader View, the button will enable and the icon will turn blue. Clicking the button will enable Reader View for that page, and the icon will turn purple. Clicking the button again will exit Reader View, and the page will return to normal.

Reader View may also be activated by selecting "Enter Reader View" from the View menu, or by using the keyboard shortcut Ctrl + Alt + R.

Many features in Reader View are identical between Mozilla Firefox and this add-on, such as:

* Parse and render a page cleanly and clutter-free
* Activated with the simple click of a button
* Increase or decrease the line spacing between text
* Increase or decrease the font size
* Choose from light, dark, or sepia color schemes

The following features are exclusive to this add-on:

* Images may be shown or hidden using a button on the toolbar.
* The Reader button is now a movable toolbar button. (If you wish to see the Reader Mode button in the URL bar as it is in Firefox, you can set the `extensions.reader.location.urlbar` preference in `about:config` to `true`.)
* Options for automatically opening a link in Reader View are available on the context menu. (If the page is not compatible with Reader View, Reader View will not activate.)
* The keyboard shortcut may be disabled by setting the `extensions.reader.hotkey.enabled` preference in `about:config` to `false`.

Several features in the Firefox version are not included in this add-on:

* Text to speech/narration is not available.
* Pocket integration is not available.
* Telemetry is not included.

This add-on is available from the Pale Moon add-ons site:
https://addons.palemoon.org/addon/readerview/

Happy reading!

## Developers

To add your own button to the Reader toolbar, first listen for the `AboutReaderOnSetup` event on the DOM window, then dispatch an `AboutReaderAddButton` event on that DOM window. The event's detail object should contain three properties: the `id` to identify the button by, the `title` to display in the button's tooltip, and the `image` to be displayed on the button.
```
gBrowser.addEventListener("AboutReaderOnSetup", this, false, true);
...
handleEvent (aEvent) {
  var browser = gBrowser.getBrowserForDocument(aEvent.target.defaultView.document);
  switch (aEvent.type) {
    case "AboutReaderOnSetup":
      var button_data = {
        id: "my-button",
        title: "My Button",
        image: "chrome://myaddon/mybutton.svg"
      };
      var win = browser.contentWindow;
      win.dispatchEvent(new CustomEvent("AboutReaderAddButton", { detail: button_data }));
      break;
  }
}
```

To handle click events for your button, listen for the `AboutReaderButtonClicked-<id>` event, where `<id>` is your button's id.

```
gBrowser.addEventListener("AboutReaderButtonClicked-my-button", this, false, true);
...
case "AboutReaderButtonClicked-my-button":
  //Handle button click event
  break;
```

To remove your button from the toolbar, dispatch an `AboutReaderRemoveButton` event on the DOM window and specify your button's id in the event detail.

```
var win = browser.contentWindow;
var button_data = { id: "my_button" };
win.dispatchEvent(new CustomEvent("AboutReaderRemoveButton", { detail: button_data }));
```

## License

This code is licensed under Mozilla Public License 2.0, available at:
https://www.mozilla.org/en-US/MPL/2.0/


