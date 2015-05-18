/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');
load('lib/textIO');

const WINDOW_TYPE_MESSAGE = 'mail:messageWindow';
const WINDOW_TYPE_3PANE   = 'mail:3pane';

function extractCharsetFromContentType(aSource) {
  var matched = aSource.match(/^content-type:.+\bcharset=([^\s;]+)/im);
  if (matched)
    return matched[1];
  return null;
}

function splitParts(aSource) {
  var source = aSource.replace(/(\ncontent-type:\s+multipart\/mixed\b.*)\n(\s+)/gi, '$1$2');
  var boundary = source.match(/\ncontent-type:\s+multipart\/mixed.*\sboundary=(.+)/i);
  if (boundary) {
    boundary = boundary[1];
    boundary = boundary.replace(/^\"([^\"]+)\"/, '$1');
    boundary = boundary.replace(/^'([^']+)'/, '$1');
    let sources = source.split(boundary);
    return {
      headers:       sources[0] + boundary + getHeadersPart(sources[1]),
      plaintextBody: sources[1],
      attachedBody:  sources[2],
      attachments:   sources.slice(3)
    };
  }
  return null;
}

function getHeadersPart(aSource) {
  return aSource.split('\n\n')[0];
}

function onMessageLoad(aEvent) {
  var win = aEvent.currentTarget.ownerDocument.defaultView;
  var msgWindow = win.msgWindow;

  var content = (aEvent.target.ownerDocument || aEvent.target).defaultView.top;

  var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
  var uri = IOService.newURI(content.location.href, null, null);
  var source = textIO.readFrom(uri);

  var parts = splitParts(source);
  if (parts) {
    let charsetFromHeader = extractCharsetFromContentType(parts.headers);
    dump('charsetFromHeader: '+charsetFromHeader+'\n');
    if (charsetFromHeader)
      return msgWindow.mailCharacterSet = charsetFromHeader;

    let charsetFromAttachedBodyHeader = extractCharsetFromContentType(getHeadersPart(parts.attachedBody));
    dump('charsetFromAttachedBodyHeader: '+charsetFromAttachedBodyHeader+'\n');
    if (charsetFromAttachedBodyHeader)
      return msgWindow.mailCharacterSet = charsetFromAttachedBodyHeader;
  }

  var firstCharsetFromHeaders = extractCharsetFromContentType(source);
  dump('firstCharsetFromHeaders: '+firstCharsetFromHeaders+'\n');
  if (firstCharsetFromHeaders)
    msgWindow.mailCharacterSet = firstCharsetFromHeaders;
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
