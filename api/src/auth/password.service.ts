import { randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PASSWORD_MAX_BYTES } from '@hares/contract';
import { BCRYPT_COST } from './auth.constants';

/**
 * bcrypt hashing (cost 12, decision 32). Passwords and hashes are never logged.
 *
 * `verify` always spends one bcrypt comparison, even when there is no account
 * or the password is too long, so response time does not reveal whether an
 * email is registered (decision 29).
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash?: Promise<string>;

  /** Build the dummy hash at boot so the first unknown-email login is not slower. */
  async onModuleInit(): Promise<void> {
    await this.getDummyHash();
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  async verify(password: string, hash: string | null): Promise<boolean> {
    const tooLong = Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES;
    if (!hash || tooLong) {
      await bcrypt.compare(password.slice(0, PASSWORD_MAX_BYTES), await this.getDummyHash());
      return false;
    }
    return bcrypt.compare(password, hash);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_COST);
    return this.dummyHash;
  }
}
