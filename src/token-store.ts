import fs from "fs/promises";
import path from "path";
import { TokenHealth, YahooTokenRecord } from "./types.js";

export class TokenStore {
  constructor(private readonly filePath: string) {}

  async get(): Promise<YahooTokenRecord | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as YahooTokenRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async set(token: YahooTokenRecord): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(token, null, 2), "utf8");
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async health(): Promise<TokenHealth> {
    const token = await this.get();
    if (!token) {
      return { hasToken: false, isExpired: true };
    }

    const now = Date.now();
    const remainingSeconds = Math.floor((token.expiresAt - now) / 1000);

    return {
      hasToken: true,
      isExpired: token.expiresAt <= now,
      expiresAt: token.expiresAt,
      expiresAtIso: new Date(token.expiresAt).toISOString(),
      secondsRemaining: remainingSeconds
    };
  }
}
