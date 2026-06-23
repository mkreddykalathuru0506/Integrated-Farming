/**
 * NotificationService adapter (Brief §7, decision #3). Channels = SMS/WhatsApp/email/n8n.
 * Real providers are PAID + need credentials → owner-gated; they are stubs here and never
 * wired by default. The Mock records the send (status MOCKED) without contacting anyone, so
 * alert routing is fully exercisable in dev/CI with no spend.
 */
export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'WEBHOOK' | 'PUSH';

export type NotificationRequest = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
};

export type NotificationResult = {
  status: 'MOCKED' | 'SENT' | 'FAILED';
  providerRef?: string;
  error?: string;
};

export interface NotificationService {
  readonly name: string;
  send(req: NotificationRequest): Promise<NotificationResult>;
}

/** Default: records the send without contacting any provider (no spend). */
export class MockNotificationService implements NotificationService {
  readonly name = 'mock';
  private seq = 0;
  async send(): Promise<NotificationResult> {
    this.seq += 1;
    return { status: 'MOCKED', providerRef: `mock-${this.seq}` };
  }
}

/**
 * Owner-gated real provider (Twilio/WhatsApp/email/n8n). Inert until credentials are wired —
 * a separate §3 checkpoint (paid). Throws so callers degrade to the mock.
 */
export class UnconfiguredNotificationService implements NotificationService {
  constructor(readonly name: string) {}
  async send(): Promise<NotificationResult> {
    throw new Error(`${this.name} notification provider not configured (owner-gated)`);
  }
}

/** Provider selection: mock unless a real provider is explicitly configured via env. */
export function makeNotificationService(): NotificationService {
  const provider = process.env.NODE_ENV !== 'test' ? process.env.NOTIFY_PROVIDER : undefined;
  if (provider && provider !== 'mock') {
    // Real providers require credentials + an owner checkpoint; until wired, stay inert.
    return new UnconfiguredNotificationService(provider);
  }
  return new MockNotificationService();
}
