# Presu

Presu ayuda a una persona con una idea de producto a convertirla en un alcance claro mediante una conversación de *grilling with docs* dentro de ChatGPT. El usuario puede guardar proyectos, volver a ellos, responder preguntas y adjuntar documentos para reducir ambigüedades.

Al terminar, Presu genera un PDF que presenta el alcance y una cotización comercial basada en ese alcance. El cliente no ingresa un monto máximo para que el sistema adapte el alcance: “presupuesto” se refiere al documento de propuesta/cotización generado. La evaluación de Presu indica si el proyecto está suficientemente definido y parece implementable; no afirma que exista demanda de mercado sin evidencia.

## Producto definido
- La persona que conversa con Presu es el cliente y tiene una cuenta de ChatGPT compatible con la experiencia.
- El proyecto, la conversación, los documentos y el alcance deben poder guardarse y retomarse.
- El modelo determina ambigüedades relevantes; cada ambigüedad debe explicar qué decisión o estimación podría cambiar.
- No se genera una cotización final mientras queden ambigüedades que bloqueen definir el alcance.
- Cada cuenta de Presu recibe cinco créditos gratuitos para cotizaciones; los diez usos gratuitos de *grilling with docs* se cuentan por separado.
- Los pagos adicionales se hacen desde la web/API de Presu con BNB nativo (tBNB) en BSC Testnet. ChatGPT no inicia ni enlaza compras ni consume créditos pagados; esto requiere aprobación de OpenAI.
- Se toma [ScopeProfit](https://github.com/FranprzDev/ScopeProfit) como base funcional para el flujo de proyectos, documentos, alcance, estimaciones y PDF.

## Desarrollo local

Requiere Node.js 22+, pnpm y PostgreSQL. Copiá `.env.example` a `.env`, configurá una base local y un secreto Better Auth aleatorio, y luego ejecutá:

```sh
pnpm install
pnpm migrate
pnpm dev
```

El endpoint MCP es `/mcp`. Better Auth ofrece registro e inicio de sesión por email y contraseña y OAuth para clientes MCP. Las herramientas guardan proyectos, mensajes y versiones de alcance; `issue_quote` bloquea alcances con preguntas pendientes y emite un PDF. ChatGPT solo consume los cinco créditos gratuitos.

Para el API web de créditos y pagos, configurá `BNB_TESTNET_RPC_URL`, `BNB_RECEIVER_ADDRESS`, `BNB_CREDIT_PRICE_WEI` y `BNB_MIN_CONFIRMATIONS`, y ejecutá `pnpm dev:payments`. El servicio expone `POST /api/payments/wallet/challenge`, `POST /api/payments/wallet/verify`, `POST /api/payments/intents`, `POST /api/payments/intents/:id/verify`, `GET /api/payments/credits` y `POST /api/quotes/issue`. En desarrollo, el API permite credenciales del origen exacto en `BETTER_AUTH_BASE_URL`; enviá `credentials: 'include'` desde el navegador. En producción, serví MCP y API detrás del mismo origen HTTPS. El API crea importes en backend, comprueba que el RPC sea chain ID 97, valida transferencia nativa y acredita un crédito tras las confirmaciones configuradas. No configures mainnet ni fondos reales.

Validá los cambios con `pnpm typecheck`, `pnpm test` y `pnpm build`.

## Restricción de plataforma

Las reglas actuales de plugins de ChatGPT prohíben vender créditos digitales dentro del plugin, incluso mediante upsell freemium. ChatGPT no inicia ni enlaza compras. Hasta obtener aprobación para el uso de créditos pagados, el plugin no debe consumirlos ni promocionarlos; la compra BNB se desarrolla para la web de Presu. [Reglas de plugins de OpenAI](https://developers.openai.com/plugins/plugin-guidelines)

## Base del producto

La integración actual de ChatGPT para esta clase de experiencia se basa en un servidor MCP con herramientas del lado del servidor y una interfaz opcional. Para probar un servidor local desde ChatGPT, se puede exponer mediante ngrok y conectar la URL HTTPS terminada en `/mcp`; esto es para desarrollo, no un endpoint estable de producción. [Guía oficial de MCP para ChatGPT](https://developers.openai.com/plugins/build/app-quickstart)

El plan ejecutable está en [implementations.md](implementations.md). Los términos del dominio están en [GLOSSARY.md](GLOSSARY.md).
