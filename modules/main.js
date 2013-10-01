/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');

const WINDOW_TYPE_MESSAGE = 'mail:messageWindow';
const WINDOW_TYPE_3PANE   = 'mail:3pane';

function handleWindow(aWindow) {
  var doc = aWindow.document;
  var type = doc.documentElement.getAttribute('windowtype');
  if (type != WINDOW_TYPE_MESSAGE && type != WINDOW_TYPE_3PANE)
    return;

}

WindowManager.getWindows(WINDOW_TYPE_MESSAGE).forEach(handleWindow);
WindowManager.getWindows(WINDOW_TYPE_3PANE).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown() {
  WindowManager.getWindows(WINDOW_TYPE_MESSAGE)
    .concat(WindowManager.getWindows(WINDOW_TYPE_3PANE))
    .forEach(function(aWindow) {
    var doc = aWindow.document;
  });

  WindowManager = undefined;
}
