#!/usr/bin/env node

// Test script to verify spinner appears during loading
const { spawn } = require('child_process');
const path = require('path');

async function testSpinner() {
    console.log('Testing spinner visibility during Messages loading...');

    const child = spawn('node', [path.join(__dirname, 'dist', 'index.js'), 'interactive'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env,
            TMATES_API_ENDPOINT: 'https://api.tmates.ai',
        }
    });

    let output = '';
    let spinnerSeen = false;

    child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Check if we see the spinner
        if (text.includes('⠋') || text.includes('Loading')) {
            console.log('✅ SPINNER DETECTED!');
            spinnerSeen = true;
        }

        console.log(text);
    });

    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    // Navigate to Messages after initial load
    setTimeout(() => {
        console.log('\n--- Navigating to Messages (option 3) ---');
        child.stdin.write('3\n');
    }, 2000);

    // Quit after Messages loads
    setTimeout(() => {
        console.log('\n--- Sending quit ---');
        child.stdin.write('quit\n');
    }, 4000);

    child.on('close', (code) => {
        console.log(`\nTest completed with exit code: ${code}`);
        console.log(`Spinner visible: ${spinnerSeen ? '✅ YES' : '❌ NO'}`);
    });
}

testSpinner().catch(console.error);