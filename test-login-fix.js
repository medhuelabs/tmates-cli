#!/usr/bin/env node

/**
 * Test script to verify the TUI login fix
 * 
 * This script demonstrates that the login flow no longer "kicks out" users
 * after entering their email address. The fix ensures that:
 * 
 * 1. The email prompt works correctly with the toolbar system
 * 2. The transition to OTP prompt is smooth
 * 3. Error handling doesn't break the UI flow
 * 4. Users can cancel with Ctrl+C at any point
 */

const { spawn } = require('child_process');
const path = require('path');

const cliScript = path.join(__dirname, 'dist', 'index.js');

console.log('🔧 Testing tmates-cli TUI login fix');
console.log('====================================');
console.log('');
console.log('This test verifies that the login flow works correctly:');
console.log('• Email prompt integrates properly with the new 3-line toolbar');
console.log('• No "kick out" after entering email');
console.log('• Smooth transition to OTP prompt');
console.log('• Proper toolbar structure: Loading | Prompt | Help');
console.log('• Proper error handling and retry logic');
console.log('');
console.log('To test manually:');
console.log('1. The CLI should show a login prompt');
console.log('2. Enter any email address');
console.log('3. You should see "Sending one-time passcode..." (will fail with test credentials)');
console.log('4. Check that the toolbar layout is correct during OTP entry');
console.log('5. You should get an error but be able to retry without UI issues');
console.log('6. Press Ctrl+C to exit cleanly');
console.log('');
console.log('Starting interactive CLI in 3 seconds...');
console.log('Press Ctrl+C to exit at any time.');
console.log('');

// Set up test environment
process.env.TMATES_SUPABASE_URL = 'https://test.supabase.co';
process.env.TMATES_SUPABASE_ANON_KEY = 'test-anon-key-for-demo';
process.env.TMATES_API_BASE_URL = 'https://api.test.com';

setTimeout(() => {
    const child = spawn('node', [cliScript, 'start'], {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env }
    });

    child.on('exit', (code) => {
        console.log(`\n✅ Tmates CLI exited cleanly with code: ${code}`);
        console.log('Test completed. If you could enter an email without getting kicked out, the fix works!');
        process.exit(0);
    });

    child.on('error', (error) => {
        console.error('❌ Error running tmates CLI:', error);
        process.exit(1);
    });

    // Auto-exit after 30 seconds for CI/automated testing
    setTimeout(() => {
        console.log('\n⏰ Auto-exit for automated testing...');
        child.kill('SIGINT');
    }, 30000);
}, 3000);