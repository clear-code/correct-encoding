/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load('lib/WindowManager');
load('lib/textIO');

var { Promise } = Cu.import('resource://gre/modules/Promise.jsm', {});
var { Services } = Cu.import('resource://gre/modules/Services.jsm', {});

const WINDOW_TYPE_MESSAGE = 'mail:messageWindow';
const WINDOW_TYPE_3PANE   = 'mail:3pane';

function dump(message) {
  Services.console.logStringMessage(message);
}

function extractCharsetFromContentType(aSource) {
  var matched = aSource.match(/^content-type:.+\bcharset=([^\s;]+)/im);
  if (matched)
    return matched[1];
  return null;
}

function extractContentType(aSource) {
  var matched = aSource.match(/^content-type:\s+([^;\s]+)/i);
  if (matched)
    return matched[1];
  return null;
}

function splitParts(aSource) {
  var source = aSource.replace(/(\ncontent-type:\s+multipart\/mixed[^\r\n]*)\r?\n(\s+)/gi, '$1$2');
  // dump('MODIFIED BODY: \n'+source+'\n');
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

function detectCharsetByBrowser(aDocument, aSource) {
  var browser = aDocument.createElement('browser');
  browser.setAttribute('type', 'content');
  browser.setAttribute('style', 'visibility: collapse !important');
  aDocument.documentElement.appendChild(browser);
  try {
    var contentType = extractContentType(aSource);
    var uri = 'data:' + (contentType || 'text/plain') + ',' + escape(aSource);
    return new Promise(function(aResolve, aReject) {
      browser.addEventListener('load', function onLoad() {
        browser.removeEventListener('load', onLoad, true);
        var charset = browser.contentDocument.characterSet;
        // dump('BROWSER CHARSET: '+charset+'\n');
        aDocument.documentElement.removeChild(browser);
        if (charset)
          aResolve(charset);
        else
          aReject(new Error('no charset detected'));
      }, true);
      browser.loadURI(uri);
    });
  }
  catch(error) {
    Cu.reportError(error);
    aDocument.documentElement.removeChild(browser);
    return Promise.reject(error);
  }
}


function trySetCharsetFromHeader(aMsgWindow, aParts) {
  if (!aParts)
    return Promise.reject(new Error('no parts'));

  var charset = extractCharsetFromContentType(aParts.headers);
  if (charset) {
    aMsgWindow.mailCharacterSet = charset;
    return Promise.resolve(charset);
  }
  return Promise.reject(new Error('no charset information in headers'));
}

function trySetCharsetAttachedBodyHeader(aMsgWindow, aParts) {
  if (!aParts)
    return Promise.reject(new Error('no parts'));

  var charset = extractCharsetFromContentType(getHeadersPart(aParts.attachedBody));
  if (charset) {
    aMsgWindow.mailCharacterSet = charset;
    return Promise.resolve(charset);
  }
  return Promise.reject(new Error('no charset information in attached body header'));
}

function trySetCharsetFromAttachedBody(aMsgWindow, aParts, aDocument) {
  if (!aParts)
    return Promise.reject(new Error('no parts'));

  return detectCharsetByBrowser(aDocument, aParts.attachedBody)
           .then(function(aCharset) {
             aMsgWindow.mailCharacterSet = aCharset;
             return aCharset;
           })
           .catch(function(aError) {
             throw new Error('failed to detect charset from attached body');
           });
}

function trySetCharsetFromPlaintextBody(aMsgWindow, aParts, aDocument) {
  if (!aParts)
    return Promise.reject(new Error('no parts'));

  return detectCharsetByBrowser(aDocument, aParts.plaintextBody)
           .then(function(aCharset) {
             aMsgWindow.mailCharacterSet = aCharset;
             return aCharset;
           })
           .catch(function(aError) {
             throw new Error('failed to detect charset from plaintext body');
           });
}

function trySetCharsetFromFirstGuessedCharset(aMsgWindow, aSoruce) {
  var charset = extractCharsetFromContentType(aSoruce);
  if (charset) {
    aMsgWindow.mailCharacterSet = charset;
    return Promise.resolve(charset);
  }
  return Promise.reject(new Error('no charset information in whole source'));
}

function onMessageLoad(aEvent) {
  var win = aEvent.currentTarget.ownerDocument.defaultView;
  var msgWindow = win.msgWindow;

  var content = (aEvent.target.ownerDocument || aEvent.target).defaultView.top;

  var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
  var uri = IOService.newURI(content.location.href, null, null);
  var source = textIO.readFrom(uri);

  var parts = splitParts(source);
  trySetCharsetFromHeader(msgWindow, parts)
    .then(function(aCharset) { dump('trySetCharsetFromHeader: ' + aCharset + '\n'); })
    .catch(function() {
      return trySetCharsetAttachedBodyHeader(msgWindow, parts)
               .then(function(aCharset) { dump('trySetCharsetAttachedBodyHeader: ' + aCharset + '\n'); });
    })
    .catch(function() {
      return trySetCharsetFromAttachedBody(msgWindow, parts, win.document)
               .then(function(aCharset) { dump('trySetCharsetFromAttachedBody: ' + aCharset + '\n'); });
    })
    .catch(function() {
      return trySetCharsetFromPlaintextBody(msgWindow, parts, win.document)
               .then(function(aCharset) { dump('trySetCharsetFromPlaintextBody: ' + aCharset + '\n'); });
    })
    .catch(function(aError) {
      return trySetCharsetFromFirstGuessedCharset(msgWindow, source)
               .then(function(aCharset) { dump('trySetCharsetFromFirstGuessedCharset: ' + aCharset + '\n'); });
    })
    .catch(function(aError) {
      Cu.reportError(aError);
      dump('failed to detect charset: ' + aError + '\n');
    });
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
