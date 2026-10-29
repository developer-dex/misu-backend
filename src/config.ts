import 'dotenv/config';

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const authSecret = process.env.AUTH_SECRET?.trim() ?? '';

if (authSecret.length < 32) {
  throw new Error(
    'AUTH_SECRET must be set in server/.env (32+ characters). Generate one with: ' +
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  );
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/misu_stall',
  clientOrigins: list(process.env.CLIENT_ORIGIN),
  authSecret,
  timeZone: process.env.APP_TIMEZONE?.trim() || 'Asia/Kolkata',
  isProduction: process.env.NODE_ENV === 'production',
};
