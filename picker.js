// Check if the script is already initialized
if (typeof window.isPickingElementInitialized === 'undefined') {
  window.isPickingElementInitialized = true;

  let isPickingElement = false;
  let hoveredElement = null;
  let originalBorder = null;
  let originalOutline = null;
  let baseSelector = null;

  // Add logging function
  function logPickedElement(element, selector, isBase = false) {
    try {
      console.group(isBase ? 'Base Element Picked' : 'Field Element Picked');
      console.log('Element:', element);
      console.log('Generated Selector:', selector);
      console.log('Element Text:', element.textContent.trim());
      console.log('Element HTML:', element.outerHTML);
      if (!isBase) {
        console.log('Base Selector:', baseSelector);
      }
      console.groupEnd();
    } catch (error) {
      console.error('Error logging picked element:', error);
    }
  }

  window.enableElementPicker = function (baseSelectorValue) {
    try {
      isPickingElement = true;
      baseSelector = baseSelectorValue;
      document.body.style.cursor = 'crosshair';

      // Add highlight on hover
      document.addEventListener('mouseover', highlightElement, true);
      document.addEventListener('mouseout', removeHighlight, true);
      document.addEventListener('click', handleElementClick, true);

      // Log picker state
      console.log(
        'Element picker enabled',
        baseSelector ? 'for field element' : 'for base element'
      );
    } catch (error) {
      console.error('Error enabling picker:', error);
    }
  };

  window.disableElementPicker = function () {
    try {
      isPickingElement = false;
      document.body.style.cursor = 'default';
      baseSelector = null;

      if (hoveredElement) {
        removeHighlight({ target: hoveredElement });
      }

      document.removeEventListener('mouseover', highlightElement, true);
      document.removeEventListener('mouseout', removeHighlight, true);
      document.removeEventListener('click', handleElementClick, true);

      console.log('Element picker disabled');
    } catch (error) {
      console.error('Error disabling picker:', error);
    }
  };

  function highlightElement(event) {
    try {
      if (!isPickingElement) return;

      // Check if we can access the element
      if (!event.target || !event.target.ownerDocument) return;

      event.stopPropagation();
      hoveredElement = event.target;

      // Store original styles
      originalBorder = hoveredElement.style.border;
      originalOutline = hoveredElement.style.outline;

      // Add highlight
      hoveredElement.style.border = '2px solid #ff0000';
      hoveredElement.style.outline = '1px solid #ff0000';
    } catch (error) {
      console.error('Error highlighting element:', error);
    }
  }

  function removeHighlight(event) {
    try {
      if (!isPickingElement) return;

      // Check if we can access the element
      if (!event.target || !event.target.ownerDocument) return;

      event.stopPropagation();
      const element = event.target;

      // Restore original styles
      element.style.border = originalBorder;
      element.style.outline = originalOutline;
    } catch (error) {
      console.error('Error removing highlight:', error);
    }
  }

  function handleElementClick(event) {
    try {
      if (!isPickingElement) return;

      // Check if we can access the element
      if (!event.target || !event.target.ownerDocument) return;

      event.preventDefault();
      event.stopPropagation();

      const element = event.target;
      let selector;

      if (baseSelector) {
        // If we have a base selector, generate relative selector
        selector = generateRelativeSelector(element, baseSelector);
        logPickedElement(element, selector, false);
      } else {
        // If no base selector, generate full selector
        selector = generateSelector(element);
        logPickedElement(element, selector, true);
      }

      // Send selector back to popup
      chrome.runtime.sendMessage({
        action: 'elementSelected',
        selector: selector,
      });

      disableElementPicker();
    } catch (error) {
      console.error('Error handling element click:', error);
      disableElementPicker();
    }
  }

  function generateSelector(element) {
    // Try to generate a unique selector
    let selector = '';

    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try classes
    if (element.className) {
      const classes = element.className
        .split(' ')
        .filter((c) => c)
        .map((c) => `.${c}`)
        .join('');
      if (classes && document.querySelectorAll(classes).length === 1) {
        return classes;
      }
    }

    // Try nth-child
    let path = [];
    let current = element;

    while (current) {
      if (current === document.body) break;

      let tag = current.tagName.toLowerCase();
      let parent = current.parentElement;

      if (parent) {
        let siblings = parent.children;
        let index = Array.from(siblings).indexOf(current) + 1;
        if (siblings.length > 1) {
          tag += `:nth-child(${index})`;
        }
      }

      path.unshift(tag);
      current = parent;
    }

    return path.join(' > ');
  }

  function generateRelativeSelector(element, baseSelector) {
    // Find the closest parent matching the base selector
    const baseElement = element.closest(baseSelector);

    if (!baseElement) {
      return generateSelector(element); // Fallback to full selector if no base found
    }

    let path = [];
    let current = element;

    // Build path until we reach the base element
    while (current && current !== baseElement) {
      let selector = '';

      // Try ID
      if (current.id) {
        selector = `#${current.id}`;
      }
      // Try classes
      else if (current.className) {
        const classes = current.className
          .split(' ')
          .filter((c) => c)
          .map((c) => `.${c}`)
          .join('');
        if (classes) {
          selector = classes;
        }
      }
      // Fallback to tag with nth-child
      if (!selector || document.querySelectorAll(selector).length > 1) {
        const tag = current.tagName.toLowerCase();
        const parent = current.parentElement;
        const siblings = parent
          ? Array.from(parent.children).filter(
              (child) => child.tagName.toLowerCase() === tag
            )
          : [];

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector = `${tag}:nth-child(${index})`;
        } else {
          selector = tag;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === 'startPicking') {
        window.enableElementPicker(request.baseSelector);
        sendResponse({ status: 'started' });
      } else if (request.action === 'stopPicking') {
        window.disableElementPicker();
        sendResponse({ status: 'stopped' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ status: 'error', error: error.message });
    }
    return true;
  });
}
