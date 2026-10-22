# Presu

Presu ayuda a una persona con una idea de producto a convertirla en un alcance claro mediante una conversación de *grilling with docs* dentro de ChatGPT. El usuario puede guardar proyectos, volver a ellos, responder preguntas y adjuntar documentos para reducir ambigüedades.

Al terminar, Presu genera un PDF que presenta el alcance y una cotización comercial basada en ese alcance. El cliente no ingresa un monto máximo para que el sistema adapte el alcance: “presupuesto” se refiere al documento de propuesta/cotización generado. La evaluación de Presu indica si el proyecto está suficientemente definido y parece implementable; no afirma que exista demanda de mercado sin evidencia.

## Producto definido

- La persona que conversa con Presu es el cliente y tiene una cuenta de ChatGPT compatible con la experiencia.
- El proyecto, la conversación, los documentos y el alcance deben poder guardarse y retomarse.
- El modelo determina ambigüedades relevantes; cada ambigüedad debe explicar qué decisión o estimación podría cambiar.
- No se genera una cotización final mientras queden ambigüedades que bloqueen definir el alcance.
- BNB Chain forma parte de la primera versión, sujeto a resolver el modelo de monetización y las reglas de ChatGPT.
- La propuesta de uso es cinco créditos gratuitos para generar cotizaciones y diez usos gratuitos de *grilling with docs*; los créditos de cotización y los usos de grilling son contadores separados.
- Se toma [ScopeProfit](https://github.com/FranprzDev/ScopeProfit) como base funcional para el flujo de proyectos, documentos, alcance, estimaciones y PDF.

## Restricción de plataforma por resolver

Las reglas actuales de plugins de ChatGPT permiten comercio de bienes físicos, pero no vender productos o servicios digitales, incluidas suscripciones y créditos, ni siquiera mediante una oferta freemium. El plugin puede explicar que una función requiere otro nivel de acceso, pero no iniciar ni enlazar un checkout. Por eso, el esquema “cinco gratis y cobrar desde el sexto” no puede implementarse dentro del plugin sin resolver antes esta restricción. [Reglas de plugins de OpenAI](https://developers.openai.com/plugins/plugin-guidelines)

## Base del producto

La integración actual de ChatGPT para esta clase de experiencia se basa en un servidor MCP con herramientas del lado del servidor y una interfaz opcional. Para probar un servidor local desde ChatGPT, se puede exponer mediante ngrok y conectar la URL HTTPS terminada en `/mcp`; esto es para desarrollo, no un endpoint estable de producción. [Guía oficial de MCP para ChatGPT](https://developers.openai.com/plugins/build/app-quickstart)

El plan ejecutable está en [implementations.md](implementations.md). Los términos del dominio están en [GLOSSARY.md](GLOSSARY.md).
