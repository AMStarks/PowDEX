const http = require('http');

console.log('🔍 Checking PowDEX Services...\n');

// Check Backend API
const checkBackend = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    }, (res) => {
      resolve({
        service: 'Backend API',
        status: res.statusCode === 200 ? '✅ Running' : '⚠️  Responding (Status: ' + res.statusCode + ')',
        url: 'http://localhost:5000'
      });
    });

    req.on('error', () => {
      resolve({
        service: 'Backend API',
        status: '❌ Not Running',
        url: 'http://localhost:5000'
      });
    });

    req.end();
  });
};

// Check Frontend
const checkFrontend = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    }, (res) => {
      resolve({
        service: 'Frontend (React)',
        status: res.statusCode === 200 ? '✅ Running' : '⚠️  Responding (Status: ' + res.statusCode + ')',
        url: 'http://localhost:3000'
      });
    });

    req.on('error', () => {
      resolve({
        service: 'Frontend (React)',
        status: '❌ Not Running',
        url: 'http://localhost:3000'
      });
    });

    req.end();
  });
};

async function checkAllServices() {
  const backend = await checkBackend();
  const frontend = await checkFrontend();

  console.log('📊 Service Status:');
  console.log('==================');
  console.log(`${backend.service}: ${backend.status}`);
  console.log(`   URL: ${backend.url}`);
  console.log('');
  console.log(`${frontend.service}: ${frontend.status}`);
  console.log(`   URL: ${frontend.url}`);
  console.log('');
  console.log('🚀 PowDEX is ready!');
  console.log('   • Open http://localhost:3000 in your browser');
  console.log('   • Connect your Zeroa wallet to start trading');
  console.log('   • API documentation available at http://localhost:5000/api/health');
}

checkAllServices(); 