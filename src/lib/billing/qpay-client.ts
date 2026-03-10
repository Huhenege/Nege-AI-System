/**
 * QPay V2 API Client
 *
 * Docs: https://developer.qpay.mn
 *
 * Env vars required:
 *   QPAY_INVOICE_CODE   – merchant invoice code
 *   QPAY_USERNAME        – QPay username
 *   QPAY_PASSWORD        – QPay password
 *   QPAY_CALLBACK_URL    – callback URL for payment notifications
 */

const QPAY_BASE = 'https://merchant.qpay.mn/v2';

interface QPayTokenResponse {
  token_type: string;
  refresh_expires_in: number;
  refresh_token: string;
  access_token: string;
  expires_in: number;
}

interface QPayInvoiceRequest {
  invoice_code: string;
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: number;
  callback_url: string;
}

export interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  qPay_shortUrl: string;
  urls: Array<{ name: string; description: string; logo: string; link: string }>;
}

export interface QPayPaymentCheckResponse {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id: string;
    payment_status: string;
    payment_amount: string;
    trx_fee: string;
    payment_currency: string;
    payment_wallet: string;
    payment_type: string;
    card_transactions: Array<{
      id: string;
      transaction_bank_code: string;
      status: string;
      amount: string;
    }>;
    p2p_transactions: Array<{
      id: string;
      transaction_bank_code: string;
      account_bank_code: string;
      account_bank_name: string;
      account_number: string;
      status: string;
      amount: string;
      currency: string;
      settlement_status: string;
    }>;
  }>;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;

  if (!username || !password) {
    throw new Error('QPAY_USERNAME and QPAY_PASSWORD env vars required');
  }

  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
  });

  if (!res.ok) {
    throw new Error(`QPay auth failed: ${res.status}`);
  }

  const data: QPayTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function createInvoice(opts: {
  senderInvoiceNo: string;
  receiverCode: string;
  description: string;
  amount: number;
}): Promise<QPayInvoiceResponse> {
  const token = await getAccessToken();
  const invoiceCode = process.env.QPAY_INVOICE_CODE;
  const callbackUrl = process.env.QPAY_CALLBACK_URL;

  if (!invoiceCode || !callbackUrl) {
    throw new Error('QPAY_INVOICE_CODE and QPAY_CALLBACK_URL env vars required');
  }

  const body: QPayInvoiceRequest = {
    invoice_code: invoiceCode,
    sender_invoice_no: opts.senderInvoiceNo,
    invoice_receiver_code: opts.receiverCode,
    invoice_description: opts.description,
    amount: opts.amount,
    callback_url: `${callbackUrl}?invoice=${opts.senderInvoiceNo}`,
  };

  const res = await fetch(`${QPAY_BASE}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QPay invoice creation failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function checkPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
  const token = await getAccessToken();

  const res = await fetch(`${QPAY_BASE}/payment/check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!res.ok) {
    throw new Error(`QPay payment check failed: ${res.status}`);
  }

  return res.json();
}
