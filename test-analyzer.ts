import { AnalyzerAgent } from './src/agents/AnalyzerAgent';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const agent = new AnalyzerAgent();
  await agent.init();
  const result = await agent.queryAccount('0.0.123456');
  console.log('Result:', result);
}

test().catch(console.error);
