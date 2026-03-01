export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}
