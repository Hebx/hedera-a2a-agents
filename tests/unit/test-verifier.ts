import { VerifierAgent } from './src/agents/VerifierAgent';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const agent = new VerifierAgent();
  await agent.init();
  console.log('Listening... (press Ctrl+C to exit)');
  await new Promise(() => {}); // Keep alive
}

test().catch(console.error);
