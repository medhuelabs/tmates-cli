import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

/**
 * Fixed bottom toolbar with structured 3-line layout:
 * Line 1: Loading spinner / Status messages
 * Line 2: User prompt and cursor 
 * Line 3: Help/Hint text
 */
export class FixedBottomToolbar {
  private spinner: Ora | NodeJS.Timeout | null = null;
  private isActive = false;
  private loadingText: string | null = null;
  private readonly promptPrefix = '> ';
  private readonly helpText = '? /quit /back /home';

  /**
   * Initialize the fixed bottom area (call once at app start)
   */
  init(): void {
    if (!output.isTTY) {
      return; // Skip layout management in non-interactive mode
    }
    this.isActive = true;

    // Just clear screen and mark as initialized
    // Don't render bottom area yet - let the first promptUser() call handle it
    output.write('\x1b[2J\x1b[H');
  }

  /**
   * Clear content area and render fresh content
   */
  renderContent(content: string): void {
    if (!output.isTTY) {
      output.write(content);
      return;
    }

    // Clear entire screen and position at top
    output.write('\x1b[2J\x1b[H');

    // Write the content, but leave space for the 3-line toolbar at bottom
    const terminalHeight = process.stdout.rows || 24;
    const contentHeight = terminalHeight - 4; // Leave 3 lines for toolbar + 1 buffer

    // Split content into lines and limit to available height
    const contentLines = content.split('\n');
    const displayLines = contentLines.slice(0, contentHeight);

    output.write(displayLines.join('\n'));

    // Add some padding before toolbar
    output.write('\n');
  }

  /**
   * Show a loading spinner in the top area of toolbar
   */
  showSpinner(text: string): void {
    if (!output.isTTY) {
      output.write(`${text}...\n`);
      return;
    }

    this.hideSpinner();
    this.loadingText = text;

    // Start animated spinner that updates the toolbar
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;

    this.spinner = setInterval(() => {
      const terminalHeight = process.stdout.rows || 24;

      // Save cursor position
      output.write('\x1b[s');

      // Update spinner line at bottom of screen
      output.write(`\x1b[${terminalHeight - 2}H\x1b[2K`);
      output.write(`${chalk.cyan(spinnerFrames[frameIndex % spinnerFrames.length])} ${text}...`);

      // Restore cursor position
      output.write('\x1b[u');

      frameIndex++;
    }, 80);
  }

  /**
   * Hide the current spinner but keep loading text for toolbar display
   */
  hideSpinner(): void {
    if (this.spinner) {
      if (typeof this.spinner === 'object' && 'stop' in this.spinner) {
        // Ora spinner
        this.spinner.stop();
      } else {
        // Timeout interval
        clearInterval(this.spinner);
      }
      this.spinner = null;
    }
    // DON'T clear loadingText - keep it for toolbar display
    // Only clear when explicitly setting a new state
  }

  /**
   * Clear loading state completely
   */
  clearSpinner(): void {
    this.hideSpinner();
    this.loadingText = null;
  }

  /**
   * Show success message in spinner area (Line 1 of toolbar)
   */
  showSuccess(text: string): void {
    if (!output.isTTY) {
      output.write(`${text}\n`);
      return;
    }

    this.hideSpinner();

    // Just write the success message and let it flow naturally
    output.write(`${chalk.green(`✓ ${text}`)}\n`);

    setTimeout(() => {
      // Clear the success message after 2 seconds by moving up and clearing
      if (output.isTTY) {
        readline.moveCursor(output, 0, -1);
        this.clearLine();
        output.write('\n');
      }
    }, 2000);
  }

  /**
   * Show error message in spinner area (Line 1 of toolbar)
   */
  showError(text: string): void {
    if (!output.isTTY) {
      output.write(`Error: ${text}\n`);
      return;
    }

    this.hideSpinner();

    // Just write the error message and let it flow naturally
    output.write(`${chalk.red(`✗ ${text}`)}\n`);

    setTimeout(() => {
      // Clear the error message after 2 seconds by moving up and clearing
      if (output.isTTY) {
        readline.moveCursor(output, 0, -1);
        this.clearLine();
        output.write('\n');
      }
    }, 2000);
  }

  /**
   * Get user input with the fixed bottom toolbar
   */
  async promptUser(): Promise<string | null> {
    if (!output.isTTY) {
      return await new Promise<string | null>((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question('Enter command: ', (answer) => {
          rl.close();
          resolve(answer);
        });
        rl.on('SIGINT', () => {
          rl.close();
          resolve(null);
        });
      });
    }

    // Use proper terminal control like Claude Code/Copilot CLI
    const terminalHeight = process.stdout.rows || 24;

    // Save current cursor position
    output.write('\x1b[s');

    // Go to bottom of screen and write toolbar from bottom up
    output.write(`\x1b[${terminalHeight}H`); // Go to last line

    // Line 3 (bottom): Help text
    output.write(`\x1b[2K${chalk.dim(this.helpText)}`); // Clear line and write help

    // Line 2 (middle): Prompt area
    output.write(`\x1b[${terminalHeight - 1}H\x1b[2K${this.promptPrefix}`);

    // Line 1 (top): Spinner area - always show something
    output.write(`\x1b[${terminalHeight - 2}H\x1b[2K`);
    if (this.loadingText) {
      output.write(`${chalk.cyan('⠋')} ${this.loadingText}...`);
    } else {
      output.write(`${chalk.green('✓')} Ready`);
    }

    // Position cursor at prompt line for input
    output.write(`\x1b[${terminalHeight - 1}H\x1b[${this.promptPrefix.length + 1}G`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Set up custom input handling to preserve help text
    let inputBuffer = '';

    const refreshDisplay = () => {
      // Redraw the entire toolbar to ensure help text stays visible

      // Line 3 (bottom): Help text - always redraw this
      output.write(`\x1b[${terminalHeight}H\x1b[2K${chalk.dim(this.helpText)}`);

      // Line 2 (middle): Prompt area with current input
      output.write(`\x1b[${terminalHeight - 1}H\x1b[2K${this.promptPrefix}${inputBuffer}`);

      // Line 1 (top): Spinner area
      output.write(`\x1b[${terminalHeight - 2}H\x1b[2K`);
      if (this.loadingText) {
        output.write(`${chalk.cyan('⠋')} ${this.loadingText}...`);
      } else {
        output.write(`${chalk.green('✓')} Ready`);
      }

      // Position cursor at end of input
      output.write(`\x1b[${terminalHeight - 1}H\x1b[${this.promptPrefix.length + inputBuffer.length + 1}G`);
    };

    return new Promise<string | null>((resolve) => {
      // Check if we can use raw mode (only works in true interactive TTY)
      const canUseRawMode = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';

      if (canUseRawMode) {
        // Handle raw keypresses to maintain control over display
        process.stdin.setRawMode(true);

        const handleKeypress = (chunk: Buffer) => {
          const key = chunk.toString();
          const keyCode = chunk[0];

          if (keyCode === 3) { // Ctrl+C
            process.stdin.setRawMode(false);
            output.write(`\x1b[${terminalHeight + 1}H`);
            rl.close();
            resolve(null);
            return;
          }

          if (keyCode === 13) { // Enter
            process.stdin.setRawMode(false);
            output.write(`\x1b[${terminalHeight + 1}H`);
            rl.close();
            resolve(inputBuffer.trim());
            return;
          }

          if (keyCode === 127) { // Backspace
            if (inputBuffer.length > 0) {
              inputBuffer = inputBuffer.slice(0, -1);
              refreshDisplay();
            }
            return;
          }

          // Regular character input
          if (keyCode >= 32 && keyCode < 127) {
            inputBuffer += key;
            refreshDisplay();
          }
        };

        process.stdin.on('data', handleKeypress);

        // Initial display
        refreshDisplay();

        // Cleanup function
        const cleanup = () => {
          process.stdin.removeListener('data', handleKeypress);
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
          }
        };

        // Handle cleanup on various exit conditions
        rl.on('close', cleanup);
        process.on('SIGINT', () => {
          cleanup();
          resolve(null);
        });
      } else {
        // Fallback to standard readline for non-interactive environments
        rl.on('line', (answer) => {
          output.write(`\x1b[${terminalHeight + 1}H`);
          rl.close();
          resolve(answer.trim());
        });

        rl.on('SIGINT', () => {
          output.write(`\x1b[${terminalHeight + 1}H`);
          rl.close();
          resolve(null);
        });
      }
    });
  }  /**
   * Position cursor to bottom area of terminal
   */
  private positionToBottom(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    const toolbarHeight = 3;

    // Move to the start of the toolbar area (3 lines from bottom)
    readline.cursorTo(output, 0, terminalHeight - toolbarHeight);
  }

  /**
   * Render the fixed 3-line toolbar structure in correct order:
   * Line 1: Loading/Status (TOP)
   * Line 2: Prompt (MIDDLE) 
   * Line 3: Help/Hints (BOTTOM)
   */
  private renderFixedToolbar(): void {
    if (!output.isTTY) return;

    // Write in the order they should appear on screen:

    // TOP LINE: Loading/Status area 
    if (this.loadingText) {
      output.write(`${chalk.cyan('⠋')} ${this.loadingText}...\n`);
    } else {
      output.write('\n'); // Empty line when no loading
    }

    // MIDDLE LINE: Prompt area (readline will fill this)
    // Don't write anything here - let readline handle it

    // BOTTOM LINE: Help/Hint area  
    output.write(`${chalk.dim(this.helpText)}\n`);
  }  /**
   * Move cursor to the prompt line (line 2 of toolbar)
   */
  private moveToPromptLine(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    readline.cursorTo(output, 0, terminalHeight - 2);
  }

  /**
   * Clean up the layout (call before app exit)
   */
  cleanup(): void {
    this.hideSpinner();
    if (this.isActive && output.isTTY) {
      // Move cursor below the toolbar area
      output.write('\n');
    }
    this.isActive = false;
  }

  // Private methods for terminal manipulation

  private clearLine(): void {
    readline.clearLine(output, 0);
  }

  private async promptUserNonInteractive(options: { hint?: string } = {}): Promise<string | null> {
    const rl = readline.createInterface({
      input,
      output,
      terminal: false,
    });

    if (options.hint) {
      output.write(`${chalk.gray(options.hint)}\n`);
    }

    output.write(this.promptPrefix);

    const answer = await new Promise<string | null>((resolve) => {
      const finalize = (value: string | null): void => {
        rl.close();
        resolve(value);
      };

      rl.once('line', (line) => finalize(line));
      rl.once('SIGINT', () => finalize(null));
    });

    return answer;
  }
}

// Global instance
export const toolbar = new FixedBottomToolbar();
