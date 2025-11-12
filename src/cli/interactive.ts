import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import ora from 'ora';
import type { Session } from '@supabase/supabase-js';

import pkg from '../../package.json';
import { getActiveSession, refreshSession, sendOtp, verifyOtp } from '../auth/supabase-auth';
import { fetchPinboardPosts, PinboardPost, fetchPinboardPost } from '../api/pinboard';
import { AgentStoreEntry, fetchAgentStore, manageAgent } from '../api/teammates';
import {
  ChatMessage,
  ChatThreadSummary,
  ChatMessageAttachment,
  clearChatHistory,
  createChatThread,
  deleteChatThread,
  fetchChatThread,
  fetchChatThreads,
  sendChatMessage,
} from '../api/messages';
import { fetchFiles, FileListing } from '../api/files';
import { fetchUserProfile } from '../api/profile';
import { fetchMobileSettings } from '../api/settings';
import { formatApiError } from '../api/http-client';
import { promptForEmail, promptForOtp } from './prompts';
import { brandPrimary, brandPrimaryBold } from './theme';
import { toolbar } from './layout';

const debugEnabled = Boolean(
  process.env.DEBUG?.split(',').some((entry) => entry.trim() === 'tmates-cli'),
);

function debugLog(message: string): void {
  if (debugEnabled) {
    process.stderr.write(`[tmates-cli] ${message}\n`);
  }
}

function renderScreen(content: string, hint?: string, options?: { alignBottom?: boolean }): void {
  if (!output.isTTY && hint && hint.trim().length > 0) {
    const separator = content.endsWith('\n') ? '' : '\n';
    toolbar.renderContent(`${content}${separator}${chalk.gray(hint)}\n`, options);
    return;
  }

  toolbar.renderContent(content, options);
}

export async function launchInteractiveCli(): Promise<void> {
  // Initialize the fixed bottom toolbar
  toolbar.init();

  const session = await ensureInteractiveSession();
  if (!session) {
    toolbar.renderContent(
      `${chalk.yellow('Unable to continue without signing in.')} Run ${chalk.bold(
        'tmates login',
      )} to try again.\n`,
    );
    toolbar.cleanup();
    return;
  }

  const stack: ScreenState[] = [];
  let current: ScreenState = { type: 'home', session };
  let quit = false;

  while (!quit) {
    const action = await handleScreen(current);

    switch (action.type) {
      case 'push':
        stack.push(current);
        current = action.screen;
        break;
      case 'replace':
        current = action.screen;
        break;
      case 'stay':
        if (action.screen) {
          current = action.screen;
        }
        break;
      case 'back':
        current = stack.pop() ?? { type: 'home', session };
        break;
      case 'home':
        stack.length = 0;
        current = { type: 'home', session };
        break;
      case 'quit':
        quit = true;
        break;
      default: {
        const exhaustiveCheck: never = action;
        throw new Error(`Unhandled screen action: ${exhaustiveCheck}`);
      }
    }
  }

  toolbar.cleanup();
  output.write('Goodbye!\n');
}

type ScreenState =
  | { type: 'home'; session: Session }
  | { type: 'pinboard'; limit: number }
  | { type: 'pinboard-detail'; post: PinboardPost }
  | { type: 'teammates' }
  | { type: 'messages' }
  | {
      type: 'message-thread';
      threadId: string;
      title: string;
      messages?: ChatMessage[];
      totalMessages?: number;
      needsRefresh?: boolean;
    }
  | { type: 'files'; limit: number }
  | { type: 'settings' };

type ScreenAction =
  | { type: 'push'; screen: ScreenState }
  | { type: 'replace'; screen: ScreenState }
  | { type: 'stay'; screen?: ScreenState }
  | { type: 'back' }
  | { type: 'home' }
  | { type: 'quit' };

async function ensureInteractiveSession(): Promise<Session | null> {
  let session = getActiveSession();
  if (session) {
    return session;
  }

  try {
    session = await refreshSession();
    if (session) {
      return session;
    }
  } catch (error) {
    toolbar.renderContent(
      `${chalk.yellow('Failed to restore saved session automatically:')} ${describeError(error)}\n`,
    );
  }

  return runInlineLogin();
}

async function runInlineLogin(): Promise<Session | null> {
  toolbar.renderContent(
    `${chalk.yellow('No active session detected.')} Let's get you signed in.\n\nEnter your email address:\n`,
  );

  let emailInput = await toolbar.promptUser();
  if (emailInput === null) {
    return null;
  }

  const email = emailInput.trim();
  if (!email) {
    toolbar.renderContent(`${chalk.red('Email is required.')}\n\nEnter your email address:\n`);
    return await runInlineLogin();
  }

  toolbar.showSpinner('Sending one-time passcode...');
  try {
    await sendOtp(email);
    toolbar.clearSpinner();
    // Wait a moment to let any pending UI updates complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    toolbar.renderContent(
      `${chalk.green('✓ Passcode sent')} to ${chalk.bold(email)}.\n\nEnter the one-time passcode from your email:\n`,
    );
  } catch (error) {
    toolbar.showError('Failed to send passcode.');
    // Wait a moment to let the error message display
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toolbar.renderContent(
      `${chalk.red(describeError(error))}\n\nTry again. Enter your email address:\n`,
    );
    return await runInlineLogin();
  }

  let otpInput = await toolbar.promptUser();
  if (otpInput === null) {
    return null;
  }

  const otp = otpInput.trim();
  if (!otp) {
    toolbar.renderContent(
      `${chalk.red('Passcode is required.')}\n\nEnter the one-time passcode from your email:\n`,
    );
    return await runInlineLoginOtpStep(email);
  }

  toolbar.showSpinner('Verifying passcode...');
  try {
    const session = await verifyOtp(email, otp);
    toolbar.hideSpinner();
    await new Promise((resolve) => setTimeout(resolve, 100));
    toolbar.renderContent(
      `${chalk.green('✓ Login successful!')} Welcome, ${chalk.bold(session.user?.email ?? email)}!\n\n`,
    );
    return session;
  } catch (error) {
    toolbar.showError('Verification failed.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toolbar.renderContent(
      `${chalk.red(describeError(error))}\n\nTry again. Enter the one-time passcode from your email:\n`,
    );
    return await runInlineLoginOtpStep(email);
  }
}

async function runInlineLoginOtpStep(email: string): Promise<Session | null> {
  let otpInput = await toolbar.promptUser();
  if (otpInput === null) {
    return null;
  }

  const otp = otpInput.trim();
  if (!otp) {
    toolbar.renderContent(
      `${chalk.red('Passcode is required.')}\n\nEnter the one-time passcode from your email:\n`,
    );
    return await runInlineLoginOtpStep(email);
  }

  toolbar.showSpinner('Verifying passcode...');
  try {
    const session = await verifyOtp(email, otp);
    toolbar.clearSpinner();
    await new Promise((resolve) => setTimeout(resolve, 100));
    toolbar.renderContent(
      `${chalk.green('✓ Login successful!')} Welcome, ${chalk.bold(session.user?.email ?? email)}!\n\n`,
    );
    return session;
  } catch (error) {
    toolbar.showError('Verification failed.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toolbar.renderContent(
      `${chalk.red(describeError(error))}\n\nTry again. Enter the one-time passcode from your email:\n`,
    );
    return await runInlineLoginOtpStep(email);
  }
}

async function handleScreen(state: ScreenState): Promise<ScreenAction> {
  switch (state.type) {
    case 'home':
      return handleHome(state);
    case 'pinboard':
      return handlePinboard(state);
    case 'pinboard-detail':
      return handlePinboardDetail(state);
    case 'teammates':
      return handleTeammates(state);
    case 'messages':
      return handleMessages(state);
    case 'message-thread':
      return handleMessageThread(state);
    case 'files':
      return handleFiles(state);
    case 'settings':
      return handleSettings(state);
    default:
      return { type: 'quit' };
  }
}

async function handleHome(state: { type: 'home'; session: Session }): Promise<ScreenAction> {
  const menuItems: Array<{ key: string; label: string; summary: string }> = [
    { key: '1', label: 'Pinboard', summary: 'Latest highlights from your agents.' },
    { key: '2', label: 'Teammates', summary: 'Enable or disable agents for your organization.' },
    { key: '3', label: 'Messages', summary: 'Chat with your AI teammates.' },
    { key: '4', label: 'Files', summary: 'Review generated assets and downloads.' },
    { key: '5', label: 'Settings', summary: 'Profile and notification preferences.' },
  ];

  const email = state.session.user?.email ?? 'unknown user';

  const ascii = ['╭───╮ ', '│^‿^│ ', '╰───╯ '];

  const headerLines = [
    {
      content: `Welcome to Tmates! v${pkg.version}`,
      render: `${brandPrimaryBold('Welcome to Tmates!')} ${chalk.dim(`v${pkg.version}`)}`,
    },
    {
      content: `Signed in as ${email}`,
      render: `${chalk.gray('Signed in as ')}${chalk.bold(email)}`,
    },
    {
      content: 'Ready to collaborate!',
      render: chalk.dim('Ready to collaborate!'),
    },
  ];

  // Calculate widths for the combined layout
  const asciiWidth = Math.max(...ascii.map((line) => line.length));
  const textWidth = headerLines.reduce((max, line) => Math.max(max, line.content.length), 0);
  const totalWidth = asciiWidth + 1 + textWidth; // ascii + space + text

  // Build content for the scrollable area with ASCII art on the left
  let content = '\n';
  content += chalk.gray(`╭${'─'.repeat(totalWidth + 2)}╮`) + '\n';

  // First line: ASCII art top + Welcome back!
  const line1Padding = ' '.repeat(textWidth - headerLines[0].content.length);
  content += `${chalk.gray('│ ')}${brandPrimary(ascii[0])} ${headerLines[0].render}${line1Padding}${chalk.gray(' │')}\n`;

  // Second line: ASCII art middle + Signed in as...
  const line2Padding = ' '.repeat(textWidth - headerLines[1].content.length);
  content += `${chalk.gray('│ ')}${brandPrimary(ascii[1])} ${headerLines[1].render}${line2Padding}${chalk.gray(' │')}\n`;

  // Third line: ASCII art bottom + Ready to collaborate!
  const line3Padding = ' '.repeat(textWidth - headerLines[2].content.length);
  content += `${chalk.gray('│ ')}${brandPrimary(ascii[2])} ${headerLines[2].render}${line3Padding}${chalk.gray(' │')}\n`;
  content += chalk.gray(`╰${'─'.repeat(totalWidth + 2)}╯`) + '\n\n';
  content += `${brandPrimaryBold('Home')}\n`;
  menuItems.forEach((item) => {
    content += `${brandPrimary(item.key)} ${chalk.bold(item.label)} ${chalk.gray('\u2014 ' + item.summary)}\n`;
  });
  content += '\n';

  // Render content in the scrollable area
  toolbar.renderContent(content);

  const choiceRaw = await toolbar.promptUser();
  if (choiceRaw === null) {
    return { type: 'quit' };
  }
  const choice = choiceRaw.trim().toLowerCase();
  switch (choice) {
    case '1':
    case 'pinboard':
      return { type: 'push', screen: { type: 'pinboard', limit: 10 } };
    case '2':
    case 'teammates':
      return { type: 'push', screen: { type: 'teammates' } };
    case '3':
    case 'messages':
      return { type: 'push', screen: { type: 'messages' } };
    case '4':
    case 'files':
      return { type: 'push', screen: { type: 'files', limit: 25 } };
    case '5':
    case 'settings':
      return { type: 'push', screen: { type: 'settings' } };
    case '/quit':
    case '/exit':
      return { type: 'quit' };
    default:
      toolbar.showError('Unknown option.');
      renderScreen(content);
      return { type: 'stay' };
  }
}

async function handlePinboard(state: { type: 'pinboard'; limit: number }): Promise<ScreenAction> {
  const hint = '? [number]=open /refresh /back /home /quit';
  toolbar.setHelpText(hint);

  toolbar.showSpinner('Loading pinboard');
  try {
    const posts = await fetchPinboardPosts(state.limit);
    toolbar.clearSpinner();

    let content = '\n';
    if (!posts.length) {
      content += `${chalk.gray('No pinboard posts found.')}\n`;
    } else {
      content += brandPrimaryBold('Pinboard') + '\n';
      posts.forEach((post, index) => {
        const timestamp = post.created_at ? formatDateTime(post.created_at) : 'Unknown date';
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        content += `${itemNumber} ${chalk.bold(post.title)} ${chalk.gray(`(${timestamp})`)}${
          post.priority ? chalk.gray(` [${String(post.priority)}]`) : ''
        }\n`;
        if (post.excerpt) {
          content += `   ${chalk.gray(truncate(post.excerpt, 120))}\n`;
        }
      });
    }
    renderScreen(content, hint);
    const answerRaw = await toolbar.promptUser();
    if (answerRaw === null) {
      return { type: 'quit' };
    }
    const answer = answerRaw.trim().toLowerCase();

    if (isQuit(answer)) {
      return { type: 'quit' };
    }
    if (isHome(answer)) {
      return { type: 'home' };
    }
    if (isBack(answer)) {
      return { type: 'back' };
    }
    if (!answer || answer === '/refresh' || answer === '/r') {
      return { type: 'stay', screen: state };
    }
    const index = parseInt(answer, 10);
    if (Number.isNaN(index) || index < 1 || index > posts.length) {
      toolbar.showError(`Select a number between 1 and ${posts.length}.`);
      renderScreen(content, hint);
      return { type: 'stay', screen: state };
    }
    const post = posts[index - 1];

    toolbar.showSpinner('Loading post details');
    const detail = await fetchPinboardPost(post.slug);
    toolbar.clearSpinner();

    return { type: 'push', screen: { type: 'pinboard-detail', post: detail } };
  } catch (error) {
    toolbar.showError('Failed to load pinboard');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

async function handlePinboardDetail(state: {
  type: 'pinboard-detail';
  post: PinboardPost;
}): Promise<ScreenAction> {
  const post = state.post;
  const hint = '? /back /home /quit';
  toolbar.setHelpText(hint);

  try {
    let content = '\n' + chalk.bold(post.title) + '\n';
    if (post.author_display) {
      content += chalk.gray(`By ${post.author_display}`) + '\n';
    }
    if (post.created_at) {
      content += chalk.gray(formatDateTime(post.created_at)) + '\n';
    }
    content += '\n';
    const body = post.content_md ?? post.excerpt ?? '(no content)';
    content += body.trim() + '\n';
    if (post.attachments?.length) {
      content += '\nAttachments:\n';
      post.attachments.forEach((attachment, index) => {
        content += `  ${index + 1}. ${attachment.label ?? attachment.url} → ${attachment.url}\n`;
      });
    }
    if (post.sources?.length) {
      content += '\nSources:\n';
      post.sources.forEach((source, index) => {
        content += `  ${index + 1}. ${source.label ?? source.url} → ${source.url}\n`;
      });
    }

    renderScreen(content, hint);
    const answerRaw = await toolbar.promptUser();
    if (answerRaw === null) {
      return { type: 'quit' };
    }
    const answer = answerRaw.trim().toLowerCase();
    if (isQuit(answer)) {
      return { type: 'quit' };
    }
    if (isHome(answer)) {
      return { type: 'home' };
    }
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

async function handleTeammates(_state: { type: 'teammates' }): Promise<ScreenAction> {
  const hint = '? add <index|key> remove <index|key> /refresh /back /home /quit';
  toolbar.setHelpText(hint);

  toolbar.showSpinner('Loading teammates');
  try {
    const store = await fetchAgentStore();
    toolbar.clearSpinner();
    const agents = store.available_agents;

    let content = '\n' + brandPrimaryBold('Teammates') + '\n';
    if (!agents.length) {
      content += chalk.gray('No teammates available.\n');
    } else {
      agents.forEach((agent, index) => {
        const marker = `${brandPrimary(String(index + 1))}.`;
        const status = agent.hired ? brandPrimary('Enabled') : chalk.gray('Disabled');
        content += `${marker} ${chalk.bold(agent.name)} ${status}\n`;
        if (agent.description) {
          content += `   ${chalk.gray(agent.description)}\n`;
        }
        content += `   ${chalk.gray(`Key: ${agent.key}`)}\n`;
        content += '\n';
      });
    }

    renderScreen(content, hint);
    const answerRaw = await toolbar.promptUser();
    if (answerRaw === null) {
      return { type: 'quit' };
    }
    const answer = answerRaw.trim();
    const lowered = answer.toLowerCase();

    if (isQuit(lowered)) {
      return { type: 'quit' };
    }
    if (isHome(lowered)) {
      return { type: 'home' };
    }
    if (!answer || lowered === '/refresh' || lowered === '/r') {
      return { type: 'stay', screen: { type: 'teammates' } };
    }
    if (isBack(lowered)) {
      return { type: 'back' };
    }

    const [command, ...rest] = lowered.split(/\s+/);
    const targetRaw = rest.join(' ').trim();
    if (!['add', 'remove'].includes(command)) {
      toolbar.showError('Unknown command.');
      renderScreen(content, hint);
      return { type: 'stay', screen: { type: 'teammates' } };
    }

    const entry = resolveAgentTarget(targetRaw, store.available_agents);
    if (!entry) {
      toolbar.showError('No matching agent found.');
      renderScreen(content, hint);
      return { type: 'stay', screen: { type: 'teammates' } };
    }

    toolbar.showSpinner(`${command === 'add' ? 'Enabling' : 'Disabling'} ${entry.name}...`);
    try {
      const response = await manageAgent(entry.key, command === 'add' ? 'add' : 'remove');
      if (!response.success) {
        throw new Error(response.message || 'Request failed');
      }
      toolbar.showSuccess(`${entry.name} ${command === 'add' ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      toolbar.showError('Operation failed.');
      renderScreen(content, hint);
    }

    return { type: 'stay', screen: { type: 'teammates' } };
  } catch (error) {
    toolbar.showError('Failed to load teammates');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

function resolveAgentTarget(target: string, entries: AgentStoreEntry[]): AgentStoreEntry | null {
  if (!target) {
    return null;
  }
  const maybeIndex = parseInt(target, 10);
  if (!Number.isNaN(maybeIndex) && maybeIndex >= 1 && maybeIndex <= entries.length) {
    return entries[maybeIndex - 1];
  }
  const normalized = target.trim().toLowerCase();
  return entries.find((entry) => entry.key.toLowerCase() === normalized) ?? null;
}

async function handleMessages(_state: { type: 'messages' }): Promise<ScreenAction> {
  const hint =
    '? [number]=open new <agent_key> delete <number> clear <number> /refresh /back /home /quit';
  toolbar.setHelpText(hint);

  toolbar.showSpinner('Loading conversations');
  try {
    const threads = await fetchChatThreads();
    toolbar.clearSpinner(); // Clear spinner completely after loading
    debugLog(`Messages screen rendered ${threads.length} threads.`);

    let content = '';
    if (!threads.length) {
      content += `${chalk.gray('No conversations yet.')} Start one with "new <agent_key>".\n`;
    } else {
      content += '\n' + brandPrimaryBold('Messages') + '\n';
      threads.forEach((thread, index) => {
        const lastActivity = thread.last_activity
          ? formatDateTime(thread.last_activity)
          : 'Unknown';
        const lastMessage = thread.last_message_preview
          ? truncate(thread.last_message_preview, 80)
          : '—';
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        content += `${itemNumber} ${chalk.bold(thread.title || thread.agent_keys.join(', '))} ${chalk.gray(`(${lastActivity})`)}\n`;
        content += `   ${chalk.gray(lastMessage)}\n`;
      });
    }

    renderScreen(content, hint);
    debugLog('Prompting for user input on Messages screen.');
    const rawAnswer = await toolbar.promptUser();
    if (rawAnswer === null) {
      debugLog('Prompt cancelled (null response).');
      toolbar.clearSpinner(); // Clear spinner when leaving screen
      return { type: 'quit' };
    }

    const answer = rawAnswer.trim();
    const lowered = answer.toLowerCase();
    debugLog(`Messages input received: "${answer || '<empty>'}".`);

    // Clear spinner once user provides input
    toolbar.clearSpinner();

    if (isQuit(lowered)) {
      return { type: 'quit' };
    }
    if (isHome(lowered)) {
      return { type: 'home' };
    }
    if (!answer || lowered === '/refresh' || lowered === '/r') {
      return { type: 'stay', screen: { type: 'messages' } };
    }
    if (isBack(lowered)) {
      return { type: 'back' };
    }

    const [command, ...rest] = lowered.split(/\s+/);
    const restJoined = rest.join(' ').trim();
    if (Number.isInteger(Number(answer))) {
      const index = Number(answer);
      if (index < 1 || index > threads.length) {
        toolbar.showError('Invalid thread selection.');
        renderScreen(content, hint);
        return { type: 'stay', screen: { type: 'messages' } };
      }
      const thread = threads[index - 1];
      return {
        type: 'push',
        screen: {
          type: 'message-thread',
          threadId: thread.id,
          title: thread.title || thread.agent_keys.join(', '),
        },
      };
    }

    switch (command) {
      case 'new':
        if (!restJoined) {
          toolbar.showError('Specify an agent key, e.g. "new adam".');
          renderScreen(content, hint);
          return { type: 'stay', screen: { type: 'messages' } };
        }
        return await createNewThread(restJoined, hint);
      case 'delete':
      case 'clear':
        return await handleThreadMaintenance(command, restJoined, threads, hint, content);
      default:
        toolbar.showError('Unknown command.');
        renderScreen(content, hint);
        return { type: 'stay', screen: { type: 'messages' } };
    }
  } catch (error) {
    toolbar.showError('Failed to load conversations');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

async function createNewThread(agentKey: string, hint: string): Promise<ScreenAction> {
  toolbar.showSpinner(`Creating conversation with ${agentKey}...`);
  try {
    const thread = await createChatThread(agentKey);
    toolbar.showSuccess('Conversation created.');
    return {
      type: 'push',
      screen: { type: 'message-thread', threadId: thread.id, title: thread.title || agentKey },
    };
  } catch (error) {
    toolbar.showError('Failed to create conversation.');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'stay', screen: { type: 'messages' } };
  }
}

async function handleThreadMaintenance(
  command: string,
  target: string,
  threads: ChatThreadSummary[],
  hint: string,
  baseContent: string,
): Promise<ScreenAction> {
  if (!target) {
    toolbar.showError('Specify the thread number.');
    renderScreen(baseContent, hint);
    return { type: 'stay', screen: { type: 'messages' } };
  }
  const index = Number(target);
  if (!Number.isInteger(index) || index < 1 || index > threads.length) {
    toolbar.showError('Invalid thread number.');
    renderScreen(baseContent, hint);
    return { type: 'stay', screen: { type: 'messages' } };
  }
  const thread = threads[index - 1];
  toolbar.showSpinner(`${command === 'delete' ? 'Deleting' : 'Clearing'} conversation...`);
  try {
    if (command === 'delete') {
      await deleteChatThread(thread.id);
      toolbar.clearSpinner();
      toolbar.showSuccess('Conversation deleted.');
    } else {
      await clearChatHistory(thread.id);
      toolbar.clearSpinner();
      toolbar.showSuccess('Conversation history cleared.');
    }
  } catch (error) {
    toolbar.clearSpinner();
    toolbar.showError('Operation failed.');
    renderScreen(formatApiError(error) + '\n', hint);
  }
  return { type: 'stay', screen: { type: 'messages' } };
}

async function handleMessageThread(
  state: Extract<ScreenState, { type: 'message-thread' }>,
): Promise<ScreenAction> {
  let messages = state.messages ? [...state.messages] : [];
  let title = state.title;
  const seenKeys = new Set<string>();
  const maxHistory = 10;
  const hint = '? type message /refresh /back /home /quit';
  toolbar.setHelpText(hint);
  const finalize = (action: ScreenAction): ScreenAction => {
    toolbar.resetHelpText();
    return action;
  };

  const loadThread = async (label: string): Promise<void> => {
    toolbar.showSpinner(label);
    try {
      const thread = await fetchChatThread(state.threadId);
      messages = thread.messages.slice();
      title = thread.title || title;
      toolbar.clearSpinner();
    } catch (error) {
      toolbar.clearSpinner();
      toolbar.showError('Failed to load conversation.');
      renderScreen(formatApiError(error) + '\n', hint);
      throw error;
    }
  };

  if (!messages.length || state.needsRefresh) {
    try {
      await loadThread('Loading conversation');
    } catch {
      return finalize({ type: 'back' });
    }
  }

  const printMessage = (message: ChatMessage, index: number): string => {
    const key = getMessageKey(message, index);
    if (seenKeys.has(key)) {
      return '';
    }
    seenKeys.add(key);
    const author = message.author || message.role;
    const timestamp = message.created_at ? formatDateTime(message.created_at) : 'Unknown';
    const header = `${brandPrimaryBold(author)} ${chalk.gray(`(${timestamp})`)}:`;
    let content = `${header}\n${message.content.trim()}\n`;
    if (message.attachments?.length) {
      message.attachments.forEach((attachment: ChatMessageAttachment) => {
        content += `   📎 ${attachment.name ?? attachment.uri}\n`;
      });
    }
    content += '\n';
    return content;
  };

  const seedSeenKeys = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      seenKeys.add(getMessageKey(messages[i], i));
    }
  };

  const printMessagesStartingAt = (startIndex: number): string => {
    let content = '';
    for (let i = startIndex; i < messages.length; i += 1) {
      content += printMessage(messages[i], i);
    }
    return content;
  };

  const initialStart = Math.max(messages.length - maxHistory, 0);
  seedSeenKeys(initialStart);

  let content = '\n' + chalk.bold(title) + '\n';
  if (messages.length === 0) {
    content += chalk.gray('No messages yet. Start the conversation!\n');
  } else if (initialStart > 0) {
    content += chalk.gray(
      `Showing last ${messages.length - initialStart} of ${messages.length} messages.\n`,
    );
  }
  content += printMessagesStartingAt(initialStart);
  let conversationBuffer = content;
  renderScreen(conversationBuffer, hint, { alignBottom: true });

  const appendToConversation = (extra: string): void => {
    if (!extra || extra.trim().length === 0) {
      renderScreen(conversationBuffer, hint, { alignBottom: true });
      return;
    }
    conversationBuffer += extra;
    renderScreen(conversationBuffer, hint, { alignBottom: true });
  };

  const promptLine = async (): Promise<string | null> => toolbar.promptUser();

  let input = await promptLine();
  while (input !== null) {
    const trimmed = input.trim();
    const lowered = trimmed.toLowerCase();

    if (!trimmed) {
      input = await promptLine();
      continue;
    }

    if (isQuit(lowered)) {
      break;
    }

    if (isHome(lowered)) {
      state.messages = messages;
      state.totalMessages = messages.length;
      state.title = title;
      state.needsRefresh = false;
      return finalize({ type: 'home' });
    }

    if (isBack(lowered)) {
      state.messages = messages;
      state.totalMessages = messages.length;
      state.title = title;
      state.needsRefresh = false;
      return finalize({ type: 'back' });
    }

    if (lowered === '/refresh' || lowered === '/r') {
      const previousCount = messages.length;
      try {
        await loadThread('Refreshing conversation...');
        const newContent = printMessagesStartingAt(previousCount);
        if (!newContent.trim()) {
          toolbar.showSuccess('No new messages.');
          renderScreen(conversationBuffer, hint, { alignBottom: true });
        } else {
          appendToConversation(newContent);
        }
      } catch (error) {
        toolbar.showError('Failed to refresh conversation.');
        renderScreen(conversationBuffer, hint, { alignBottom: true });
      }
      input = await promptLine();
      continue;
    }

    toolbar.showSpinner('Sending message...');
    try {
      const sent = await sendChatMessage(state.threadId, { content: trimmed });
      toolbar.clearSpinner();
      toolbar.showSuccess('Message sent.');
      await new Promise((resolve) => setTimeout(resolve, 750));

      const offset = messages.length;
      messages.push(sent);
      const sentContent = printMessagesStartingAt(offset);
      appendToConversation(sentContent);

      toolbar.showSpinner('Waiting for replies');
      try {
        const baseline = messages.length;
        const newMessages = await pollForAgentReplies(state.threadId, baseline, 8, 1200);
        if (newMessages.length) {
          const offsetReplies = messages.length;
          messages.push(...newMessages);
          const repliesContent = printMessagesStartingAt(offsetReplies);
          appendToConversation(repliesContent);
        }
      } catch (error) {
        debugLog(`Failed to retrieve agent replies: ${describeError(error)}`);
      } finally {
        toolbar.clearSpinner();
      }
    } catch (error) {
      toolbar.clearSpinner();
      toolbar.showError('Failed to send message.');
      renderScreen(conversationBuffer, hint, { alignBottom: true });
      input = await promptLine();
      continue;
    }

    input = await promptLine();
    continue;
  }

  state.messages = messages;
  state.totalMessages = messages.length;
  state.title = title;
  state.needsRefresh = false;
  return finalize({ type: 'quit' });
}

async function handleFiles(state: { type: 'files'; limit: number }): Promise<ScreenAction> {
  const hint = '? /refresh /back /home /quit';
  toolbar.setHelpText(hint);

  toolbar.showSpinner('Loading files');
  try {
    const listing = await fetchFiles(state.limit);
    toolbar.clearSpinner();

    let content = '';
    if (!listing.files.length) {
      content += `${chalk.gray('No files found.')}\n`;
    } else {
      content += '\n' + brandPrimaryBold('Files') + '\n';
      listing.files.forEach((file, index) => {
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        content += `${itemNumber} ${chalk.bold(file.name)} ${chalk.gray(`(${file.modified_display}, ${file.size_display})`)}\n`;
      });
    }
    renderScreen(content, hint);
    const answerRaw = await toolbar.promptUser();
    if (answerRaw === null) {
      return { type: 'quit' };
    }
    const answer = answerRaw.trim().toLowerCase();

    if (isQuit(answer)) {
      return { type: 'quit' };
    }
    if (isHome(answer)) {
      return { type: 'home' };
    }
    if (isBack(answer)) {
      return { type: 'back' };
    }
    return { type: 'stay', screen: state };
  } catch (error) {
    toolbar.clearSpinner();
    toolbar.showError('Failed to load files.');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

async function handleSettings(_state: { type: 'settings' }): Promise<ScreenAction> {
  const hint = '? /back /home /quit';
  toolbar.setHelpText(hint);

  toolbar.showSpinner('Loading settings');
  try {
    const [profile, preferences] = await Promise.all([fetchUserProfile(), fetchMobileSettings()]);
    toolbar.clearSpinner();

    let content = '';
    content += '\n' + brandPrimaryBold('Profile') + '\n';
    content += `Name: ${profile.display_name ?? chalk.gray('Not set')}\n`;
    content += `Email: ${profile.email ?? chalk.gray('Unknown')}\n`;
    content += `Role: ${profile.role ?? chalk.gray('Unknown')}\n`;

    content += '\n' + brandPrimaryBold('Mobile Settings') + '\n';
    Object.entries(preferences).forEach(([key, value]) => {
      const label = key.replace(/_/g, ' ');
      content += `- ${label}: ${formatSettingValue(value)}\n`;
    });

    renderScreen(content, hint);
    const answerRaw = await toolbar.promptUser();
    if (answerRaw === null) {
      return { type: 'quit' };
    }
    const answer = answerRaw.trim().toLowerCase();
    if (isQuit(answer)) {
      return { type: 'quit' };
    }
    if (isHome(answer)) {
      return { type: 'home' };
    }
    return { type: 'back' };
  } catch (error) {
    toolbar.clearSpinner();
    toolbar.showError('Failed to load settings.');
    renderScreen(formatApiError(error) + '\n', hint);
    return { type: 'back' };
  } finally {
    toolbar.resetHelpText();
  }
}

function formatSettingValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? brandPrimary('Enabled') : chalk.gray('Disabled');
  }
  if (value === null || value === undefined) {
    return chalk.gray('Not set');
  }
  return String(value);
}

function formatDateTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + '…';
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isQuit(value: string): boolean {
  return ['/quit', '/exit'].includes(value);
}

function isBack(value: string): boolean {
  return ['/back'].includes(value);
}

function isHome(value: string): boolean {
  return ['/home'].includes(value);
}

async function pollForAgentReplies(
  threadId: string,
  currentCount: number,
  attempts: number,
  delayMs = 1500,
): Promise<ChatMessage[]> {
  let remaining = Math.max(attempts, 0);
  let messages: ChatMessage[] = [];
  while (remaining > 0) {
    remaining -= 1;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const thread = await fetchChatThread(threadId);
      if (thread.messages.length > currentCount) {
        messages = thread.messages.slice(currentCount);
        break;
      }
    } catch (error) {
      debugLog(`pollForAgentReplies failed: ${describeError(error)}`);
      break;
    }
  }
  return messages;
}

function getMessageKey(message: ChatMessage, fallbackIndex: number): string {
  if (message.id) {
    return message.id;
  }
  const created = message.created_at ?? 'unknown';
  const contentHash = message.content ? message.content.slice(0, 30) : 'content';
  return `${created}:${fallbackIndex}:${contentHash}`;
}
