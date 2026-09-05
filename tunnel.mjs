import { startTunnel } from "untun";

async function run() {
  console.log("Iniciando túnel para el puerto 3000...");
  try {
    const tunnel = await startTunnel({ port: 3000 });
    if (tunnel) {
      const url = await tunnel.getURL();
      console.log("\n==============================================");
      console.log("📱 TU ENLACE PÚBLICO PARA EL TELÉFONO:");
      console.log(url);
      console.log("==============================================\n");
    }
  } catch (err) {
    console.error("Error al iniciar el túnel:", err);
  }
}

run();
