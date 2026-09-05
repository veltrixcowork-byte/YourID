import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../../database/database.service';
import { mapStore } from '../../../database/mappers';

// BUG-027 FIX: pas de Redis dans cette stack ("zéro cloud" / SQLite seul),
// donc cache TTL en mémoire process pour éviter une requête DB sur CHAQUE
// requête authentifiée. TTL court (30s) pour rester réactif aux changements
// de statut/role (suspension, etc.).
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { value: any; expiresAt: number }>();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService, private db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    const cached = userCache.get(payload.sub);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const user = this.db.get('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!user || user.status === 'SUSPENDED') throw new UnauthorizedException();

    const store = this.db.get('SELECT * FROM stores WHERE userId = ?', [user.id]);

    const result = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
      store: store ? mapStore(store) : null,
    };

    userCache.set(payload.sub, { value: result, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return result;
  }
}
