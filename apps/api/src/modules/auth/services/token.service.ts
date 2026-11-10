import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { authConfig } from '../../../config/auth-config.js';

/** The two kinds of token: a signed JWT (access) and a random opaque string (refresh). */
@Injectable()
export class TokenService {
  /** Access token: HS256 JWT, `sub` = user id, expires after ACCESS_TOKEN_TTL_SECONDS. */
  async signAccessToken(userId: number): Promise<string> {
    const { jwtSecret, accessTtlSeconds } = authConfig();
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(userId))
      .setIssuedAt(now)
      .setExpirationTime(now + accessTtlSeconds)
      .sign(jwtSecret);
  }

  /** User id of a valid access token; undefined if it is malformed, forged or expired. */
  async verifyAccessToken(token: string): Promise<number | undefined> {
    try {
      const { payload } = await jwtVerify(token, authConfig().jwtSecret, { algorithms: ['HS256'] });
      const id = Number(payload.sub);
      return Number.isSafeInteger(id) ? id : undefined;
    } catch {
      return undefined;
    }
  }

  /** New opaque refresh token (256 random bits). Only its hash is stored. */
  newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
