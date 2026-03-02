import db from './db.js';
import { getCatalogItem } from './catalog.js';

// Lazy-load Stripe to avoid slowing down server startup
let stripe = null;

function initStripe() {
  if (stripe) return;
  if (process.env.STRIPE_SECRET_KEY) {
    import('stripe').then(({ default: Stripe }) => {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      console.log('Stripe payments ready');
    }).catch(err => console.warn('Failed to load Stripe SDK:', err.message));
  } else {
    console.warn('STRIPE_SECRET_KEY not set — payments disabled');
  }
}
setTimeout(initStripe, 0);

// Bundle definitions: pearls → charge in cents
// Formula: charge = (pearls_value * 1.2 + 0.30) / 0.971
// where pearls_value = pearls * 0.05
const BUNDLES = {
  5:   62,   // $0.62
  10:  93,   // $0.93
  20:  155,  // $1.55
  40:  278,  // $2.78
  100: 649,  // $6.49
  200: 1267, // $12.67
};

export function getBundles() {
  return Object.entries(BUNDLES).map(([pearls, cents]) => ({
    pearls: Number(pearls),
    cents,
    display: `$${(cents / 100).toFixed(2)}`,
  }));
}

export function isStripeEnabled() {
  return !!stripe;
}

export async function createCheckoutSession(accountId, pearlCount, origin) {
  if (!stripe) throw new Error('Payments not configured');

  const cents = BUNDLES[pearlCount];
  if (!cents) throw new Error('Invalid bundle size');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${pearlCount} Pearls`,
          description: `${pearlCount} Pearls for Club Penguin Builder`,
        },
        unit_amount: cents,
      },
      quantity: 1,
    }],
    metadata: {
      accountId,
      pearls: String(pearlCount),
    },
    success_url: `${origin}/?payment=success`,
    cancel_url: `${origin}/?payment=cancelled`,
  });

  // Store session for webhook fulfillment
  db.prepare(
    'INSERT INTO stripe_sessions (session_id, account_id, pearls) VALUES (?, ?, ?)'
  ).run(session.id, accountId, pearlCount);

  return { url: session.url };
}

export function handleWebhook(payload, signature) {
  if (!stripe) throw new Error('Payments not configured');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('Webhook secret not configured');

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    fulfillSession(session.id);
  }
}

function fulfillSession(sessionId) {
  const row = db.prepare('SELECT * FROM stripe_sessions WHERE session_id = ? AND status = ?').get(sessionId, 'pending');
  if (!row) return; // Already fulfilled or unknown

  const txn = db.transaction(() => {
    // Award Pearls
    db.prepare('UPDATE accounts SET pearl_balance = pearl_balance + ? WHERE id = ?').run(row.pearls, row.account_id);

    // Record transaction
    db.prepare(
      'INSERT INTO pearl_transactions (account_id, amount, type, reference) VALUES (?, ?, ?, ?)'
    ).run(row.account_id, row.pearls, 'purchase', sessionId);

    // Mark session complete
    db.prepare('UPDATE stripe_sessions SET status = ? WHERE session_id = ?').run('completed', sessionId);
  });
  txn();
}

export function getBalance(accountId) {
  const row = db.prepare('SELECT pearl_balance FROM accounts WHERE id = ?').get(accountId);
  return row ? row.pearl_balance : 0;
}

export function getTransactions(accountId, limit = 20) {
  return db.prepare(
    'SELECT amount, type, reference, created_at FROM pearl_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(accountId, limit);
}

export function purchaseItem(buyerAccountId, catalogId) {
  const item = getCatalogItem(catalogId);
  if (!item) return { ok: false, error: 'Item not found' };
  if (item.price <= 0) return { ok: false, error: 'This item is free — collect it in-game' };

  // Uploader can always access their own items
  if (item.uploaderId === buyerAccountId) return { ok: false, error: 'You uploaded this item — you already own it' };

  // Check if already purchased
  const existing = db.prepare('SELECT 1 FROM item_purchases WHERE account_id = ? AND catalog_id = ?').get(buyerAccountId, catalogId);
  if (existing) return { ok: false, error: 'You already own this item' };

  // Check balance
  const balance = getBalance(buyerAccountId);
  if (balance < item.price) return { ok: false, error: `Not enough Pearls (need ${item.price}, have ${balance})` };

  const txn = db.transaction(() => {
    // Deduct from buyer
    db.prepare('UPDATE accounts SET pearl_balance = pearl_balance - ? WHERE id = ?').run(item.price, buyerAccountId);
    db.prepare(
      'INSERT INTO pearl_transactions (account_id, amount, type, reference) VALUES (?, ?, ?, ?)'
    ).run(buyerAccountId, -item.price, 'item_buy', catalogId);

    // Credit seller
    if (item.uploaderId) {
      db.prepare('UPDATE accounts SET pearl_balance = pearl_balance + ? WHERE id = ?').run(item.price, item.uploaderId);
      db.prepare(
        'INSERT INTO pearl_transactions (account_id, amount, type, reference) VALUES (?, ?, ?, ?)'
      ).run(item.uploaderId, item.price, 'item_sale', catalogId);
    }

    // Record purchase
    db.prepare('INSERT INTO item_purchases (account_id, catalog_id) VALUES (?, ?)').run(buyerAccountId, catalogId);
  });
  txn();

  return { ok: true };
}

export function canAccessItem(accountId, catalogId) {
  const item = getCatalogItem(catalogId);
  if (!item) return false;
  if (item.uploaderId === accountId) return true; // Uploader always owns it
  return !!db.prepare('SELECT 1 FROM item_purchases WHERE account_id = ? AND catalog_id = ?').get(accountId, catalogId);
}

export function acquireFreeItem(accountId, catalogId) {
  const item = getCatalogItem(catalogId);
  if (!item) return { ok: false, error: 'Item not found' };
  if (item.price > 0) return { ok: false, error: 'This item is not free' };
  if (item.uploaderId === accountId) return { ok: false, error: 'You uploaded this item — you already own it' };
  db.prepare('INSERT OR IGNORE INTO item_purchases (account_id, catalog_id) VALUES (?, ?)').run(accountId, catalogId);
  return { ok: true };
}

export function getPurchasedItems(accountId) {
  return db.prepare('SELECT catalog_id FROM item_purchases WHERE account_id = ?').all(accountId).map(r => r.catalog_id);
}

// --- Stripe Connect (seller cash-out) ---

export async function createConnectAccount(accountId) {
  if (!stripe) throw new Error('Payments not configured');

  const account = db.prepare('SELECT stripe_connect_id FROM accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error('Account not found');

  // Idempotent: return existing if already created
  if (account.stripe_connect_id) {
    return { connectId: account.stripe_connect_id };
  }

  const connectAccount = await stripe.accounts.create({
    type: 'express',
    metadata: { accountId },
  });

  db.prepare('UPDATE accounts SET stripe_connect_id = ? WHERE id = ?')
    .run(connectAccount.id, accountId);

  return { connectId: connectAccount.id };
}

export async function createOnboardingLink(accountId, origin) {
  if (!stripe) throw new Error('Payments not configured');

  const account = db.prepare('SELECT stripe_connect_id FROM accounts WHERE id = ?').get(accountId);
  if (!account?.stripe_connect_id) throw new Error('No connected account — create one first');

  const link = await stripe.accountLinks.create({
    account: account.stripe_connect_id,
    refresh_url: `${origin}/?connect=refresh`,
    return_url: `${origin}/?connect=return`,
    type: 'account_onboarding',
  });

  return { url: link.url };
}

export async function getConnectStatus(accountId) {
  if (!stripe) return { connected: false, onboardingComplete: false };

  const account = db.prepare('SELECT stripe_connect_id, stripe_onboarding_complete FROM accounts WHERE id = ?').get(accountId);
  if (!account?.stripe_connect_id) return { connected: false, onboardingComplete: false };

  // If already marked complete locally, trust it
  if (account.stripe_onboarding_complete) {
    return { connected: true, onboardingComplete: true };
  }

  // Check with Stripe
  const stripeAcct = await stripe.accounts.retrieve(account.stripe_connect_id);
  const complete = stripeAcct.details_submitted && !(stripeAcct.requirements?.currently_due?.length);

  if (complete) {
    db.prepare('UPDATE accounts SET stripe_onboarding_complete = 1 WHERE id = ?').run(accountId);
  }

  return { connected: true, onboardingComplete: complete };
}

export async function cashOut(accountId, pearls) {
  if (!stripe) throw new Error('Payments not configured');
  if (!Number.isInteger(pearls) || pearls <= 0) throw new Error('Invalid Pearl amount');

  const account = db.prepare('SELECT stripe_connect_id, stripe_onboarding_complete, pearl_balance FROM accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error('Account not found');
  if (!account.stripe_connect_id || !account.stripe_onboarding_complete) {
    throw new Error('Complete Stripe onboarding before cashing out');
  }
  if (account.pearl_balance < pearls) {
    throw new Error(`Not enough Pearls (have ${account.pearl_balance}, need ${pearls})`);
  }

  const amountCents = pearls * 5; // $0.05 per pearl

  // Atomically deduct pearls and create transfer record
  let transferRowId;
  const deductTxn = db.transaction(() => {
    db.prepare('UPDATE accounts SET pearl_balance = pearl_balance - ? WHERE id = ?').run(pearls, accountId);

    const result = db.prepare(
      'INSERT INTO cashout_transfers (account_id, pearls, amount_cents) VALUES (?, ?, ?)'
    ).run(accountId, pearls, amountCents);
    transferRowId = result.lastInsertRowid;

    db.prepare(
      'INSERT INTO pearl_transactions (account_id, amount, type, reference) VALUES (?, ?, ?, ?)'
    ).run(accountId, -pearls, 'cashout', String(transferRowId));
  });
  deductTxn();

  // Stripe transfer (outside DB transaction)
  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: account.stripe_connect_id,
      metadata: { accountId, pearls: String(pearls) },
    });

    db.prepare('UPDATE cashout_transfers SET status = ?, stripe_transfer_id = ? WHERE id = ?')
      .run('completed', transfer.id, transferRowId);

    return { ok: true, transferId: transfer.id, amountCents, pearls };
  } catch (err) {
    // Transfer failed — refund pearls atomically
    const refundTxn = db.transaction(() => {
      db.prepare('UPDATE accounts SET pearl_balance = pearl_balance + ? WHERE id = ?').run(pearls, accountId);
      db.prepare(
        'INSERT INTO pearl_transactions (account_id, amount, type, reference) VALUES (?, ?, ?, ?)'
      ).run(accountId, pearls, 'cashout_refund', String(transferRowId));
      db.prepare('UPDATE cashout_transfers SET status = ?, error = ? WHERE id = ?')
        .run('failed', err.message, transferRowId);
    });
    refundTxn();

    console.error('Cash-out transfer failed:', err.message);
    throw new Error(`Transfer failed: ${err.message}`);
  }
}
