// src/ai/prompts/prompt-engineering.ts

// System messages define the AI's role
export const SYSTEM_MESSAGES = {
  GENERATE: `You are an expert at creating powerful, concise, and effective extraction prompts for Box AI.
Your task is to generate a single, actionable extraction prompt based on the provided context.

GUIDELINES:
- The prompt must be specific about what to extract.
- It should include fallback strategies or alternative instructions for when the data is not explicitly stated.
- It should be under 3 sentences to maintain clarity and efficiency.
- Generate ONLY the extraction prompt itself, with no additional explanations, introductions, or pleasantries.`,

  IMPROVE: `You are an expert at refining and improving extraction prompts for Box AI.
Your task is to create a new, single, cohesive extraction prompt that intelligently combines an original prompt with a user's feedback and requirements.

GUIDELINES:
- The new prompt must maintain the core function of the original prompt.
- It must seamlessly incorporate the user's specific feedback.
- It should provide clear instructions for any edge cases mentioned by the user.
- The final prompt must be concise (under 3 sentences) and highly actionable for an AI model.
- Generate ONLY the improved extraction prompt, with no additional explanations, introductions, or pleasantries.`,
};

// Heuristics guide the AI based on field type
export const FIELD_TYPE_HEURISTICS: Record<string, string[]> = {
  string: [
  ],
  date: [
    'Format the output as YYYY-MM-DD.',
    'If the date is not present, return "null".',
  ],
  enum: [
    'The value must be one of the predefined choices.',
    'If no value matches, return "null".',
  ],
};

// Keyword heuristics handle common field names
export const FIELD_KEY_HEURISTICS: Record<string, string[]> = {
  counterparty: [
    'The counterparty is the other party in the agreement, not our company (Increo, Inc.).',
  ],
  term: [
    'If the term is not explicitly stated, try to calculate it from the start and end dates.',
  ],
  end_date: [
    'If the end date is not specified, use the date the contract was last signed.',
  ],
  // Invoice-specific fields
  invoice_number: [
    'Look for labels like "Invoice No.", "Inv #", or "Invoice #". Prefer the header section.',
  ],
  invoice_date: [
    'Extract the invoice issue date, typically labeled "Invoice Date" or "Date". Format as YYYY-MM-DD.',
  ],
  total_amount: [
    'Use the grand total or final amount; avoid subtotals or line item totals. Include currency symbol if present.',
  ],
  amount: [
    'Extract the total amount due. Look for "Total", "Amount Due", or "Grand Total". Include currency if present.',
  ],
  due_date: [
    'Look for "Due Date", "Payment Due", or payment terms like "Net 30". Convert to YYYY-MM-DD format.',
  ],
  vendor_name: [
    'Extract the vendor/supplier company name from the header or billing section, not the customer name.',
  ],
  // Purchase Order-specific fields
  po_number: [
    'Look for "PO Number", "Purchase Order No.", or "P.O. #" in headers or reference sections.',
  ],
  supplier_name: [
    'The supplier/vendor is the organization providing goods/services; avoid buyer organization name.',
  ],
  order_date: [
    'Extract the date the purchase order was created, typically labeled "Order Date" or "PO Date".',
  ],
  delivery_date: [
    'Look for "Delivery Date", "Ship Date", or "Required By" date. Format as YYYY-MM-DD.',
  ],
  // Insurance/Compliance fields  
  vendor: [
    'Extract the primary vendor or service provider name from the document header.',
  ],
  expiration: [
    'Look for expiration dates, end dates, or validity periods. Format as YYYY-MM-DD.',
  ],
  coverage: [
    'Extract coverage amounts, limits, or values. Include currency and units if specified.',
  ],
}; 