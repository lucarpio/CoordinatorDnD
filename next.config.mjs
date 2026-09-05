/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permitir conexiones de desarrollo desde tu teléfono en la red local
  // @ts-ignore
  allowedDevOrigins: ["192.168.15.12:3000", "localhost:3000"],
};

export default nextConfig;
