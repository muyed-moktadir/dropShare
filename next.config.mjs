const nextConfig = {
    // Allow LAN devices (mobile, tablet) to access the dev server via QR code pairing
    // Next.js 16+ blocks cross-origin dev requests by default for safety
    allowedDevOrigins: [
        '192.168.0.137',
        '192.168.0.*',
        '192.168.*.*',
        '10.*.*.*',
    ],
};
export default nextConfig;
