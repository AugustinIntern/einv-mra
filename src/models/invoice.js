/**
 * Invoice Models & Validation
 *
 * Full validation based on:
 * "Data Structure of an e-Invoice to comply with the MRA e-Invoicing System v1.3.3"
 *
 * Covers:
 *  - Required / Conditional / Optional fields
 *  - Data types (String)
 *  - Max field sizes
 *  - Allowed enum values
 *  - Conditional rules (e.g. CRN/DRN requires invoiceRefIdentifier)
 *  - Numeric format checks (rounded to 2 decimal places)
 *  - B2B/B2G buyer field requirements
 */

const { formatDateTime } = require("../services/mraService");

// ── Allowed Values (Enums)

const ALLOWED_PERSON_TYPES       = ["VATR", "NVTR"];
const ALLOWED_TRANSACTION_TYPES  = ["B2B", "B2G", "B2C", "EXP", "B2E"];
const ALLOWED_INVOICE_TYPES      = ["STD", "PRF", "TRN", "CRN", "DRN"];
const ALLOWED_TAX_CODES          = ["TC01", "TC02", "TC03", "TC04", "TC05", "TC06"];
const ALLOWED_NATURES            = ["GOODS", "SERVICES"];
const ALLOWED_BUYER_TYPES        = ["VATR", "NVTR", "EXMP"];
const ALLOWED_SALES_TRANSACTIONS = ["CASH", "BNKTRANSFER", "CHEQUE", "CARD", "OTHER", "CREDIT"];
const CREDIT_DEBIT_TYPES         = ["CRN", "DRN"];
const B2B_B2G_TYPES              = ["B2B", "B2G"];

// ── Helpers

/**
 * Checks a value is a string and within the max allowed size.
 */
function isValidString(value, maxSize) {
  if (typeof value !== "string") return false;
  if (maxSize && value.length > maxSize) return false;
  return true;
}

/**
 * Checks a value is a numeric string rounded to max 2 decimal places.
 * Allows empty string for optional numeric fields.
 */
function isValidNumeric(value, allowEmpty = false) {
  if (allowEmpty && (value === "" || value === null || value === undefined)) return true;
  if (typeof value !== "string") return false;
  // Must be a number with at most 2 decimal places
  return /^\d+(\.\d{1,2})?$/.test(value);
}

/**
 * Checks date format yyyyMMdd HH:mm:ss
 */
function isValidDateTime(value) {
  return /^\d{8} \d{2}:\d{2}:\d{2}$/.test(value);
}

/**
 * Pushes an error if condition is true.
 */
function check(errors, condition, message) {
  if (condition) errors.push(message);
}

// ── Item Validation

function validateItem(item, prefix, personType) {
  const errors = [];

  // itemNo — Mandatory, String(10)
  check(errors, !item.itemNo, `${prefix}: itemNo is mandatory`);
  check(errors, item.itemNo && !isValidString(item.itemNo, 10),
    `${prefix}: itemNo must be a string max 10 chars`);

  // taxCode — Mandatory, enum
  check(errors, !item.taxCode, `${prefix}: taxCode is mandatory`);
  check(errors, item.taxCode && !ALLOWED_TAX_CODES.includes(item.taxCode),
    `${prefix}: taxCode must be one of ${ALLOWED_TAX_CODES.join(", ")}`);

  // nature — Mandatory, enum
  check(errors, !item.nature, `${prefix}: nature is mandatory`);
  check(errors, item.nature && !ALLOWED_NATURES.includes(item.nature),
    `${prefix}: nature must be one of ${ALLOWED_NATURES.join(", ")}`);

  // itemDesc — Mandatory, String(100)
  check(errors, !item.itemDesc, `${prefix}: itemDesc is mandatory`);
  check(errors, item.itemDesc && !isValidString(item.itemDesc, 100),
    `${prefix}: itemDesc must be a string max 100 chars`);

  // productCodeMra — Optional, String(8)
  check(errors, item.productCodeMra && !isValidString(item.productCodeMra, 8),
    `${prefix}: productCodeMra must be a string max 8 chars`);

  // productCodeOwn — Optional, String(100)
  check(errors, item.productCodeOwn && !isValidString(item.productCodeOwn, 100),
    `${prefix}: productCodeOwn must be a string max 100 chars`);

  // unitPrice — Conditional: mandatory if nature = GOODS, String(20), numeric
  if (item.nature === "GOODS") {
    check(errors, !item.unitPrice, `${prefix}: unitPrice is mandatory when nature is GOODS`);
  }
  check(errors, item.unitPrice && !isValidString(item.unitPrice, 20),
    `${prefix}: unitPrice must be a string max 20 chars`);
  check(errors, item.unitPrice && !isValidNumeric(item.unitPrice),
    `${prefix}: unitPrice must be a numeric string`);

  // quantity — Conditional: mandatory if nature = GOODS, String(20), numeric
  if (item.nature === "GOODS") {
    check(errors, !item.quantity, `${prefix}: quantity is mandatory when nature is GOODS`);
  }
  check(errors, item.quantity && !isValidString(item.quantity, 20),
    `${prefix}: quantity must be a string max 20 chars`);
  check(errors, item.quantity && !isValidNumeric(item.quantity),
    `${prefix}: quantity must be a numeric string`);

  // discount — Conditional, String(20), numeric
  check(errors, item.discount && !isValidString(item.discount, 20),
    `${prefix}: discount must be a string max 20 chars`);
  check(errors, item.discount && !isValidNumeric(item.discount, true),
    `${prefix}: discount must be a numeric string`);

  // discountedValue — Conditional, String(20), numeric
  check(errors, item.discountedValue && !isValidString(item.discountedValue, 20),
    `${prefix}: discountedValue must be a string max 20 chars`);
  check(errors, item.discountedValue && !isValidNumeric(item.discountedValue, true),
    `${prefix}: discountedValue must be a numeric string`);

  // amtWoVatCur — Mandatory, String(20), numeric
  check(errors, !item.amtWoVatCur, `${prefix}: amtWoVatCur is mandatory`);
  check(errors, item.amtWoVatCur && !isValidString(item.amtWoVatCur, 20),
    `${prefix}: amtWoVatCur must be a string max 20 chars`);
  check(errors, item.amtWoVatCur && !isValidNumeric(item.amtWoVatCur),
    `${prefix}: amtWoVatCur must be a numeric string rounded to 2 decimal places`);

  // amtWoVatMur — Conditional (foreign currency invoices), String(20), numeric
  check(errors, item.amtWoVatMur && !isValidString(item.amtWoVatMur, 20),
    `${prefix}: amtWoVatMur must be a string max 20 chars`);
  check(errors, item.amtWoVatMur && !isValidNumeric(item.amtWoVatMur, true),
    `${prefix}: amtWoVatMur must be a numeric string`);

  // vatAmt — Mandatory if personType = VATR, String(20), numeric
  if (personType === "VATR") {
    check(errors, !item.vatAmt, `${prefix}: vatAmt is mandatory when personType is VATR`);
  }
  check(errors, item.vatAmt && !isValidString(item.vatAmt, 20),
    `${prefix}: vatAmt must be a string max 20 chars`);
  check(errors, item.vatAmt && !isValidNumeric(item.vatAmt),
    `${prefix}: vatAmt must be a numeric string rounded to 2 decimal places`);

  // totalPrice — Mandatory, String(20), numeric
  check(errors, !item.totalPrice, `${prefix}: totalPrice is mandatory`);
  check(errors, item.totalPrice && !isValidString(item.totalPrice, 20),
    `${prefix}: totalPrice must be a string max 20 chars`);
  check(errors, item.totalPrice && !isValidNumeric(item.totalPrice),
    `${prefix}: totalPrice must be a numeric string rounded to 2 decimal places`);

  return errors;
}

// ── Seller Validation

function validateSeller(seller, prefix) {
  const errors = [];
  if (!seller) {
    errors.push(`${prefix}: seller object is required`);
    return errors;
  }

  // name — Mandatory, String(100)
  check(errors, !seller.name, `${prefix}.seller: name is mandatory`);
  check(errors, seller.name && !isValidString(seller.name, 100),
    `${prefix}.seller: name must be a string max 100 chars`);

  // tradeName — Optional, String(100)
  check(errors, seller.tradeName && !isValidString(seller.tradeName, 100),
    `${prefix}.seller: tradeName must be a string max 100 chars`);

  // tan — Mandatory, String(8)
  check(errors, !seller.tan, `${prefix}.seller: tan (VAT number) is mandatory`);
  check(errors, seller.tan && !isValidString(seller.tan, 8),
    `${prefix}.seller: tan must be a string max 8 chars`);

  // brn — Mandatory, String(10)
  check(errors, !seller.brn, `${prefix}.seller: brn is mandatory`);
  check(errors, seller.brn && !isValidString(seller.brn, 7),
    `${prefix}.seller: brn must be a string max 10 chars`);

  // businessAddr — Mandatory, String(250)
  check(errors, !seller.businessAddr, `${prefix}.seller: businessAddr is mandatory`);
  check(errors, seller.businessAddr && !isValidString(seller.businessAddr, 250),
    `${prefix}.seller: businessAddr must be a string max 250 chars`);

  // businessPhoneNo — Optional, String(20), digits and + only
  check(errors, seller.businessPhoneNo && !isValidString(seller.businessPhoneNo, 20),
    `${prefix}.seller: businessPhoneNo must be a string max 20 chars`);
  check(errors,
    seller.businessPhoneNo && !/^[0-9+]+$/.test(seller.businessPhoneNo),
    `${prefix}.seller: businessPhoneNo must contain only digits and +`);

  // ebsCounterNo — Optional, String(20)
  check(errors, seller.ebsCounterNo && !isValidString(seller.ebsCounterNo, 20),
    `${prefix}.seller: ebsCounterNo must be a string max 20 chars`);

  // cashierID — Optional, String(100)
  check(errors, seller.cashierID && !isValidString(seller.cashierID, 100),
    `${prefix}.seller: cashierID must be a string max 100 chars`);

  return errors;
}

// ── Buyer Validation

function validateBuyer(buyer, prefix, transactionType) {
  const errors = [];
  const isB2BorB2G = B2B_B2G_TYPES.includes(transactionType);

  if (!buyer) {
    if (isB2BorB2G) {
      errors.push(`${prefix}: buyer object is required for ${transactionType} transactions`);
    }
    return errors;
  }

  // name — Mandatory for B2B/B2G, String(100)
  if (isB2BorB2G) {
    check(errors, !buyer.name, `${prefix}.buyer: name is mandatory for ${transactionType}`);
  }
  check(errors, buyer.name && !isValidString(buyer.name, 100),
    `${prefix}.buyer: name must be a string max 100 chars`);

  // buyerType — Mandatory for B2B/B2G, enum
  if (isB2BorB2G) {
    check(errors, !buyer.buyerType,
      `${prefix}.buyer: buyerType is mandatory for ${transactionType}`);
  }
  check(errors, buyer.buyerType && !ALLOWED_BUYER_TYPES.includes(buyer.buyerType),
    `${prefix}.buyer: buyerType must be one of ${ALLOWED_BUYER_TYPES.join(", ")}`);

  // tan — Mandatory for B2B/B2G, String(8)
  if (isB2BorB2G) {
    check(errors, !buyer.tan, `${prefix}.buyer: tan is mandatory for ${transactionType}`);
  }
  check(errors, buyer.tan && !isValidString(buyer.tan, 8),
    `${prefix}.buyer: tan must be a string max 8 chars`);

  // brn — Mandatory for B2B (not B2G per v1.2), String(10)
  if (transactionType === "B2B") {
    check(errors, !buyer.brn, `${prefix}.buyer: brn is mandatory for B2B transactions`);
  }
  check(errors, buyer.brn && !isValidString(buyer.brn, 7),
    `${prefix}.buyer: brn must be a string max 10 chars`);

  // businessAddr — Optional, String(100)
  check(errors, buyer.businessAddr && !isValidString(buyer.businessAddr, 100),
    `${prefix}.buyer: businessAddr must be a string max 100 chars`);

  // nic — Optional, String(14)
  check(errors, buyer.nic && !isValidString(buyer.nic, 14),
    `${prefix}.buyer: nic must be a string max 14 chars`);

  return errors;
}

// ── Invoice Validation

function validateInvoices(invoices) {
  const errors = [];

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { valid: false, errors: ["Body must be a non-empty array of invoices."] };
  }

  invoices.forEach((inv, idx) => {
    const p = `Invoice[${idx}]`;

    // ── Invoice Details 

    // personType — Mandatory, enum, String(4)
    check(errors, !inv.personType, `${p}: personType is mandatory`);
    check(errors, inv.personType && !ALLOWED_PERSON_TYPES.includes(inv.personType),
      `${p}: personType must be one of ${ALLOWED_PERSON_TYPES.join(", ")}`);

    // transactionType — Mandatory, enum, String(3)
    check(errors, !inv.transactionType, `${p}: transactionType is mandatory`);
    check(errors, inv.transactionType && !ALLOWED_TRANSACTION_TYPES.includes(inv.transactionType),
      `${p}: transactionType must be one of ${ALLOWED_TRANSACTION_TYPES.join(", ")}`);

    // invoiceTypeDesc — Mandatory, enum, String(3)
    check(errors, !inv.invoiceTypeDesc, `${p}: invoiceTypeDesc is mandatory`);
    check(errors, inv.invoiceTypeDesc && !ALLOWED_INVOICE_TYPES.includes(inv.invoiceTypeDesc),
      `${p}: invoiceTypeDesc must be one of ${ALLOWED_INVOICE_TYPES.join(", ")}`);

    // invoiceIdentifier — Mandatory, String(100)
    check(errors, !inv.invoiceIdentifier, `${p}: invoiceIdentifier is mandatory`);
    check(errors, inv.invoiceIdentifier && !isValidString(inv.invoiceIdentifier, 100),
      `${p}: invoiceIdentifier must be a string max 100 chars`);

    // invoiceCounter — Mandatory, String(20)
    check(errors, !inv.invoiceCounter, `${p}: invoiceCounter is mandatory`);
    check(errors, inv.invoiceCounter && !isValidString(inv.invoiceCounter, 20),
      `${p}: invoiceCounter must be a string max 20 chars`);

    // invoiceRefIdentifier — Conditional: mandatory for CRN/DRN, String(100)
    if (CREDIT_DEBIT_TYPES.includes(inv.invoiceTypeDesc)) {
      check(errors, !inv.invoiceRefIdentifier,
        `${p}: invoiceRefIdentifier is mandatory when invoiceTypeDesc is ${inv.invoiceTypeDesc}`);
    }
    check(errors, inv.invoiceRefIdentifier && !isValidString(inv.invoiceRefIdentifier, 100),
      `${p}: invoiceRefIdentifier must be a string max 100 chars`);

    // previousNoteHash — Mandatory, String(100)
    check(errors, inv.previousNoteHash === undefined || inv.previousNoteHash === null,
      `${p}: previousNoteHash is mandatory (use "0" for first invoice)`);
    check(errors, inv.previousNoteHash && !isValidString(inv.previousNoteHash, 100),
      `${p}: previousNoteHash must be a string max 100 chars`);

    // dateTimeInvoiceIssued — Mandatory, String(17), format yyyyMMdd HH:mm:ss
    check(errors, !inv.dateTimeInvoiceIssued, `${p}: dateTimeInvoiceIssued is mandatory`);
    check(errors, inv.dateTimeInvoiceIssued && !isValidDateTime(inv.dateTimeInvoiceIssued),
      `${p}: dateTimeInvoiceIssued must follow format yyyyMMdd HH:mm:ss (e.g. "20241001 10:30:00")`);

    // totalVatAmount — Mandatory, String(20), numeric 2dp
    check(errors, !inv.totalVatAmount, `${p}: totalVatAmount is mandatory`);
    check(errors, inv.totalVatAmount && !isValidNumeric(inv.totalVatAmount),
      `${p}: totalVatAmount must be a numeric string rounded to 2 decimal places`);
    check(errors, inv.totalVatAmount && !isValidString(inv.totalVatAmount, 20),
      `${p}: totalVatAmount must be max 20 chars`);

    // totalAmtWoVatCur — Mandatory, String(20), numeric 2dp
    check(errors, !inv.totalAmtWoVatCur, `${p}: totalAmtWoVatCur is mandatory`);
    check(errors, inv.totalAmtWoVatCur && !isValidNumeric(inv.totalAmtWoVatCur),
      `${p}: totalAmtWoVatCur must be a numeric string rounded to 2 decimal places`);

    // totalAmtWoVatMur — Conditional (foreign currency), String(20), numeric
    check(errors, inv.totalAmtWoVatMur && !isValidNumeric(inv.totalAmtWoVatMur, true),
      `${p}: totalAmtWoVatMur must be a numeric string`);
    check(errors, inv.totalAmtWoVatMur && !isValidString(inv.totalAmtWoVatMur, 20),
      `${p}: totalAmtWoVatMur must be max 20 chars`);

    // currency — Mandatory, String(3)
    check(errors, !inv.currency, `${p}: currency is mandatory`);
    check(errors, inv.currency && !isValidString(inv.currency, 3),
      `${p}: currency must be a string max 3 chars (e.g. "MUR")`);

    // invoiceTotal — Mandatory, String(20), numeric 2dp
    // Rule: invoiceTotal = totalVatAmount + totalAmtWoVatCur
    check(errors, !inv.invoiceTotal, `${p}: invoiceTotal is mandatory`);
    check(errors, inv.invoiceTotal && !isValidNumeric(inv.invoiceTotal),
      `${p}: invoiceTotal must be a numeric string rounded to 2 decimal places`);
    if (inv.invoiceTotal && inv.totalVatAmount && inv.totalAmtWoVatCur) {
      const expected = (parseFloat(inv.totalVatAmount) + parseFloat(inv.totalAmtWoVatCur)).toFixed(2);
      const actual   = parseFloat(inv.invoiceTotal).toFixed(2);
      check(errors, expected !== actual,
        `${p}: invoiceTotal (${actual}) must equal totalVatAmount + totalAmtWoVatCur (${expected})`);
    }

    // discountTotalAmount — Conditional, String(20), numeric
    check(errors, inv.discountTotalAmount && !isValidNumeric(inv.discountTotalAmount, true),
      `${p}: discountTotalAmount must be a numeric string`);
    check(errors, inv.discountTotalAmount && !isValidString(inv.discountTotalAmount, 20),
      `${p}: discountTotalAmount must be max 20 chars`);

    // totalAmtPaid — Mandatory, String(20), numeric 2dp
    check(errors, !inv.totalAmtPaid, `${p}: totalAmtPaid is mandatory`);
    check(errors, inv.totalAmtPaid && !isValidNumeric(inv.totalAmtPaid),
      `${p}: totalAmtPaid must be a numeric string rounded to 2 decimal places`);
    check(errors, inv.totalAmtPaid && !isValidString(inv.totalAmtPaid, 20),
      `${p}: totalAmtPaid must be max 20 chars`);

    // reasonStated — Conditional: mandatory for CRN/DRN, String(100)
    if (CREDIT_DEBIT_TYPES.includes(inv.invoiceTypeDesc)) {
      check(errors, !inv.reasonStated,
        `${p}: reasonStated is mandatory when invoiceTypeDesc is ${inv.invoiceTypeDesc}`);
    }
    check(errors, inv.reasonStated && !isValidString(inv.reasonStated, 100),
      `${p}: reasonStated must be a string max 100 chars`);

    // salesTransactions — Mandatory, enum, String(6) (longest is BNKTRANSFER=11, spec says 6 but values exceed it — we allow actual values)
    check(errors, !inv.salesTransactions, `${p}: salesTransactions is mandatory`);
    check(errors, inv.salesTransactions && !ALLOWED_SALES_TRANSACTIONS.includes(inv.salesTransactions),
      `${p}: salesTransactions must be one of ${ALLOWED_SALES_TRANSACTIONS.join(", ")}`);

    // ── Seller ──
    errors.push(...validateSeller(inv.seller, p));

    // ── Buyer ──
    errors.push(...validateBuyer(inv.buyer, p, inv.transactionType));

    // ── Item List ──
    if (!Array.isArray(inv.itemList) || inv.itemList.length === 0) {
      errors.push(`${p}: itemList must be a non-empty array`);
    } else {
      inv.itemList.forEach((item, i) => {
        errors.push(...validateItem(item, `${p}.itemList[${i}]`, inv.personType));
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

// ── Sample Invoice─

function generateSampleInvoice() {
  const itemList = [
    {
      itemNo: "1",
      taxCode: "TC01",
      nature: "GOODS",
      productCodeMra: "",
      productCodeOwn: "pdtOwn",
      itemDesc: "Dilait Condenser 23",
      quantity: "5",
      unitPrice: "40.00",
      discount: "0",
      discountedValue: "0",
      amtWoVatCur: "200.00",
      amtWoVatMur: "200.00",
      vatAmt: "15.00",
      totalPrice: "215.00",
    },
  ];

  return [
    {
      invoiceCounter: "1",
      transactionType: "B2C",
      personType: "VATR",
      invoiceTypeDesc: "STD",
      currency: "MUR",
      invoiceIdentifier: `SI-HO-${formatDateTime(new Date()).replace(/[^0-9]/g, "")}`,
      invoiceRefIdentifier: "",
      previousNoteHash: "0",
      reasonStated: "",
      totalVatAmount: "15.00",
      totalAmtWoVatCur: "200.00",
      totalAmtWoVatMur: "200.00",
      invoiceTotal: "215.00",
      discountTotalAmount: "",
      totalAmtPaid: "215.00",
      dateTimeInvoiceIssued: formatDateTime(new Date()),
      salesTransactions: "CASH",
      seller: {
        name: "Amyaaz Aumeer",
        tradeName: "TEST",
        tan: "28174903",
        brn: "C2320004",
        businessAddr: "Port Louis",
        businessPhoneNo: "2824357",
        ebsCounterNo: "a1",
      },
      buyer: {
        name: "MetaBox",
        tan: "",
        brn: "",
        businessAddr: "Pailles",
        buyerType: "NVTR",
        nic: "",
      },
      itemList,
    },
  ];
}

module.exports = { generateSampleInvoice, validateInvoices };