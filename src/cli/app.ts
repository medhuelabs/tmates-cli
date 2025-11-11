import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import pkg from '../../package.json';
import { resolveAppConfig } from '../config/app-config';
import { promptForEmail, promptForOtp } from './prompts';
import { launchInteractiveCli } from './interactive';
import { getAccessToken, refreshSession, sendOtp, signOut, verifyOtp } from '../auth/supabase-auth';
import { brandPrimary, brandSecondaryBold } from './theme';

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('tmates')
    .description('Tmates command line interface')
    .version(pkg.version, '-v, --version', 'Display version number');

  program
    .command('login')
    .description('Authenticate with Supabase OTP')
    .option('-e, --email <email>', 'Email address used for Tmates login')
    .option('--otp <code>', 'One-time passcode received via email')
    .option('--no-cache', 'Do not persist the Supabase session on disk for this login')
    .action(async (options: { email?: string; otp?: string; cache?: boolean }) => {
      if (options.cache === false) {
        process.env.TMATES_CLI_DISABLE_SESSION_CACHE = '1';
      }

      await resolveAppConfig();
      const email = await promptForEmail(options.email);

      const sendingSpinner = ora('Sending one-time passcode...').start();
      try {
        await sendOtp(email);
        sendingSpinner.succeed('Passcode sent. Check your email.');
      } catch (error) {
        sendingSpinner.fail('Failed to send passcode.');
        throw error;
      }

      const otp = await promptForOtp(options.otp);
      const verifyingSpinner = ora('Verifying passcode...').start();
      try {
        const session = await verifyOtp(email, otp);
        verifyingSpinner.succeed('Login successful.');
        process.stdout.write(`Authenticated as ${brandSecondaryBold(session.user?.email ?? email)}\n`);
      } catch (error) {
        verifyingSpinner.fail('Verification failed.');
        throw error;
      }
    });

  program
    .command('logout')
    .description('Clear the stored session and sign out of Supabase')
    .action(async () => {
      const spinner = ora('Signing out...').start();
      try {
        await signOut();
        spinner.succeed('Signed out successfully.');
      } catch (error) {
        spinner.fail('Failed to sign out.');
        throw error;
      }
    });

  program
    .command('status')
    .description('Show authentication status and configuration summary')
    .action(async () => {
      const config = await resolveAppConfig();
      const session = await refreshSession();
      const token = getAccessToken();
      const userEmail = session?.user?.email ?? 'Not authenticated';

      const rows: [string, string][] = [
        ['Supabase URL', config.supabaseUrl || chalk.red('Not set')],
        ['API Base URL', config.apiBaseUrl || chalk.red('Not set')],
        ['Session', session ? brandPrimary('Active') : chalk.yellow('Missing')],
        ['User', session ? brandSecondaryBold(userEmail) : chalk.gray('—')],
        ['Token cached', process.env.TMATES_CLI_DISABLE_SESSION_CACHE === '1' ? 'No' : token ? 'Yes' : 'No'],
      ];

      const labelWidth = Math.max(...rows.map(([label]) => label.length));
      process.stdout.write('\n');
      for (const [label, value] of rows) {
        process.stdout.write(`${label.padEnd(labelWidth)}  ${value}\n`);
      }
      process.stdout.write('\n');
    });

  program
    .command('start')
    .description('Launch the interactive Tmates CLI experience')
    .action(async () => {
      await launchInteractiveCli();
    });

  program.action(async () => {
    await launchInteractiveCli();
  });

  program.parse(argv, { from: 'user' });
}
