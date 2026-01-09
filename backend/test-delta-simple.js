
import https from 'https';
import crypto from 'crypto';


const apiKey = 'CCydtYXU37ytYArROs3lYJzGHo7tLB';
const apiSecret = 'KQv0DKbUyQosaaemeAJBW9r3DuQ1LcX92lVBatlDMHWMMcLx8mqYx31mMObZ';
// Add this temporarily to check
console.log("Using Key:", apiKey.substring(0, 4) + "...");
const method = 'GET';
const path = '/v2/wallet/balances';
const timestamp = Math.floor(Date.now() / 1000).toString();
const query = '';
const body = '';

const signaturePayload = method + timestamp + path + query + body;
const signature = crypto.createHmac('sha256', apiSecret).update(signaturePayload).digest('hex');

const options = {
  hostname: 'api.india.delta.exchange',
  path: path,
  method: method,
  headers: {
    'api-key': apiKey,
    'timestamp': timestamp,
    'signature': signature,
    'Content-Type': 'application/json',
    'User-Agent': 'Nodejs-Raw-Test'
  }
};

console.log('Connecting to Delta Exchange (ES Module)...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS! Connection Verified.');
      console.log(JSON.parse(data));
    } else {
      console.log(`❌ FAILED (Status: ${res.statusCode})`);
      console.log(data);
    }
  });
});

req.on('error', (e) => { console.error(`❌ Error: ${e.message}`); });
req.end();