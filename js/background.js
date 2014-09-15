/* jshint undef: true, unused: true */
/* global chrome */

// launch main application window
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('../main.html', {
    'id': 'cmsHacksAppWindow',
    'bounds': {
      'width': 400,
      'height': 500
    },
    minWidth: 400,
    minHeight: 500
  });
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('installed');
});

chrome.runtime.onSuspend.addListener(function() {
  // Do some simple clean-up tasks.
});
