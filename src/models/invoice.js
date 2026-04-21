/**
 * Invoice Models & Validation
 *
 * Mirrors the C# model classes and provides:
 *  - generateSampleInvoice() — same data as the C# sample
 *  - validateInvoice()       — basic field checks before sending to MRA
 */

const { formatDateTime } = require("../services/mraService");

// ── Sample Invoice ────────────────────────────────────────────────────────────

/**
 * Generates the same sample invoice used in the C# reference implementation.
 * @returns {Array} Array containing one MRAInvoice
 */
function generateSampleInvoice() {
  const itemList = [
    {
      itemNo: "1",
      taxCode: "TC01",
      nature: "GOODS",
      productCodeMra: "pdtCode",
      productCodeOwn: "pdtOwn",
      itemDesc: "dilait Condenser 23",
      quantity: "23214",
      unitPrice: "20",
      discount: "1.23",
      discountedValue: "10.1",
      amtWoVatCur: "60",
      amtWoVatMur: "50",
      vatAmt: "10",
      totalPrice: "60",
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
      previousNoteHash: "prevNote",
      reasonStated: "",
      totalVatAmount: "15.0",
      totalAmtWoVatCur: "200.0",
      totalAmtWoVatMur: "200.0",
      invoiceTotal: "215.0",
      discountTotalAmount: "",
      totalAmtPaid: "320.0",
      dateTimeInvoiceIssued: formatDateTime(new Date()),
      seller: {
        name: "Amyaaz Aumeer",
        tradeName: "TEST",
        tan: "28174903",
        brn: "C23200040",
        businessAddr: "Port Louis",
        businessPhoneNo: "2824357",
        ebsCounterNo: "a1",
      },
      buyer: {
        name: "MetaBox",
        tan: "13521252",
        brn: "T09012345",
        businessAddr: "Pailles",
        buyerType: "VATR",
        nic: "T0208010063035",
      },
      itemList,
      salesTransactions: "CASH",
    },
  ];
}

// ── Validation ────────────────────────────────────────────────────────────────

const REQUIRED_INVOICE_FIELDS = [
  "invoiceCounter",
  "transactionType",
  "invoiceTypeDesc",
  "currency",
  "invoiceIdentifier",
  "totalVatAmount",
  "totalAmtWoVatMur",
  "invoiceTotal",
  "totalAmtPaid",
  "dateTimeInvoiceIssued",
  "seller",
  "buyer",
  "itemList",
  "salesTransactions",
];

const REQUIRED_SELLER_FIELDS = ["name", "tan", "brn"];
const REQUIRED_BUYER_FIELDS = ["name"];
const REQUIRED_ITEM_FIELDS = [
  "itemNo",
  "taxCode",
  "nature",
  "itemDesc",
  "quantity",
  "unitPrice",
  "totalPrice",
];

/**
 * Validates an array of invoice objects.
 * @param {Array} invoices
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInvoices(invoices) {
  const errors = [];

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { valid: false, errors: ["Body must be a non-empty array of invoices."] };
  }

  invoices.forEach((inv, idx) => {
    const prefix = `Invoice[${idx}]`;

    REQUIRED_INVOICE_FIELDS.forEach((field) => {
      if (inv[field] === undefined || inv[field] === null) {
        errors.push(`${prefix}: missing required field "${field}"`);
      }
    });

    if (inv.seller) {
      REQUIRED_SELLER_FIELDS.forEach((f) => {
        if (!inv.seller[f]) errors.push(`${prefix}.seller: missing "${f}"`);
      });
    }

    if (inv.buyer) {
      REQUIRED_BUYER_FIELDS.forEach((f) => {
        if (!inv.buyer[f]) errors.push(`${prefix}.buyer: missing "${f}"`);
      });
    }

    if (Array.isArray(inv.itemList)) {
      inv.itemList.forEach((item, i) => {
        REQUIRED_ITEM_FIELDS.forEach((f) => {
          if (!item[f]) errors.push(`${prefix}.itemList[${i}]: missing "${f}"`);
        });
      });
    } else {
      errors.push(`${prefix}: itemList must be an array`);
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { generateSampleInvoice, validateInvoices };
