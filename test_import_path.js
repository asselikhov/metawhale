console.log('Testing import path...');

// Test the specific import that's failing
try {
  console.log('Testing import: ../../database/models from services/p2p/order/OrderService.js');
  const path = require('path');
  const modelsPath = path.resolve(__dirname, 'src/database/models.js');
  console.log('Resolved path:', modelsPath);
  
  const fs = require('fs');
  if (fs.existsSync(modelsPath)) {
    console.log('✅ File exists');
  } else {
    console.log('❌ File does not exist');
  }
  
  const models = require('./src/database/models.js');
  console.log('✅ Models imported successfully');
  console.log('Available models:', Object.keys(models));
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error('Require stack:', error.requireStack);
}