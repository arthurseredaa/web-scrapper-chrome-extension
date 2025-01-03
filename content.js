// This script runs in the context of web pages
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'parseData') {
    try {
      const baseElements = document.querySelectorAll(request.baseSelector);

      if (baseElements.length === 0) {
        sendResponse({ error: 'No elements found with the base selector' });
        return;
      }

      const results = Array.from(baseElements).map((baseElement) => {
        const item = {};
        request.fields.forEach((field) => {
          const element = baseElement.querySelector(field.selector);
          item[field.name] = element ? element.textContent.trim() : '';
        });
        return item;
      });

      sendResponse({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
  return true;
});
