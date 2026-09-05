#!/usr/bin/env ts-node
/**
 * Reset admin password script
 * Usage (run from repository root or apps/api):
 *  npx ts-node apps/api/scripts/reset-admin-password.ts [email] [newPassword]
 *
 * If no args provided, defaults to admin@yourid.com / Admin@2025!
 */
/**
 * Reset admin password script
 * Usage (run from repository root or apps/api):
 *  npx ts-node apps/api/scripts/reset-admin-password.ts [email] [newPassword]
 *
 * If no args provided, defaults to admin@yourid.com / Admin@2025!
 */
import * as path from 'path';
import * as argon2 from 'argon2';
import BetterSqlite3 = require('better-sqlite3');

interface UserRow {
  id: string;
  email: string;
}

async function main() {
  const email = process.argv[2] || 'admin@yourid.com';
  const newPassword = process.argv[3] || 'Admin@2025!';
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), '..', '..', 'data', 'yourid.db');

  console.log(`Using DB: ${dbPath}`);
  const db = new BetterSqlite3(dbPath);

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) {
    console.error(`User not found: ${email}`);
    db.close();
    process.exit(1);
  }

  const hash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
  db.prepare('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?').run(hash, new Date().toISOString(), user.id);

  console.log(`✅ Password updated for ${email}. New password: ${newPassword}`);
  console.log('You can now login at http://localhost:3000/login');
  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });