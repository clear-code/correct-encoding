/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');
load('lib/textIO');

const WINDOW_TYPE_MESSAGE = 'mail:messageWindow';
const WINDOW_TYPE_3PANE   = 'mail:3pane';

function onMessageLoad(aEvent) {
  var win = aEvent.currentTarget.ownerDocument.defaultView;
  var msgWindow = win.msgWindow;

  var content = (aEvent.target.ownerDocument || aEvent.target).defaultView.top;

  var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
  var uri = IOService.newURI(content.location.href, null, null);
  var source = textIO.readFrom(uri);

  // I guess the first encoding information as the one for the message body.
  var matched = source.match(/^content-type:.+\bcharset=([^\s;]+)/im);
  if (matched)
    msgWindow.mailCharacterSet = matched[1];
}

function handleWindow(aWindow) {
  var doc = aWindow.document;
  var type = doc.documentElement.getAttribute('windowtype');
  if (type != WINDOW_TYPE_MESSAGE && type != WINDOW_TYPE_3PANE)
    return;

  var messagepane = doc.getElementById('messagepane');
  if (messagepane)
    messagepane.addEventListener('load', onMessageLoad, true);
}

WindowManager.getWindows(WINDOW_TYPE_MESSAGE).forEach(handleWindow);
WindowManager.getWindows(WINDOW_TYPE_3PANE).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown() {
  WindowManager.getWindows(WINDOW_TYPE_MESSAGE)
    .concat(WindowManager.getWindows(WINDOW_TYPE_3PANE))
    .forEach(function(aWindow) {
    var doc = aWindow.document;
    var messagepane = doc.getElementById('messagepane');
    if (messagepane)
      messagepane.removeEventListener('load', onMessageLoad, true);
  });

  WindowManager = undefined;
  handleWindow = undefined;
  onMessageLoad = undefined;
}
