import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

/**
 * Fixed bottom toolbar that stays consistent across all screens
 */
export class FixedBottomToolbar {
  private spinner: Ora | null = null;
  private isActive = false;
  private loadingText: string | null = null;
  private readonly promptPrefix = '❯ ';
  private readonly helpText = '/quit to exit the Tmates CLI';

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

    // Write the content
    output.write(content);

    // Add spacing and preserve any loading indicator that should appear here
    output.write('\n');
  }

  /**
   * Show a loading spinner in the bottom area
   */
  showSpinner(text: string): void {
    if (!output.isTTY) {
      output.write(`${text}...\n`);
      return;
    }

    this.hideSpinner();
    // Start the actual animated spinner
    this.spinner = ora({
      text,
      stream: output,
      color: 'cyan',
    }).start();
    this.loadingText = text;
  }

  /**
   * Hide the current spinner
   */
  hideSpinner(): void {
    if (this.spinner && this.spinner.stop) {
      this.spinner.stop();
      this.spinner = null;
    }
    this.loadingText = null;
  }

  /**
   * Show success message in spinner area
   */
  showSuccess(text: string): void {
    if (!output.isTTY) {
      output.write(`${text}\n`);
      return;
    }

    this.hideSpinner();
    // Show success in loading area (above prompt)
    output.write(`${chalk.green(`✓ ${text}`)}\n`);
    setTimeout(() => {
      // Clear the success message after 2 seconds
      if (output.isTTY) {
        readline.moveCursor(output, 0, -1);
        readline.clearLine(output, 0);
      }
    }, 2000);
  }

  /**
   * Show error message in spinner area
   */
  showError(text: string): void {
    if (!output.isTTY) {
      output.write(`Error: ${text}\n`);
      return;
    }

    this.hideSpinner();
    // Show error in loading area (above prompt)
    output.write(`${chalk.red(`✗ ${text}`)}\n`);
    setTimeout(() => {
      // Clear the error message after 2 seconds
      if (output.isTTY) {
        readline.moveCursor(output, 0, -1);
        readline.clearLine(output, 0);
      }
    }, 2000);
  }

  /**
   * Get user input with the fixed bottom toolbar
   */
  async promptUser(): Promise<string> {
    if (!output.isTTY) {
      return await new Promise<string>((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question('Enter command: ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });
    }

    // Position 2: Show EITHER loading indicator OR help text (same line!)
    if (this.loadingText) {
      output.write(`${chalk.dim('⏳')} ${this.loadingText}...\n`);
    } else {
      output.write(`${chalk.dim('• quit: Exit the CLI')}\n`);
    }

    // Position 3: Create readline interface with the prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '❯ ',
    });

    return new Promise<string>((resolve) => {
      rl.prompt();

      rl.on('line', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Clean up the layout (call before app exit)
   */
  cleanup(): void {
    this.hideSpinner();
    if (this.isActive && output.isTTY) {
      // Move cursor below the fixed area
      this.moveToPromptLine();
      readline.moveCursor(output, 0, 2);
      output.write('\n');
    }
    this.isActive = false;
  }

  // Private methods for terminal manipulation

  private renderBottomArea(): void {
    if (!output.isTTY) return;

    // Position cursor at the beginning of current line
    readline.cursorTo(output, 0);

    // Render spinner line (empty for now)
    this.clearLine();
    output.write('\n');

    // Render prompt line - make it more visible for debugging
    readline.cursorTo(output, 0);
    output.write(this.promptPrefix);
    this.clearToEndOfLine();
    output.write('\n');

    // Render help line - make it more visible for debugging
    readline.cursorTo(output, 0);
    output.write(chalk.gray(this.helpText));
    this.clearToEndOfLine();

    // Position cursor back at prompt for user input (go up one line to prompt)
    readline.moveCursor(output, 0, -1);
    readline.cursorTo(output, this.promptPrefix.length);
  }

  private positionForBottomArea(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    const bottomAreaHeight = 3;

    // Move to the start of bottom area
    readline.cursorTo(output, 0, terminalHeight - bottomAreaHeight);
  }

  private moveToSpinnerLine(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    readline.cursorTo(output, 0, terminalHeight - 3);
  }

  private moveToPromptLine(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    readline.cursorTo(output, 0, terminalHeight - 2);
  }

  private moveToHelpLine(): void {
    if (!output.isTTY) return;

    const terminalHeight = process.stdout.rows || 24;
    readline.cursorTo(output, 0, terminalHeight - 1);
  }

  private clearLine(): void {
    readline.clearLine(output, 0);
  }

  private clearToEndOfLine(): void {
    readline.clearLine(output, 1);
  }

  private clearSpinnerLine(): void {
    this.moveToSpinnerLine();
    this.clearLine();
  }

  private clearPromptLine(): void {
    // Clear both prompt and help lines to avoid leftover text
    this.moveToPromptLine();
    this.clearLine();
    this.moveToHelpLine();
    this.clearLine();
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
