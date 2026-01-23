#!/usr/bin/env node
/**
 * Comprehensive Google OAuth Configuration Tester
 * Run this to diagnose redirect_uri_mismatch errors
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('GOOGLE OAUTH CONFIGURATION DIAGNOSTIC TOOL');
console.log('='.repeat(70) + '\n');

// Read app.json
const appJsonPath = path.join(__dirname, 'app.json');
const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const owner = appConfig.expo.owner;
const slug = appConfig.expo.slug;
const scheme = appConfig.expo.scheme;

console.log('📱 APP CONFIGURATION');
console.log('-'.repeat(70));
console.log(`Owner: ${owner}`);
console.log(`Slug: ${slug}`);
console.log(`Scheme: ${scheme}`);
console.log(`Bundle ID (iOS): ${appConfig.expo.ios?.bundleIdentifier || 'Not set'}`);
console.log(`Package (Android): ${appConfig.expo.android?.package || 'Not set'}`);

// Calculate redirect URIs
const expoAuthRedirectUri = `https://auth.expo.io/@${owner}/${slug}`;
const customSchemeRedirectUri = `${scheme}://`;

console.log('\n📍 EXPECTED REDIRECT URIS');
console.log('-'.repeat(70));
console.log(`Expo Auth Proxy: ${expoAuthRedirectUri}`);
console.log(`Custom Scheme: ${customSchemeRedirectUri}`);

console.log('\n🔍 REDIRECT URI ANALYSIS');
console.log('-'.repeat(70));

// Check for common issues
const issues = [];
const warnings = [];

// Check case sensitivity
if (slug !== slug.toLowerCase()) {
  issues.push(`⚠️  Slug is not all lowercase: "${slug}"`);
  issues.push(`   Google might expect: "${slug.toLowerCase()}"`);
}

// Check owner format
if (!owner || owner.includes(' ')) {
  issues.push(`❌ Owner format invalid: "${owner}"`);
}

// Check for special characters
if (/[^a-z0-9-_]/i.test(slug)) {
  warnings.push(`⚠️  Slug contains special characters: "${slug}"`);
}

console.log('\n✅ GOOGLE CONSOLE CONFIGURATION REQUIRED');
console.log('-'.repeat(70));
console.log('\n1. Go to: https://console.cloud.google.com/apis/credentials');
console.log('\n2. Find your Web Application OAuth Client:');
console.log('   Client ID: 710894950429-qatr6ok68sfj1076befk4kc6ulor35do...');
console.log('\n3. Under "Authorized JavaScript origins", add EXACTLY:');
console.log('   ┌────────────────────────────────────┐');
console.log('   │ https://auth.expo.io               │');
console.log('   └────────────────────────────────────┘');
console.log('   ❌ NOT: http://auth.expo.io (wrong protocol)');
console.log('   ❌ NOT: https://auth.expo.io/ (trailing slash)');

console.log('\n4. Under "Authorized redirect URIs", add EXACTLY:');
console.log('   ┌────────────────────────────────────────────────────────────┐');
console.log(`   │ ${expoAuthRedirectUri.padEnd(58)} │`);
console.log('   └────────────────────────────────────────────────────────────┘');
console.log(`   ❌ NOT: ${expoAuthRedirectUri}/ (trailing slash)`);
console.log(`   ❌ NOT: ${expoAuthRedirectUri}/callback (extra path)`);
console.log(`   ❌ NOT: https://auth.expo.io/@${owner}/${slug.charAt(0).toUpperCase() + slug.slice(1)} (wrong case)`);

console.log('\n5. Click "SAVE" and WAIT 5-10 minutes for changes to propagate');

if (issues.length > 0) {
  console.log('\n❌ POTENTIAL ISSUES DETECTED');
  console.log('-'.repeat(70));
  issues.forEach(issue => console.log(issue));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS');
  console.log('-'.repeat(70));
  warnings.forEach(warning => console.log(warning));
}

console.log('\n🧪 TESTING CHECKLIST');
console.log('-'.repeat(70));
console.log('[ ] Google Console has the EXACT redirect URI shown above');
console.log('[ ] Saved changes and waited 5-10 minutes');
console.log('[ ] App is using correct Client ID: 710894950429-qatr6ok68sfj1076befk4kc6ulor35do...');
console.log('[ ] Test user email is added in OAuth Consent Screen (Testing mode)');
console.log('[ ] Cleared app cache: npx expo start -c');
console.log('[ ] Checked console logs for generated redirect URI');

console.log('\n🔧 TROUBLESHOOTING COMMANDS');
console.log('-'.repeat(70));
console.log('1. Clear cache and restart:');
console.log('   npx expo start -c');
console.log('\n2. Check Expo account:');
console.log('   npx expo whoami');
console.log(`   Should show: ${owner}`);
console.log('\n3. Verify configuration:');
console.log('   npx expo config --type public | grep "owner\\|slug"');

console.log('\n📝 WHAT TO SHARE IF STILL NOT WORKING');
console.log('-'.repeat(70));
console.log('1. Screenshot of Google Console OAuth client configuration');
console.log('   (showing both JavaScript origins AND redirect URIs)');
console.log('2. Console logs from app showing:');
console.log('   "Generated redirectUri: ..."');
console.log('3. The exact error message from Google');

console.log('\n💡 MOST COMMON CAUSES');
console.log('-'.repeat(70));
console.log('1. Redirect URI in Google Console has wrong case (e.g., Uptrender vs uptrender)');
console.log('2. Extra trailing slash in Google Console');
console.log('3. Changes in Google Console not yet propagated (wait 5-10 min)');
console.log('4. Editing wrong OAuth client (iOS/Android instead of Web)');
console.log('5. Wrong Expo owner in app.json');

console.log('\n' + '='.repeat(70));
console.log('Copy the redirect URI above and paste it EXACTLY into Google Console');
console.log('='.repeat(70) + '\n');
