import 'dotenv/config';
function list(value) {
    return (value ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
const passcode = process.env.APP_PASSCODE?.trim() ?? '';
const authSecret = process.env.AUTH_SECRET?.trim() ?? '';
if (passcode && authSecret.length < 16) {
    throw new Error('AUTH_SECRET must be set (16+ characters) when APP_PASSCODE is set');
}
export const config = {
    port: Number(process.env.PORT ?? 5000),
    mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/misu_stall',
    clientOrigins: list(process.env.CLIENT_ORIGIN),
    passcode,
    authSecret,
    timeZone: process.env.APP_TIMEZONE?.trim() || 'Asia/Kolkata',
    isProduction: process.env.NODE_ENV === 'production',
};
export const authEnabled = config.passcode.length > 0;
//# sourceMappingURL=config.js.map