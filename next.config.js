/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://homophonic-victoria-peltately.ngrok-free.dev",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "homophonic-victoria-peltately.ngrok-free.dev",
      ],
    },
  },
};

module.exports = nextConfig;