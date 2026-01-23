#!/usr/bin/env node
/**
 * Script to check what redirect URI expo-auth-session will generate
 */

const appConfig = require('./app.json');

const owner = appConfig.expo.owner;
const slug = appConfig.expo.slug;

console.log('='.repeat(60));
console.log('EXPO AUTH REDIRECT URI CHECK');
console.log('='.repeat(60));
console.log('\nApp Configuration:');
console.log('  Owner:', owner);
console.log('  Slug:', slug);
console.log('\nExpected Redirect URI:');
console.log('  https://auth.expo.io/@' + owner + '/' + slug);
console.log('\n' + '='.repeat(60));
console.log('GOOGLE CONSOLE CONFIGURATION REQUIRED:');
console.log('='.repeat(60));
console.log('\n1. Authorized JavaScript origins:');
console.log('   https://auth.expo.io');
console.log('\n2. Authorized redirect URIs:');
console.log('   https://auth.expo.io/@' + owner + '/' + slug);
console.log('\n⚠️  IMPORTANT: URIs are case-sensitive!');
console.log('   - Make sure the slug matches exactly: "' + slug + '"');
console.log('   - NO trailing slash');
console.log('   - NO /callback at the end');
console.log('\n' + '='.repeat(60));
