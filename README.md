# Presu

Presu ayuda a una persona con una idea de producto a convertirla en un alcance claro mediante una conversación de *grilling with docs* dentro de ChatGPT. El usuario puede guardar proyectos, volver a ellos, responder preguntas y adjuntar documentos para reducir ambigüedades.

Al terminar, Presu genera un PDF que presenta el alcance y una cotización comercial basada en ese alcance. El cliente no ingresa un monto máximo para que el sistema adapte el alcance: “presupuesto” se refiere al documento de propuesta/cotización generado. La evaluación de Presu indica si el proyecto está suficientemente definido y parece implementable; no afirma que exista demanda de mercado sin evidencia.

## Producto definido

- La persona que conversa con Presu es el cliente y tiene una cuenta de ChatGPT compatible con la experiencia.
- El proyecto, la conversación, los documentos y el alcance deben poder guardarse y retomarse.
- El modelo determina ambigüedades relevantes; cada ambigüedad debe explicar qué decisión o estimación podría cambiar.
- No se genera una cotización final mientras queden ambigüedades que bloqueen definir el alcance.
- Cada cuenta de Presu recibe cinco créditos gratuitos para cotizaciones; los diez usos gratuitos de *grilling with docs* se cuentan por separado.
- Los pagos adicionales se preparan para la web de Presu con BNB nativo (tBNB) en BSC Testnet. ChatGPT no inicia ni enlaza compras; el uso de créditos pagados desde el plugin requiere aprobación de OpenAI.
- Se toma [ScopeProfit](https://github.com/FranprzDev/ScopeProfit) como base funcional para el flujo de proyectos, documentos, alcance, estimaciones y PDF.

## Restricción de plataforma

Las reglas actuales de plugins de ChatGPT prohíben vender créditos digitales dentro del plugin, incluso mediante upsell freemium. ChatGPT no inicia ni enlaza compras. Hasta obtener aprobación para el uso de créditos pagados, el plugin no debe consumirlos ni promocionarlos; la compra BNB se desarrolla para la web de Presu. [Reglas de plugins de OpenAI](https://developers.openai.com/plugins/plugin-guidelines)

## Base del producto

La integración actual de ChatGPT para esta clase de experiencia se basa en un servidor MCP con herramientas del lado del servidor y una interfaz opcional. Para probar un servidor local desde ChatGPT, se puede exponer mediante ngrok y conectar la URL HTTPS terminada en `/mcp`; esto es para desarrollo, no un endpoint estable de producción. [Guía oficial de MCP para ChatGPT](https://developers.openai.com/plugins/build/app-quickstart)

El plan ejecutable está en [implementations.md](implementations.md). Los términos del dominio están en [GLOSSARY.md](GLOSSARY.md).
