import type { XmcpConfig } from 'xmcp';

const config: XmcpConfig = {
  http: true,
  stdio: false,
  paths: { prompts: false, resources: false },
};

export default config;
