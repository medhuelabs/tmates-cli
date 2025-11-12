#!/usr/bin/env node

// Test script to verify toolbar structure during login
const { spawn } = require('child_process');
const path = require('path');

async function testLogin() {
    console.log('Testing login flow with 3-line toolbar...');

    const child = spawn('node', [path.join(__dirname, 'dist', 'index.js'), 'interactive'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env,
            TMATES_API_ENDPOINT: 'https://api.tmates.ai',
            TMATES_AUTH_TOKEN: '', // Empty to trigger login
        }
    });

    let output = '';

    child.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    // Send email after initial prompt
    setTimeout(() => {
        console.log('\n--- Sending test email ---');
        child.stdin.write('test@example.com\n');
    }, 2000);

    // Send quit after OTP prompt
    setTimeout(() => {
        console.log('\n--- Sending quit ---');
        child.stdin.write('\x03'); // SIGINT to quit
    }, 5000);

    child.on('close', (code) => {
        console.log(`\nTest completed with exit code: ${code}`);
        console.log('\n=== FULL OUTPUT ===');
        console.log(output);
    });
}

testLogin().catch(console.error);