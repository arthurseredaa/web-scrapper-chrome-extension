// Handle extension installation
chrome.runtime.onInstalled.addListener(function () {
  console.log('Extension installed');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Message received:', request);
  // Handle messages here
  sendResponse({ status: 'received' });
});
