export type WebhookFormValues = {
  name: string;
  endpoint: string;
  events: string;
  enabled: boolean;
  secret?: string;
};

export type NotificationRouteFormValues = {
  name: string;
  strategy_id?: string;
  event_key?: string;
  severity?: string;
  camera_id?: string;
  recipient_type: 'user' | 'chat';
  recipient_id: string;
  enabled: boolean;
  priority: number;
  cooldown_seconds: number;
  message_template?: string;
};
