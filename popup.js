document.addEventListener('DOMContentLoaded', function () {
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

  // Utility Functions
  function showMessage(message, isError = false) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + (isError ? 'error' : 'success');
  }

  function showStats(stats) {
    statsElement.textContent = stats;
  }

  async function injectContentScriptIfNeeded(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch (error) {
      showMessage('Error injecting content script', true);
      console.log(
        'Content script already injected or injection failed:',
        error
      );
    }
  }

  // Field Management Functions
  function addFieldRow() {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.innerHTML = `
      <input type="text" placeholder="Field name" class="field-name" />
      <input type="text" placeholder="Relative selector" class="field-selector" />
      <button class="remove-field">Remove</button>
    `;
    fieldSelectors.appendChild(fieldRow);

    fieldRow.querySelector('.remove-field').addEventListener('click', () => {
      fieldRow.remove();
    });
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
  document.querySelector('.add-field').addEventListener('click', addFieldRow);

  parseButton.addEventListener('click', async () => {
    const { baseSelector, fields } = getSelectors();

    statusElement.textContent = '';
    statsElement.textContent = '';
    resultsTable.getElementsByTagName('tbody')[0].innerHTML = '';
    enableDownloadButtons(false);
    currentData = null;
    currentFields = null;

    if (!baseSelector || fields.length === 0) {
      showMessage('Please enter base selector and at least one field', true);
      return;
    }

    showMessage('Parsing...', false);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      await injectContentScriptIfNeeded(tab.id);

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: 'parseData',
          baseSelector,
          fields,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            showMessage(
              'Error: Cannot access page. Please refresh the page and try again.',
              true
            );
            return;
          }

          if (response.error) {
            showMessage(`Error: ${response.error}`, true);
          } else {
            showMessage('Successfully parsed data!');
            showStats(`Found ${response.count} items`);
            displayResults(response.data, fields);
          }
        }
      );
    } catch (error) {
      showMessage(`Error: ${error.message}`, true);
    }
  });

  // Initialize
  addFieldRow();
  enableDownloadButtons(false);
});
