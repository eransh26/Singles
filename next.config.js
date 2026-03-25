/** @type {import('next').NextConfig} */
function parseOriginList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toServerActionOrigin(value) {
  try {
    const url = new URL(value);
    return url.host;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

const defaultPort = process.env.PORT ?? "3000";
const defaultDevOrigins = [`http://localhost:${defaultPort}`, `http://127.0.0.1:${defaultPort}`];
const envOrigins = [
  ...parseOriginList(process.env.DEV_ALLOWED_ORIGINS),
  ...parseOriginList(process.env.NEXT_PUBLIC_DEV_TUNNEL_ORIGIN),
].map(normalizeOrigin);
const allowedDevOrigins = Array.from(new Set([...defaultDevOrigins, ...envOrigins]));
const serverActionAllowedOrigins = Array.from(new Set(allowedDevOrigins.map(toServerActionOrigin)));

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
};

module.exports = nextConfig;
