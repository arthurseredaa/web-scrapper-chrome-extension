document.addEventListener('DOMContentLoaded', function () {
  // Initialize i18n strings first, before any other operations
  function initializeI18nStrings() {
    // Update page title and main heading
    document.title = chrome.i18n.getMessage('extName');

    // Replace all HTML elements that contain i18n keys
    document.body.innerHTML = document.body.innerHTML.replace(
      /__MSG_(\w+)__/g,
      (match, key) => chrome.i18n.getMessage(key)
    );
  }

  // Call initializeI18n immediately
  initializeI18nStrings();

  // DOM Elements
  const parseButton = document.getElementById('parseButton');
  const statusElement = document.getElementById('status');
  const statsElement = document.getElementById('stats');
  const resultsTable = document.getElementById('results-table');
  const tableHeaders = document.getElementById('table-headers');
  const selectorGroup = document.querySelector('.selector-group');
  const fieldSelectors = document.querySelector('.field-selectors');
  const downloadCsvBtn = document.getElementById('downloadCsv');
  const downloadJsonBtn = document.getElementById('downloadJson');
  const downloadExcelBtn = document.getElementById('downloadExcel');

  let currentData = null;
  let currentFields = null;
  let activePickerInput = null;
  let lastPickedSelector = null;

  // Utility Functions
  function showMessage(messageKey, isError = false) {
    let message;
    if (messageKey.startsWith('Error: ')) {
      // Handle custom error messages
      message = messageKey;
    } else {
      // Handle i18n message keys
      message = chrome.i18n.getMessage(messageKey) || messageKey;
    }
    statusElement.textContent = message;
    statusElement.className = 'status ' + (isError ? 'error' : 'success');
  }

  function showStats(count) {
    statsElement.textContent = chrome.i18n.getMessage('statsFound', [count]);
  }

  async function injectScripts(tabId) {
    try {
      // Check if scripts are already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.isPickingElementInitialized,
      });

      if (!results[0].result) {
        // Inject picker.js first
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['picker.js'],
        });

        // Then inject content.js
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });
      }
    } catch (error) {
      showMessage('Error injecting scripts', true);
      console.error('Script injection failed:', error);
      throw error;
    }
  }

  // Field Management Functions
  function addFieldRow() {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';

    // Create field name input
    const fieldNameInput = document.createElement('input');
    fieldNameInput.type = 'text';
    fieldNameInput.className = 'field-name';
    fieldNameInput.placeholder = chrome.i18n.getMessage('fieldNamePlaceholder');

    // Create field selector input
    const fieldSelectorInput = document.createElement('input');
    fieldSelectorInput.type = 'text';
    fieldSelectorInput.className = 'field-selector';
    fieldSelectorInput.placeholder = chrome.i18n.getMessage(
      'selectorPlaceholder'
    );

    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-field';
    removeButton.textContent = chrome.i18n.getMessage('removeField');

    // Add elements to field row
    fieldRow.appendChild(fieldNameInput);
    fieldRow.appendChild(fieldSelectorInput);
    fieldRow.appendChild(removeButton);

    fieldSelectors.appendChild(fieldRow);

    // Add remove functionality
    removeButton.addEventListener('click', () => {
      fieldRow.remove();
      saveState();
    });

    // Add change listeners to inputs
    fieldNameInput.addEventListener('change', saveState);
    fieldSelectorInput.addEventListener('change', saveState);

    return fieldRow;
  }

  function getSelectors() {
    const baseSelector = selectorGroup
      .querySelector('.selector-input')
      .value.trim();
    const fields = Array.from(selectorGroup.querySelectorAll('.field-row'))
      .map((row) => ({
        name: row.querySelector('.field-name').value.trim(),
        selector: row.querySelector('.field-selector').value.trim(),
      }))
      .filter((field) => field.name && field.selector);

    return { baseSelector, fields };
  }

  // Display Functions
  function updateTableHeaders(fields) {
    tableHeaders.innerHTML = '';
    fields.forEach((field) => {
      const th = document.createElement('th');
      th.textContent = field.name;
      tableHeaders.appendChild(th);
    });
  }

  function displayResults(results, fields) {
    const tbody = resultsTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    updateTableHeaders(fields);

    results.forEach((item) => {
      const row = tbody.insertRow();
      fields.forEach((field) => {
        const cell = row.insertCell();
        const div = document.createElement('div');
        div.className = 'cell-content';
        div.textContent = item[field.name] || '';
        cell.appendChild(div);
      });
    });

    // Store current data and enable download buttons
    currentData = results;
    currentFields = fields;
    enableDownloadButtons(true);
  }

  // Download Functions
  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function generateCsv(data, fields) {
    const headers = fields.map((f) => f.name).join(',');
    const rows = data.map((item) =>
      fields
        .map((f) => {
          const value = item[f.name] || '';
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    return `${headers}\n${rows.join('\n')}`;
  }

  function generateJson(data) {
    return JSON.stringify(data, null, 2);
  }

  function generateExcel(data, fields) {
    const headers = fields.map((f) => f.name);
    const rows = data.map((item) => fields.map((f) => item[f.name] || ''));

    // Create Excel-compatible CSV
    const excelRows = [headers, ...rows];
    const csv = excelRows
      .map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    // Add BOM for Excel UTF-8 compatibility
    return '\ufeff' + csv;
  }

  function enableDownloadButtons(enabled = true) {
    downloadCsvBtn.disabled = !enabled;
    downloadJsonBtn.disabled = !enabled;
    downloadExcelBtn.disabled = !enabled;
  }

  // Download Event Listeners
  downloadCsvBtn.addEventListener('click', () => {
    if (currentData && currentFields) {
      const csv = generateCsv(currentData, currentFields);
      downloadFile(csv, 'scraped-data.csv');
    }
  });

  downloadJsonBtn.addEventListener('click', () => {
    if (currentData) {
      const json = generateJson(currentData);
      downloadFile(json, 'scraped-data.json');
    }
  });

  downloadExcelBtn.addEventListener('click', () => {
    if (currentData && currentFields) {
      const excel = generateExcel(currentData, currentFields);
      downloadFile(excel, 'scraped-data.xlsx');
    }
  });

  // Event Listeners
  document.querySelector('.add-field').addEventListener('click', () => {
    addFieldRow();
    saveState();
  });

  parseButton.addEventListener('click', async () => {
    const { baseSelector, fields } = getSelectors();

    statusElement.textContent = '';
    statsElement.textContent = '';
    resultsTable.getElementsByTagName('tbody')[0].innerHTML = '';
    enableDownloadButtons(false);
    currentData = null;
    currentFields = null;

    if (!baseSelector || fields.length === 0) {
      showMessage('errorMissingSelectors', true);
      return;
    }

    showMessage('statusParsing', false);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Use new injection function
      await injectScripts(tab.id);

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: 'parseData',
          baseSelector,
          fields,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            showMessage('errorAccessPage', true);
            return;
          }

          if (response.error) {
            showMessage('errorNoElements', true);
          } else {
            showMessage('statusSuccess', false);
            showStats(response.count);
            displayResults(response.data, fields);
          }
        }
      );
    } catch (error) {
      showMessage('errorAccessPage', true);
      console.error('Parse error:', error);
    }
  });

  // Add function to save state
  async function saveState() {
    const state = {
      baseSelector: document.querySelector('.selector-input').value,
      fields: Array.from(document.querySelectorAll('.field-row')).map(
        (row) => ({
          name: row.querySelector('.field-name').value,
          selector: row.querySelector('.field-selector').value,
        })
      ),
    };
    await chrome.storage.local.set({ scraperState: state });
  }

  // Add function to restore state
  async function restoreState() {
    const { scraperState } = await chrome.storage.local.get('scraperState');
    if (scraperState) {
      // Restore base selector
      const baseSelectorInput = document.querySelector('.selector-input');
      if (baseSelectorInput) {
        baseSelectorInput.value = scraperState.baseSelector || '';
      }

      // Clear existing fields
      fieldSelectors.innerHTML = '';

      // Restore fields
      if (scraperState.fields && scraperState.fields.length > 0) {
        scraperState.fields.forEach((field) => {
          const fieldRow = addFieldRow();
          const nameInput = fieldRow.querySelector('.field-name');
          const selectorInput = fieldRow.querySelector('.field-selector');

          if (nameInput) nameInput.value = field.name;
          if (selectorInput) selectorInput.value = field.selector;
        });
      } else {
        addFieldRow();
      }
    } else {
      addFieldRow();
    }

    // Initialize all picker buttons after restoring state
    initializePickerButtons();
  }

  // Modify startElementPicker to ensure scripts are injected
  async function startElementPicker(inputElement) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Get base selector if we're picking a field selector
      const isFieldSelector = inputElement.classList.contains('field-selector');
      const baseSelectorInput = document.querySelector('.selector-input');
      const baseSelector = isFieldSelector
        ? baseSelectorInput.value.trim()
        : null;

      // Validate base selector if picking a field
      if (isFieldSelector && !baseSelector) {
        showMessage('errorBaseSelector', true);
        return;
      }

      // Inject scripts before starting picker
      await injectScripts(tab.id);

      // Store which input is waiting for the selector
      activePickerInput = inputElement;

      // Store input identifier for later
      await chrome.storage.local.set({
        activePickerData: {
          isBaseSelector: inputElement === baseSelectorInput,
          fieldIndex: Array.from(
            document.querySelectorAll('.field-selector')
          ).indexOf(inputElement),
        },
      });

      // Minimize the popup
      document.body.style.display = 'none';

      // Start the picker in content script with base selector if available
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startPicking',
        baseSelector: baseSelector,
      });
    } catch (error) {
      showMessage('errorAccessPage', true);
      console.error('Picker error:', error);
      document.body.style.display = 'block';
    }
  }

  // Modify the element selected listener
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      if (request.action === 'elementSelected') {
        const { activePickerData } = await chrome.storage.local.get(
          'activePickerData'
        );

        if (activePickerData) {
          if (activePickerData.isBaseSelector) {
            document.querySelector('.selector-input').value = request.selector;
          } else if (activePickerData.fieldIndex >= 0) {
            const selectorInputs = document.querySelectorAll('.field-selector');
            if (selectorInputs[activePickerData.fieldIndex]) {
              selectorInputs[activePickerData.fieldIndex].value =
                request.selector;
            }
          }

          // Clear stored picker data
          chrome.storage.local.remove('activePickerData');

          // Save the new state
          saveState();
        }

        // Restore popup
        document.body.style.display = 'block';
      }
    }
  );

  // Add change listener to base selector
  document
    .querySelector('.selector-input')
    .addEventListener('change', saveState);

  // Initialize
  restoreState();
  enableDownloadButtons(false);

  // Add event listener for the add field button
  const addFieldButton = document.querySelector('.add-field');
  if (addFieldButton) {
    addFieldButton.addEventListener('click', () => {
      const newRow = addFieldRow();
      initializePickerButtons(); // Reinitialize all picker buttons
      saveState();
    });
  }

  // Add this function to initialize all picker buttons
  function initializePickerButtons() {
    // Initialize base selector picker button
    const baseSelectorButton = document.querySelector(
      '.selector-group .selection-mode'
    );
    const baseSelectorInput = document.querySelector('.selector-input');

    if (baseSelectorButton) {
      baseSelectorButton.addEventListener('click', () => {
        startElementPicker(baseSelectorInput);
      });
    }

    // Initialize field selector picker buttons
    const fieldRows = document.querySelectorAll('.field-selectors .field-row');
    fieldRows.forEach((row) => {
      const pickerButton = row.querySelector('.selection-mode');
      const selectorInput = row.querySelector('.field-selector');

      if (pickerButton && selectorInput) {
        pickerButton.addEventListener('click', () => {
          startElementPicker(selectorInput);
        });
      }
    });
  }
});
