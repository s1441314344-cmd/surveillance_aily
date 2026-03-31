export type WebhookFormValues = {
  name: string;
  endpoint: string;
  events: string;
  enabled: boolean;
  secret?: string;
};
