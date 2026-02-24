export type YahooTokenRecord = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  obtainedAt: string;
};

export type TokenHealth = {
  hasToken: boolean;
  isExpired: boolean;
  expiresAt?: number;
  expiresAtIso?: string;
  secondsRemaining?: number;
};
