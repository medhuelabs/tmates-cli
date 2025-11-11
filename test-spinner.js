const { FixedBottomToolbar } = require('./dist/cli/layout');

const toolbar = new FixedBottomToolbar();
toolbar.init();

// Show some content first
toolbar.renderContent('Test Content\nLine 2\nLine 3');

console.log('About to show spinner...');

// Show spinner for 3 seconds
toolbar.showSpinner('Loading test data...');

setTimeout(() => {
  toolbar.hideSpinner();
  console.log('Spinner should be hidden now');
  process.exit(0);
}, 3000);
