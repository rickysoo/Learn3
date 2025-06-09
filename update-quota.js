import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current Pacific time date
function getPacificDate() {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.toISOString().split('T')[0];
}

const today = getPacificDate();
const quotaFilePath = path.join(__dirname, 'quotaUsage.json');

// Create exhausted quota data
const quotaData = {
  [today]: {
    "0": { searchCalls: 100, detailCalls: 0, totalUnits: 10000 },
    "1": { searchCalls: 100, detailCalls: 0, totalUnits: 10000 },
    "2": { searchCalls: 100, detailCalls: 0, totalUnits: 10000 },
    "3": { searchCalls: 100, detailCalls: 0, totalUnits: 10000 }
  }
};

try {
  fs.writeFileSync(quotaFilePath, JSON.stringify(quotaData, null, 2));
  console.log(`✓ Updated quota file for ${today} - all 4 API keys marked as exhausted (40,000/40,000 units used)`);
  console.log('✓ Quota will reset at midnight Pacific time');
} catch (error) {
  console.error('Error updating quota file:', error);
}