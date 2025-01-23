/**
 * =============================
 * Cash Flow Tracker App
 * =============================
 * This Google Apps Script serves as the backend for the Cash Flow Tracker Web App.
 * It handles data operations such as adding transactions, generating dashboard data,
 * and preparing graph data. Each function is explained in detail below.
 * 
 * To adapt this app to another purpose (e.g., Sales Tracker, Personal Expenses),
 * you can easily change the app name, field names, and sheet names as indicated.
 */

/**
 * **Main Function**
 * 
 * The `doGet` function is the entry point of the web app. It serves the HTML page
 * when the web app URL is accessed. This function is crucial as it initializes the user interface.
 */
function doGet(e) {
  // Creates and returns the HTML output from the 'Index' file with a custom title.
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle("Cash Flow Web App"); // **Change the title here to reflect your app's name.**
}

/**
 * **addTransaction Function**
 * 
 * This function adds a new transaction to the specified sheet (Daily, Weekly, Monthly, or Yearly).
 * It then propagates the transaction to other relevant sheets, updating existing rows or adding new ones.
 * 
 * **Functionality:**
 * - Retrieves the active spreadsheet.
 * - Defines the types and corresponding sheet names.
 * - Parses the transaction data.
 * - Preloads all sheet data to minimize read operations.
 * - Prepares transaction details.
 * - Updates the target sheet and cascades the transaction to other sheets.
 * - Writes back the updated data to the sheets.
 * 
 * **Functions Called Within:**
 * - `createLookupMap()`
 * - `shouldCascade()`
 * - `getPeriodKeyAndDisplay()`
 * - `mergeStrings()`
 * - `makeRowData()`
 * 
 * **Customization:**
 * - **App Name:** Change the title in the `doGet` function.
 * - **Field Names:** Modify the fields like `date`, `transactionType`, `description`, etc., as needed.
 * - **Sheet Names:** Update the `sheetTypes` object to match your new sheet names.
 */
function addTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // **Customization Point:** Update sheet names here if you change the app's purpose.
  const sheetTypes = {
    'Daily': 'Daily Cashflow',
    'Weekly': 'Weekly Cashflow',
    'Monthly': 'Monthly Cashflow',
    'Yearly': 'Yearly Cashflow'
  };

  const dateObj = new Date(data.date);
  const planned = parseFloat(data.planned) || 0;
  const actual = parseFloat(data.actual) || 0;

  // Preload all sheet data to minimize read operations
  const sheetsData = {};
  Object.keys(sheetTypes).forEach(type => {
    const sheet = ss.getSheetByName(sheetTypes[type]);
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      sheetsData[type] = {
        sheet: sheet,
        data: values,
        lookup: createLookupMap(values)
      };
    }
  });

  // Prepare transaction details
  const transaction = {
    dateObj,
    tType: data.transactionType,
    desc: data.description,
    planned,
    actual,
    category: data.category
  };

  // Update target sheet and cascade to others
  Object.keys(sheetTypes).forEach(type => {
    const sheetType = type;
    const sheetInfo = sheetsData[sheetType];
    if (!sheetInfo) return;

    // Determine if this sheet should be updated
    if (sheetType === data.targetSheet || shouldCascade(data.targetSheet, sheetType)) {
      const periodKeyAndDisplay = getPeriodKeyAndDisplay(dateObj, sheetType);
      const periodKey = periodKeyAndDisplay[0];
      const periodLabel = periodKeyAndDisplay[1];
      const lookupKey = `${periodLabel}|${data.transactionType}`;

      if (sheetInfo.lookup.has(lookupKey)) {
        // Row exists, accumulate values
        const rowIndex = sheetInfo.lookup.get(lookupKey) + 1; // Adjust for 1-based indexing
        const row = sheetInfo.data[rowIndex - 1]; // 0-based array

        // Update in-memory data
        row[2] = mergeStrings(row[2], data.description);
        row[3] = parseFloat(row[3]) + planned;
        row[4] = parseFloat(row[4]) + actual;
        row[5] = mergeStrings(row[5], data.category);

        // No need to update lookup map as the row already exists
      } else {
        // New row, append to in-memory data
        const newRow = makeRowData(sheetType, transaction);
        sheetInfo.data.push(newRow);
        sheetInfo.lookup.set(lookupKey, sheetInfo.data.length - 1);
      }
    }
  });

  // After processing all sheets, write back the changes
  Object.keys(sheetTypes).forEach(type => {
    const sheetType = type;
    const sheetInfo = sheetsData[sheetType];
    if (!sheetInfo) return;

    // Convert in-memory data back to sheet
    const numRows = sheetInfo.data.length;
    const numCols = sheetInfo.data[0].length;

    if (numRows > 1) { // Ensure there's at least one row besides header
      sheetInfo.sheet.getRange(2, 1, numRows - 1, numCols).setValues(sheetInfo.data.slice(1)); // Exclude header
    }
  });

  return true;
}

/**
 * **shouldCascade Function**
 * 
 * Determines whether a transaction should be cascaded from the target sheet to the current sheet.
 * For example, adding a daily transaction might also update weekly, monthly, and yearly sheets.
 * 
 * **Functionality:**
 * - Checks if the current sheet is different from the target sheet.
 * - Returns `true` if they are different, indicating that the transaction should cascade.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - Modify the cascading logic based on specific requirements of your new app.
 */
function shouldCascade(targetSheet, currentSheet) {
  // **Customization Point:** Adjust cascading rules as needed.
  // Currently, it returns true as long as the sheets are not the same.
  return targetSheet !== currentSheet;
}

/**
 * **createLookupMap Function**
 * 
 * Creates a lookup map to quickly find the row index for a given period and transaction type.
 * This optimization reduces the number of read operations on the sheet.
 * 
 * **Functionality:**
 * - Iterates through each row of the sheet data.
 * - Creates a key in the format "periodLabel|transactionType".
 * - Maps this key to the row index for quick retrieval.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - **Field Names:** Ensure the columns used (e.g., period, transaction type) match your app's data structure.
 */
function createLookupMap(values) {
  const map = new Map();
  for (let i = 1; i < values.length; i++) { // Skip header
    const row = values[i];
    const key = `${row[0]}|${row[1]}`; // Assumes column A is period and column B is transaction type
    map.set(key, i);
  }
  return map;
}

/**
 * **getPeriodKeyAndDisplay Function**
 * 
 * Based on the sheet type (Daily, Weekly, Monthly, Yearly), this function generates a period key
 * and a display label that are used to organize transactions within the sheet.
 * 
 * **Functionality:**
 * - Extracts the year and month from the transaction date.
 * - Formats the period key and label based on the sheet type.
 * 
 * **Functionality Called:**
 * - `getWeekNumber()`
 * 
 * **Customization:**
 * - **Period Formats:** Modify the date formats if needed to suit different tracking requirements.
 */
function getPeriodKeyAndDisplay(dateObj, sheetType) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;

  switch (sheetType) {
    case 'Daily': {
      // Format as "2025-01-22"
      const dailyKey = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return [dailyKey, dailyKey];
    }
    case 'Weekly': {
      // Format as "W3-2025" for week 3 in 2025
      const weekNum = getWeekNumber(dateObj);
      const weeklyKey = "W" + weekNum + "-" + year;
      return [weeklyKey, weeklyKey];
    }
    case 'Monthly': {
      // Format as "M2-2025"
      const monthlyKey = "M" + month + "-" + year;
      return [monthlyKey, monthlyKey];
    }
    case 'Yearly': {
      // Format as "Y2025"
      const yearlyKey = "Y" + year;
      return [yearlyKey, yearlyKey];
    }
  }
  throw new Error("Invalid sheetType: " + sheetType);
}

/**
 * **makeRowData Function**
 * 
 * Constructs a new row array based on the sheet type and transaction details.
 * This array is then added to the sheet to represent the new transaction.
 * 
 * **Functionality:**
 * - Retrieves the period key and label.
 * - Creates an array representing the new row with appropriate columns.
 * 
 * **Functionality Called:**
 * - `getPeriodKeyAndDisplay()`
 * 
 * **Customization:**
 * - **Field Order:** Adjust the order of fields in the returned array to match your sheet's column structure.
 */
function makeRowData(sheetType, transaction) {
  const [periodKey, periodLabel] = getPeriodKeyAndDisplay(transaction.dateObj, sheetType);
  return [
    periodLabel,                  // Column A: Period
    transaction.tType,            // Column B: Transaction Type
    transaction.desc,             // Column C: Description
    transaction.planned,          // Column D: Planned
    transaction.actual,           // Column E: Actual
    transaction.category          // Column F: Category
  ];
}

/**
 * **mergeStrings Function**
 * 
 * Combines two strings by joining them with a newline if both are present.
 * This is useful for appending descriptions or categories without overwriting existing data.
 * 
 * **Functionality:**
 * - Trims both input strings.
 * - Joins them with a newline if both are non-empty.
 * - Returns the combined string.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - **Delimiter:** Change the delimiter (currently a newline) to another character if desired.
 */
function mergeStrings(oldVal, newVal) {
  const t1 = (oldVal || "").trim();
  const t2 = (newVal || "").trim();
  if (t1 && t2) {
    return t1 + "\n" + t2;
  } else {
    return t1 || t2;
  }
}

/**
 * **getWeekNumber Function**
 * 
 * Calculates the ISO week number for a given date. ISO weeks start on Monday and the first week
 * of the year is the one that contains the first Thursday of the year.
 * 
 * **Functionality:**
 * - Adjusts the date to the nearest Thursday.
 * - Calculates the week number based on the adjusted date.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - **Week Start Day:** Modify if your week starts on a different day.
 */
function getWeekNumber(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

/**
 * **getDashboardData Function**
 * 
 * Aggregates transaction data within a specified date range to generate summary information
 * for the dashboard. This includes totals for planned and actual incomes and expenses.
 * 
 * **Functionality:**
 * - Retrieves data from the "Daily Cashflow" sheet.
 * - Filters transactions based on the provided date range.
 * - Sums up planned and actual incomes and expenses.
 * - Calculates net cash flow.
 * - Generates HTML content to display the summary.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - **Sheet Name:** If you change the sheet name, update it here.
 * - **HTML Structure:** Modify the HTML string to change how the dashboard displays data.
 */
function getDashboardData(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Daily Cashflow"); // **Change sheet name if needed**
  
  if (!sheet) {
    throw new Error("Daily Cashflow sheet not found.");
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return "<p>No data available.</p>"; // Skip if only header or empty
  }

  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  let totalPlannedIncome = 0;
  let totalPlannedExpense = 0;
  let totalActualIncome = 0;
  let totalActualExpense = 0;

  // Process data, skipping the header row
  data.slice(1).forEach(row => {
    const rowDate = new Date(row[0]); // Assume the first column is the date
    if (rowDate >= start && rowDate <= end) {
      const type = row[1]; // Income or Expense
      const planned = parseFloat(row[3]) || 0; // Planned column
      const actual = parseFloat(row[4]) || 0; // Actual column

      if (type === "Income") {
        totalPlannedIncome += planned;
        totalActualIncome += actual;
      } else if (type === "Expense") {
        totalPlannedExpense += planned;
        totalActualExpense += actual;
      }
    }
  });

  const netPlanned = totalPlannedIncome - totalPlannedExpense;
  const netActual = totalActualIncome - totalActualExpense;

  // Generate the HTML for the dashboard
  const html = `
    <div class="row">
      <div class="col s12 m6">
        <div class="card blue lighten-4">
          <div class="card-content">
            <span class="card-title">Planned Income</span>
            <h5>RM${totalPlannedIncome.toFixed(2)}</h5>
          </div>
        </div>
      </div>
      <div class="col s12 m6">
        <div class="card blue lighten-4">
          <div class="card-content">
            <span class="card-title">Actual Income</span>
            <h5>RM${totalActualIncome.toFixed(2)}</h5>
          </div>
        </div>
      </div>
      <div class="col s12 m6">
        <div class="card red lighten-4">
          <div class="card-content">
            <span class="card-title">Planned Expense</span>
            <h5>RM${totalPlannedExpense.toFixed(2)}</h5>
          </div>
        </div>
      </div>
      <div class="col s12 m6">
        <div class="card red lighten-4">
          <div class="card-content">
            <span class="card-title">Actual Expense</span>
            <h5>RM${totalActualExpense.toFixed(2)}</h5>
          </div>
        </div>
      </div>
      <div class="col s12 m6">
        <div class="card teal lighten-4">
          <div class="card-content">
            <span class="card-title">Net Planned Cash Flow</span>
            <h5>RM${netPlanned.toFixed(2)}</h5>
          </div>
        </div>
      </div>
      <div class="col s12 m6">
        <div class="card teal lighten-4">
          <div class="card-content">
            <span class="card-title">Net Actual Cash Flow</span>
            <h5>RM${netActual.toFixed(2)}</h5>
          </div>
        </div>
      </div>
    </div>
  `;

  return html;
}

/**
 * **getGraphData Function**
 * 
 * Prepares data for generating graphs based on the selected time granularity (Daily, Weekly, Monthly, Yearly).
 * This data is used to visualize cash flow movements over time.
 * 
 * **Functionality:**
 * - Retrieves data from the appropriate sheet based on granularity.
 * - Aggregates planned and actual incomes and expenses per period.
 * - Sorts the periods chronologically.
 * 
 * **Functionality Called:**
 * - `getDateFromWeekPeriod()`
 * 
 * **Customization:**
 * - **Sheet Names:** Ensure the `sheetTypes` object matches your new sheet names if you change the app's purpose.
 */
function getGraphData(granularity) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // **Customization Point:** Update sheet names here if you change the app's purpose.
  const sheetTypes = {
    'Daily': 'Daily Cashflow',
    'Weekly': 'Weekly Cashflow',
    'Monthly': 'Monthly Cashflow',
    'Yearly': 'Yearly Cashflow'
  };

  const sheetName = sheetTypes[granularity];
  if (!sheetName) {
    throw new Error("Invalid granularity: " + granularity);
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return []; // No data available
  }

  // Map to store aggregated data per period
  const periodDataMap = new Map();

  data.slice(1).forEach(row => { // Skip header
    const period = row[0];
    const type = row[1];
    const planned = parseFloat(row[3]) || 0;
    const actual = parseFloat(row[4]) || 0;

    if (!periodDataMap.has(period)) {
      periodDataMap.set(period, {
        period: period,
        plannedIncome: 0,
        actualIncome: 0,
        plannedExpense: 0,
        actualExpense: 0
      });
    }

    const entry = periodDataMap.get(period);
    if (type === "Income") {
      entry.plannedIncome += planned;
      entry.actualIncome += actual;
    } else if (type === "Expense") {
      entry.plannedExpense += planned;
      entry.actualExpense += actual;
    }
  });

  // Sort periods chronologically
  const sortedPeriods = Array.from(periodDataMap.values()).sort((a, b) => {
    // Convert period to Date for sorting
    let dateA, dateB;
    switch (granularity) {
      case 'Daily':
        dateA = new Date(a.period);
        dateB = new Date(b.period);
        break;
      case 'Weekly':
        dateA = getDateFromWeekPeriod(a.period);
        dateB = getDateFromWeekPeriod(b.period);
        break;
      case 'Monthly':
        dateA = new Date(a.period.replace('M', '') + '-01');
        dateB = new Date(b.period.replace('M', '') + '-01');
        break;
      case 'Yearly':
        dateA = new Date(a.period.replace('Y', '') + '-01-01');
        dateB = new Date(b.period.replace('Y', '') + '-01-01');
        break;
      default:
        dateA = new Date();
        dateB = new Date();
    }
    return dateA - dateB;
  });

  return sortedPeriods;
}

/**
 * **getDateFromWeekPeriod Function**
 * 
 * Converts a week period string (e.g., "W3-2025") into a Date object representing the first day of that week.
 * This is useful for sorting weekly data chronologically.
 * 
 * **Functionality:**
 * - Splits the week period string to extract week number and year.
 * - Calculates the date corresponding to the first day of that week.
 * 
 * **Functionality Called:**
 * - None
 * 
 * **Customization:**
 * - **Week Format:** Adjust the parsing logic if your week format differs.
 */
function getDateFromWeekPeriod(weekPeriod) {
  const parts = weekPeriod.split('-');
  const weekNum = parseInt(parts[0].replace('W', ''));
  const year = parseInt(parts[1]);

  const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

/**
 * **getDateRange Function**
 * 
 * Retrieves the earliest and latest dates from the "Daily Cashflow" sheet. This is used to set
 * the minimum and maximum dates in the date range selectors on the dashboard.
 * 
 * **Functionality:**
 * - Fetches all dates from the sheet.
 * - Determines the minimum and maximum dates.
 * - Formats these dates as 'yyyy-MM-dd'.
 * 
 * **Functionality Called:**
 * - `Utilities.formatDate()`
 * 
 * **Customization:**
 * - **Sheet Name:** Update if you change the sheet name.
 */
function getDateRange() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Daily Cashflow"); // **Change sheet name if needed**
  
  if (!sheet) {
    throw new Error("Daily Cashflow sheet not found.");
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { minDate: '', maxDate: '' }; // No data available
  }

  const dates = data.slice(1).map(row => new Date(row[0])).filter(date => !isNaN(date));
  
  if (dates.length === 0) {
    return { minDate: '', maxDate: '' };
  }
  
  const minDate = new Date(Math.min.apply(null, dates));
  const maxDate = new Date(Math.max.apply(null, dates));
  
  const formattedMinDate = Utilities.formatDate(minDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const formattedMaxDate = Utilities.formatDate(maxDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  return { minDate: formattedMinDate, maxDate: formattedMaxDate };
}
