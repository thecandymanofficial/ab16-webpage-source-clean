import { describe, it, expect } from 'vitest';
import {
  deriveFailedPaymentAlerts,
  deriveStuckOrderAlerts,
  deriveMissingMappingAlerts,
  deriveLowStockAlerts,
  deriveStripeEventAlerts,
  derivePrintfulFailureAlerts,
  sortAlerts,
  type OrderAlertInput,
  type VariantAlertInput,
  type StripeEventAlertInput,
  type PrintfulOrderAlertInput,
} from './adminAlerts';

const order = (overrides: Partial<OrderAlertInput> = {}): OrderAlertInput => ({
  id: 'ord-1',
  order_number: 'AB16-001',
  email: 'test@test.com',
  payment_status: 'paid',
  fulfilment_status: 'unfulfilled',
  total: 5000,
  created_at: new Date().toISOString(),
  ...overrides,
});

const variant = (overrides: Partial<VariantAlertInput> = {}): VariantAlertInput => ({
  id: 'var-1',
  product_name: 'Hoodie',
  size: 'M',
  color: 'Black',
  printful_sync_variant_id: null,
  stock: 10,
  ...overrides,
});

describe('deriveFailedPaymentAlerts', () => {
  it('flags failed payments as critical', () => {
    const alerts = deriveFailedPaymentAlerts([order({ id: 'o1', payment_status: 'failed' })]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].category).toBe('Payments');
  });

  it('ignores paid and pending orders', () => {
    const alerts = deriveFailedPaymentAlerts([order({ payment_status: 'paid' }), order({ payment_status: 'pending' })]);
    expect(alerts).toHaveLength(0);
  });
});

describe('deriveStuckOrderAlerts', () => {
  it('flags paid-unfulfilled orders older than 3 days', () => {
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const alerts = deriveStuckOrderAlerts([order({ id: 'o1', created_at: old })]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
  });

  it('ignores recent paid-unfulfilled orders', () => {
    const alerts = deriveStuckOrderAlerts([order({ created_at: new Date().toISOString() })]);
    expect(alerts).toHaveLength(0);
  });

  it('ignores fulfilled orders even if old', () => {
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const alerts = deriveStuckOrderAlerts([order({ created_at: old, fulfilment_status: 'shipped' })]);
    expect(alerts).toHaveLength(0);
  });
});

describe('deriveMissingMappingAlerts', () => {
  it('flags variants without printful_sync_variant_id', () => {
    const alerts = deriveMissingMappingAlerts([variant({ id: 'v1' }), variant({ id: 'v2', printful_sync_variant_id: 123 })]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].category).toBe('Printful');
  });
});

describe('deriveLowStockAlerts', () => {
  it('flags variants below threshold', () => {
    const alerts = deriveLowStockAlerts([variant({ id: 'v1', stock: 2 }), variant({ id: 'v2', stock: 10 })]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('info');
  });
});

describe('deriveStripeEventAlerts', () => {
  it('flags failed events as critical', () => {
    const inputs: StripeEventAlertInput[] = [
      { event_id: 'evt_1', event_type: 'checkout.session.completed', status: 'failed', error: 'boom' },
      { event_id: 'evt_2', event_type: 'payment.intent.succeeded', status: 'completed', error: null },
    ];
    const alerts = deriveStripeEventAlerts(inputs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].category).toBe('Stripe');
  });
});

describe('derivePrintfulFailureAlerts', () => {
  it('flags failed and cancelled printful orders', () => {
    const inputs: PrintfulOrderAlertInput[] = [
      { id: 'p1', order_number: 'AB16-001', status: 'failed' },
      { id: 'p2', order_number: 'AB16-002', status: 'cancelled' },
      { id: 'p3', order_number: 'AB16-003', status: 'shipped' },
    ];
    const alerts = derivePrintfulFailureAlerts(inputs);
    expect(alerts).toHaveLength(2);
    expect(alerts.every((a) => a.severity === 'critical')).toBe(true);
  });
});

describe('sortAlerts', () => {
  it('sorts critical before warning before info', () => {
    const alerts = [
      { id: '1', severity: 'info' as const, category: 'X', title: 't', detail: 'd', link: '/' },
      { id: '2', severity: 'critical' as const, category: 'X', title: 't', detail: 'd', link: '/' },
      { id: '3', severity: 'warning' as const, category: 'X', title: 't', detail: 'd', link: '/' },
    ];
    const sorted = sortAlerts(alerts);
    expect(sorted[0].severity).toBe('critical');
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[2].severity).toBe('info');
  });
});
