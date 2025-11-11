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

    // Just write the content normally - promptUser will handle bottom area positioning
    output.write(content);
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
    this.moveToSpinnerLine();
    this.spinner = ora({ text, stream: output }).start();
  }

  /**
   * Hide the current spinner
   */
  hideSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
      this.clearSpinnerLine();
    }
  }

  /**
   * Show success message in spinner area
   */
  showSuccess(text: string): void {
    if (!output.isTTY) {
      output.write(`✓ ${text}\n`);
      return;
    }

    this.hideSpinner();
    this.moveToSpinnerLine();
    output.write(`${chalk.green('✓')} ${text}`);
    this.clearToEndOfLine();
    setTimeout(() => {
      this.clearSpinnerLine();
      this.renderBottomArea();
    }, 1500);
  }

  /**
   * Show error message in spinner area
   */
  showError(text: string): void {
    if (!output.isTTY) {
      output.write(`✗ ${text}\n`);
      return;
    }

    this.hideSpinner();
    this.moveToSpinnerLine();
    output.write(`${chalk.red('✗')} ${text}`);
    this.clearToEndOfLine();
    setTimeout(() => {
      this.clearSpinnerLine();
      this.renderBottomArea();
    }, 2000);
  }

  /**
   * Prompt for user input using the fixed bottom area
   */
  async promptUser(options: { hint?: string } = {}): Promise<string | null> {
    if (!output.isTTY) {
      return this.promptUserNonInteractive(options);
    }

    this.hideSpinner();

    // Ensure bottom area is properly rendered before we start prompting
    this.renderBottomArea();

    const rl = readline.createInterface({
      input,
      output,
      terminal: true,
    });

    // Position at prompt line and set up readline
    this.moveToPromptLine();
    rl.setPrompt(this.promptPrefix);
    rl.prompt();

    // Handle hint vs help text
    if (options.hint) {
      this.moveToHelpLine();
      output.write(chalk.gray(options.hint));
      this.moveToPromptLine();
      readline.moveCursor(output, this.promptPrefix.length, 0);
    } else {
      // Make sure help text is still there after readline setup
      this.moveToHelpLine();
      output.write(chalk.gray(this.helpText));
      this.moveToPromptLine();
      readline.moveCursor(output, this.promptPrefix.length, 0);
    }

    const answer = await new Promise<string | null>((resolve) => {
      const finalize = (value: string | null): void => {
        rl.close();
        resolve(value);
      };

      rl.once('line', (line) => finalize(line));
      rl.once('SIGINT', () => finalize(null));
    });

    // Clear the prompt line and restore bottom area
    this.clearPromptLine();
    this.renderBottomArea();

    return answer;
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

    const terminalHeight = process.stdout.rows || 24;

    // Save current cursor position
    output.write('\x1b[s');

    // Force cursor to spinner line (3rd from bottom)
    readline.cursorTo(output, 0, terminalHeight - 3);
    this.clearLine();

    // Force cursor to prompt line (2nd from bottom)
    readline.cursorTo(output, 0, terminalHeight - 2);
    output.write(this.promptPrefix);
    this.clearToEndOfLine();

    // Force cursor to help line (bottom line)
    readline.cursorTo(output, 0, terminalHeight - 1);
    output.write(chalk.gray(this.helpText));
    this.clearToEndOfLine();

    // Position cursor back at prompt for user input
    readline.cursorTo(output, this.promptPrefix.length, terminalHeight - 2);
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
    this.moveToPromptLine();
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
