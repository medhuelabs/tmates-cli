#!/usr/bin/env node

// Quick test of the toolbar structure
const { toolbar } = require('./dist/cli/layout');

async function testToolbar() {
    console.log('Testing toolbar structure...\n');

    toolbar.init();

    // Test 1: Basic content rendering
    console.log('1. Testing content rendering...');
    toolbar.renderContent('This is test content\n\nLine 2\nLine 3');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Loading spinner
    console.log('\n2. Testing loading spinner...');
    toolbar.showSpinner('Loading test data');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Success message
    console.log('\n3. Testing success message...');
    toolbar.hideSpinner();
    toolbar.showSuccess('Test completed successfully');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Error message
    console.log('\n4. Testing error message...');
    toolbar.showError('This is a test error');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Prompt (with auto-quit)
    console.log('\n5. Testing prompt...');
    toolbar.renderContent('Enter something (will auto-quit in 3 seconds):');

    setTimeout(() => {
        console.log('\n\nTest completed!');
        toolbar.cleanup();
        process.exit(0);
    }, 3000);

    try {
        const input = await toolbar.promptUser();
        console.log(`You entered: ${input}`);
    } catch (error) {
        console.log('Prompt cancelled or errored');
    }

    toolbar.cleanup();
}

testToolbar().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});