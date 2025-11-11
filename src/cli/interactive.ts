import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';
import ora from 'ora';
import type { Session } from '@supabase/supabase-js';
import Table from 'cli-table3';

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

const debugEnabled = Boolean(process.env.DEBUG?.split(',').some((entry) => entry.trim() === 'tmates-cli'));

function debugLog(message: string): void {
  if (debugEnabled) {
    process.stderr.write(`[tmates-cli] ${message}\n`);
  }
}

export async function launchInteractiveCli(): Promise<void> {
  const session = await ensureInteractiveSession();
  if (!session) {
    output.write(
      `${chalk.yellow('Unable to continue without signing in.')} Run ${chalk.bold(
        'tmates login',
      )} to try again.\n`,
    );
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
      default:
        {
          const exhaustiveCheck: never = action;
          throw new Error(`Unhandled screen action: ${exhaustiveCheck}`);
        }
    }
  }

  output.write('\nGoodbye!\n');
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
    output.write(`${chalk.yellow('Failed to restore saved session automatically:')} ${describeError(error)}\n`);
  }

  return runInlineLogin();
}

async function runInlineLogin(): Promise<Session | null> {
  output.write(`${chalk.yellow('No active session detected.')} Let\u2019s get you signed in.\n`);

  let email: string;
  try {
    email = await promptForEmail();
  } catch (error) {
    output.write(`${chalk.red(describeError(error))}\n`);
    return null;
  }

  const sendingSpinner = ora('Sending one-time passcode...').start();
  try {
    await sendOtp(email);
    sendingSpinner.succeed('Passcode sent. Check your email.');
  } catch (error) {
    sendingSpinner.fail('Failed to send passcode.');
    output.write(`${chalk.red(describeError(error))}\n`);
    return null;
  }

  let otp: string;
  try {
    otp = await promptForOtp();
  } catch (error) {
    output.write(`${chalk.red(describeError(error))}\n`);
    return null;
  }

  const verifyingSpinner = ora('Verifying passcode...').start();
  try {
    const session = await verifyOtp(email, otp);
    verifyingSpinner.succeed('Login successful.');
    output.write(`Welcome, ${chalk.bold(session.user?.email ?? email)}!\n`);
    return session;
  } catch (error) {
    verifyingSpinner.fail('Verification failed.');
    output.write(`${chalk.red(describeError(error))}\n`);
    return null;
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

  const headerLines = [
    {
      content: 'Welcome back!',
      render: chalk.bold('Welcome back!'),
    },
    {
      content: `Signed in as ${email}`,
      render: `${chalk.gray('Signed in as ')}${chalk.bold(email)}`,
    },
  ];
  const headerWidth = headerLines.reduce((max, line) => Math.max(max, line.content.length), 0);

  output.write('\n');
  output.write(chalk.gray(`┌${'─'.repeat(headerWidth + 2)}┐`) + '\n');
  headerLines.forEach((line) => {
    const padding = ' '.repeat(headerWidth - line.content.length);
    output.write(`${chalk.gray('│ ')}${line.render}${padding}${chalk.gray(' │')}\n`);
  });
  output.write(chalk.gray(`└${'─'.repeat(headerWidth + 2)}┘`) + '\n\n');
  output.write(`${brandPrimaryBold('Home')}\n`);
  menuItems.forEach((item) => {
    output.write(`${brandPrimary(item.key)} ${chalk.bold(item.label)} ${chalk.gray('\u2014 ' + item.summary)}\n`);
  });
  output.write('\n');

  const choiceRaw = await promptUser('', {
    hint: '/quit to exit the Tmates CLI',
  });
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
    case 'quit':
    case '/quit':
    case 'exit':
    case '/exit':
      return { type: 'quit' };
    default:
      output.write(`${chalk.yellow('Unknown option.')} Try again.\n`);
      return { type: 'stay' };
  }
}

async function handlePinboard(state: { type: 'pinboard'; limit: number }): Promise<ScreenAction> {
  const spinner = ora('Loading pinboard...').start();
  try {
    const posts = await fetchPinboardPosts(state.limit);
    spinner.stop();

    if (!posts.length) {
      output.write(`${chalk.gray('No pinboard posts found.')}` + '\n');
    } else {
      output.write('\n' + brandPrimaryBold('Pinboard') + '\n');
      posts.forEach((post, index) => {
        const timestamp = post.created_at ? formatDateTime(post.created_at) : 'Unknown date';
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        output.write(
          `${itemNumber} ${chalk.bold(post.title)} ${chalk.gray(`(${timestamp})`)}${
            post.priority ? chalk.gray(` [${String(post.priority)}]`) : ''
          }\n`,
        );
        if (post.excerpt) {
          output.write(`   ${chalk.gray(truncate(post.excerpt, 120))}\n`);
        }
      });
    }

    output.write('\nCommands: [number] to open, "refresh", "back", "home", "/quit"\n');
    const answerRaw = await promptUser('Pinboard');
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
    if (!answer || answer === 'refresh' || answer === 'r') {
      return { type: 'stay', screen: state };
    }
    const index = parseInt(answer, 10);
    if (Number.isNaN(index) || index < 1 || index > posts.length) {
      output.write(`${chalk.yellow('Select a number between 1 and ' + posts.length)}\n`);
      return { type: 'stay', screen: state };
    }
    const post = posts[index - 1];
    const detail = await fetchPinboardPost(post.slug);
    return { type: 'push', screen: { type: 'pinboard-detail', post: detail } };
  } catch (error) {
    spinner.fail('Failed to load pinboard.');
    output.write(formatApiError(error) + '\n');
    return { type: 'back' };
  }
}

async function handlePinboardDetail(state: { type: 'pinboard-detail'; post: PinboardPost }): Promise<ScreenAction> {
  const post = state.post;
  output.write('\n' + chalk.bold(post.title) + '\n');
  if (post.author_display) {
    output.write(chalk.gray(`By ${post.author_display}`) + '\n');
  }
  if (post.created_at) {
    output.write(chalk.gray(formatDateTime(post.created_at)) + '\n');
  }
  output.write('\n');
  const body = post.content_md ?? post.excerpt ?? '(no content)';
  output.write(body.trim() + '\n');
  if (post.attachments?.length) {
    output.write('\nAttachments:\n');
    post.attachments.forEach((attachment, index) => {
      output.write(`  ${index + 1}. ${attachment.label ?? attachment.url} → ${attachment.url}\n`);
    });
  }
  if (post.sources?.length) {
    output.write('\nSources:\n');
    post.sources.forEach((source, index) => {
      output.write(`  ${index + 1}. ${source.label ?? source.url} → ${source.url}\n`);
    });
  }

  output.write('\nCommands: "back", "home", "/quit"\n');
  const answerRaw = await promptUser('Pinboard ▸ Detail');
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
}

async function handleTeammates(_state: { type: 'teammates' }): Promise<ScreenAction> {
  const spinner = ora('Loading teammates...').start();
  try {
    const store = await fetchAgentStore();
    spinner.stop();
    const storeMap = new Map(store.available_agents.map((entry) => [entry.key, entry] as const));

    output.write('\n' + brandPrimaryBold('Teammates') + '\n');
    const table = new Table({
      head: [chalk.bold('#'), chalk.bold('Agent'), chalk.bold('Status')],
      colWidths: [4, 30, 40],
      wordWrap: true,
    });

    const sorted = store.available_agents;
    sorted.forEach((agent, index) => {
      const hired = agent.hired;
      const status = hired ? brandPrimary('Enabled') : chalk.gray('Disabled');
      table.push([
        index + 1,
        `${agent.name}${agent.description ? `\n${chalk.gray(agent.description)}` : ''}`,
        status,
      ]);
    });

    output.write(table.toString() + '\n');
    output.write(
      'Commands: "add <number|key>", "remove <number|key>", "refresh", "back", "home", "/quit"\n',
    );
    const answerRaw = await promptUser('Teammates');
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
    if (!answer || lowered === 'refresh' || lowered === 'r') {
      return { type: 'stay', screen: { type: 'teammates' } };
    }
    if (isBack(lowered)) {
      return { type: 'back' };
    }

    const [command, ...rest] = lowered.split(/\s+/);
    const targetRaw = rest.join(' ').trim();
    if (!['add', 'remove'].includes(command)) {
      output.write(chalk.yellow('Unknown command.') + '\n');
      return { type: 'stay', screen: { type: 'teammates' } };
    }

    const entry = resolveAgentTarget(targetRaw, store.available_agents);
    if (!entry) {
      output.write(chalk.yellow('No matching agent found.') + '\n');
      return { type: 'stay', screen: { type: 'teammates' } };
    }

    const spinnerAction = ora(`${command === 'add' ? 'Enabling' : 'Disabling'} ${entry.name}...`).start();
    try {
      const response = await manageAgent(entry.key, command === 'add' ? 'add' : 'remove');
      if (!response.success) {
        throw new Error(response.message || 'Request failed');
      }
      spinnerAction.succeed(`${entry.name} ${command === 'add' ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      spinnerAction.fail('Operation failed.');
      output.write(formatApiError(error) + '\n');
    }

    return { type: 'stay', screen: { type: 'teammates' } };
  } catch (error) {
    spinner.fail('Failed to load teammates.');
    output.write(formatApiError(error) + '\n');
    return { type: 'back' };
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
  const spinner = ora('Loading conversations...').start();
  try {
    const threads = await fetchChatThreads();
    spinner.stop();
    debugLog(`Messages screen rendered ${threads.length} threads.`);

    if (!threads.length) {
      output.write(`${chalk.gray('No conversations yet.')} Start one with "new <agent_key>".\n`);
    } else {
      output.write('\n' + brandPrimaryBold('Messages') + '\n');
      threads.forEach((thread, index) => {
        const lastActivity = thread.last_activity ? formatDateTime(thread.last_activity) : 'Unknown';
        const lastMessage = thread.last_message_preview ? truncate(thread.last_message_preview, 80) : '—';
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        output.write(
          `${itemNumber} ${chalk.bold(thread.title || thread.agent_keys.join(', '))} ${chalk.gray(`(${lastActivity})`)}\n`,
        );
        output.write(`   ${chalk.gray(lastMessage)}\n`);
      });
    }

    output.write(
      'Commands: [number] to open, "new <agent_key>", "delete <number>", "clear <number>", "refresh", "back", "home", "/quit"\n',
    );
    debugLog('Prompting for user input on Messages screen.');
    const rawAnswer = await promptUser('Messages');
    if (rawAnswer === null) {
      debugLog('Prompt cancelled (null response).');
      return { type: 'quit' };
    }

    const answer = rawAnswer.trim();
    const lowered = answer.toLowerCase();
    debugLog(`Messages input received: "${answer || '<empty>'}".`);

    if (isQuit(lowered)) {
      return { type: 'quit' };
    }
    if (isHome(lowered)) {
      return { type: 'home' };
    }
    if (!answer || lowered === 'refresh' || lowered === 'r') {
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
        output.write(chalk.yellow('Invalid thread selection.') + '\n');
        return { type: 'stay', screen: { type: 'messages' } };
      }
      const thread = threads[index - 1];
      return { type: 'push', screen: { type: 'message-thread', threadId: thread.id, title: thread.title || thread.agent_keys.join(', ') } };
    }

    switch (command) {
      case 'new':
        if (!restJoined) {
          output.write(chalk.yellow('Specify an agent key, e.g. "new adam".') + '\n');
          return { type: 'stay', screen: { type: 'messages' } };
        }
        return await createNewThread(restJoined);
      case 'delete':
      case 'clear':
        return await handleThreadMaintenance(command, restJoined, threads);
      default:
        output.write(chalk.yellow('Unknown command.') + '\n');
        return { type: 'stay', screen: { type: 'messages' } };
    }
  } catch (error) {
    spinner.fail('Failed to load conversations.');
    output.write(formatApiError(error) + '\n');
    return { type: 'back' };
  }
}

async function createNewThread(agentKey: string): Promise<ScreenAction> {
  const spinner = ora(`Creating conversation with ${agentKey}...`).start();
  try {
    const thread = await createChatThread(agentKey);
    spinner.succeed('Conversation created.');
    return {
      type: 'push',
      screen: { type: 'message-thread', threadId: thread.id, title: thread.title || agentKey },
    };
  } catch (error) {
    spinner.fail('Failed to create conversation.');
    output.write(formatApiError(error) + '\n');
    return { type: 'stay', screen: { type: 'messages' } };
  }
}

async function handleThreadMaintenance(
  command: string,
  target: string,
  threads: ChatThreadSummary[],
): Promise<ScreenAction> {
  if (!target) {
    output.write(chalk.yellow('Specify the thread number.'));
    return { type: 'stay', screen: { type: 'messages' } };
  }
  const index = Number(target);
  if (!Number.isInteger(index) || index < 1 || index > threads.length) {
    output.write(chalk.yellow('Invalid thread number.') + '\n');
    return { type: 'stay', screen: { type: 'messages' } };
  }
  const thread = threads[index - 1];
  const spinner = ora(`${command === 'delete' ? 'Deleting' : 'Clearing'} conversation...`).start();
  try {
    if (command === 'delete') {
      await deleteChatThread(thread.id);
      spinner.succeed('Conversation deleted.');
    } else {
      await clearChatHistory(thread.id);
      spinner.succeed('Conversation history cleared.');
    }
  } catch (error) {
    spinner.fail('Operation failed.');
    output.write(formatApiError(error) + '\n');
  }
  return { type: 'stay', screen: { type: 'messages' } };
}

async function handleMessageThread(state: Extract<ScreenState, { type: 'message-thread' }>): Promise<ScreenAction> {
  let messages = state.messages ? [...state.messages] : [];
  let title = state.title;
  const seenKeys = new Set<string>();
  const maxHistory = 10;

  const loadThread = async (label: string): Promise<void> => {
    const spinner = ora({ text: label }).start();
    try {
      const thread = await fetchChatThread(state.threadId);
      messages = thread.messages.slice();
      title = thread.title || title;
    } catch (error) {
      spinner.fail('Failed to load conversation.');
      output.write(formatApiError(error) + '\n');
      throw error;
    } finally {
      spinner.stop();
    }
  };

  if (!messages.length || state.needsRefresh) {
    try {
      await loadThread('Loading conversation...');
    } catch {
      return { type: 'back' };
    }
  }

  const printMessage = (message: ChatMessage, index: number): boolean => {
    const key = getMessageKey(message, index);
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    const author = message.author || message.role;
    const timestamp = message.created_at ? formatDateTime(message.created_at) : 'Unknown';
    const header = `${brandPrimaryBold(author)} ${chalk.gray(`(${timestamp})`)}:`;
    output.write(`${header}\n${message.content.trim()}\n`);
    if (message.attachments?.length) {
      message.attachments.forEach((attachment: ChatMessageAttachment) => {
        output.write(`   📎 ${attachment.name ?? attachment.uri}\n`);
      });
    }
    output.write('\n');
    return true;
  };

  const seedSeenKeys = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      seenKeys.add(getMessageKey(messages[i], i));
    }
  };

  const printMessagesStartingAt = (startIndex: number): boolean => {
    let printed = false;
    for (let i = startIndex; i < messages.length; i += 1) {
      printed = printMessage(messages[i], i) || printed;
    }
    return printed;
  };

  const initialStart = Math.max(messages.length - maxHistory, 0);
  seedSeenKeys(initialStart);

  output.write('\n' + chalk.bold(title) + '\n');
  if (messages.length === 0) {
    output.write(chalk.gray('No messages yet. Start the conversation!\n'));
  } else if (initialStart > 0) {
    output.write(
      chalk.gray(`Showing last ${messages.length - initialStart} of ${messages.length} messages.\n`),
    );
  }
  printMessagesStartingAt(initialStart);
  output.write(
    `${chalk.gray('Commands: type a message, or use /refresh, /back, /home, /quit.')}\n`,
  );

  const promptLine = async (): Promise<string | null> => promptUser('Message');

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
      return { type: 'home' };
    }

    if (isBack(lowered)) {
      state.messages = messages;
      state.totalMessages = messages.length;
      state.title = title;
      state.needsRefresh = false;
      return { type: 'back' };
    }

    if (lowered === '/refresh' || lowered === 'refresh' || lowered === 'r') {
      const previousCount = messages.length;
      try {
        await loadThread('Refreshing conversation...');
        if (!printMessagesStartingAt(previousCount)) {
          output.write(chalk.gray('No new messages.\n'));
        }
      } catch (error) {
        output.write(formatApiError(error) + '\n');
      }
      input = await promptLine();
      continue;
    }

    const spinner = ora('Sending message...').start();
    try {
      const sent = await sendChatMessage(state.threadId, { content: trimmed });
      spinner.succeed('Message sent.');
      const offset = messages.length;
      messages.push(sent);
      printMessagesStartingAt(offset);

      const baseline = messages.length;
      const newMessages = await pollForAgentReplies(state.threadId, baseline, 8, 1200);
      if (newMessages.length) {
        const offsetReplies = messages.length;
        messages.push(...newMessages);
        printMessagesStartingAt(offsetReplies);
      }
    } catch (error) {
      spinner.fail('Failed to send message.');
      output.write(formatApiError(error) + '\n');
    }

    input = await promptLine();
  }

  state.messages = messages;
  state.totalMessages = messages.length;
  state.title = title;
  state.needsRefresh = false;
  return { type: 'quit' };
}

async function handleFiles(state: { type: 'files'; limit: number }): Promise<ScreenAction> {
  const spinner = ora('Loading files...').start();
  try {
    const listing = await fetchFiles(state.limit);
    spinner.stop();
    if (!listing.files.length) {
      output.write(`${chalk.gray('No files found.')}\n`);
    } else {
      output.write('\n' + brandPrimaryBold('Files') + '\n');
      listing.files.forEach((file, index) => {
        const itemNumber = `${brandPrimary(String(index + 1))}.`;
        output.write(
          `${itemNumber} ${chalk.bold(file.name)} ${chalk.gray(`(${file.modified_display}, ${file.size_display})`)}\n`,
        );
      });
    }
    output.write('Commands: "refresh", "back", "home", "/quit"\n');
    const answerRaw = await promptUser('Files');
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
    spinner.fail('Failed to load files.');
    output.write(formatApiError(error) + '\n');
    return { type: 'back' };
  }
}

async function handleSettings(_state: { type: 'settings' }): Promise<ScreenAction> {
  const spinner = ora('Loading settings...').start();
  try {
    const [profile, preferences] = await Promise.all([fetchUserProfile(), fetchMobileSettings()]);
    spinner.stop();

    output.write('\n' + brandPrimaryBold('Profile') + '\n');
    output.write(`Name: ${profile.display_name ?? chalk.gray('Not set')}\n`);
    output.write(`Email: ${profile.email ?? chalk.gray('Unknown')}\n`);
    output.write(`Role: ${profile.role ?? chalk.gray('Unknown')}\n`);

    output.write('\n' + brandPrimaryBold('Mobile Settings') + '\n');
    Object.entries(preferences).forEach(([key, value]) => {
      const label = key.replace(/_/g, ' ');
      output.write(`- ${label}: ${formatSettingValue(value)}\n`);
    });

    output.write('\nCommands: "back", "home", "/quit"\n');
    const answerRaw = await promptUser('Settings');
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
    spinner.fail('Failed to load settings.');
    output.write(formatApiError(error) + '\n');
    return { type: 'back' };
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

async function promptUser(label: string, options: { hint?: string } = {}): Promise<string | null> {
  const rl = readline.createInterface({
    input,
    output,
    terminal: true,
  });

  const promptPrefix = '❯ ';
  const rawLabel = label?.trim() ?? '';
  const hasLabel = rawLabel.length > 0;
  const hintText = options.hint ? chalk.gray(options.hint) : '';
  const isInteractive = output.isTTY !== false;

  if (hasLabel) {
    output.write(`${chalk.bold(rawLabel)}\n`);
  }

  const renderHint = (): void => {
    if (!isInteractive) {
      return;
    }
    const currentColumn = promptPrefix.length + rl.line.length;
    readline.moveCursor(output, 0, 1);
    readline.cursorTo(output, 0);
    readline.clearLine(output, 0);
    if (hintText) {
      output.write(hintText);
    }
    readline.moveCursor(output, 0, -1);
    readline.cursorTo(output, currentColumn);
  };

  const rlInternal = rl as unknown as { _refreshLine?: (...args: unknown[]) => void };
  const originalRefresh =
    isInteractive && typeof rlInternal._refreshLine === 'function'
      ? rlInternal._refreshLine.bind(rl)
      : undefined;

  if (originalRefresh) {
    rlInternal._refreshLine = (...args: unknown[]) => {
      originalRefresh(...args);
      renderHint();
    };
  }

  rl.setPrompt(promptPrefix);
  rl.prompt();

  if (isInteractive) {
    renderHint();
  } else {
    output.write(`${hintText}\n`);
  }

  const answer = await new Promise<string | null>((resolve) => {
    const finalize = (value: string | null): void => {
      if (originalRefresh) {
        rlInternal._refreshLine = originalRefresh;
      }
      rl.close();
      resolve(value);
    };

    rl.once('line', (line) => finalize(line));
    rl.once('SIGINT', () => finalize(null));
  });

  if (isInteractive) {
    readline.moveCursor(output, 0, 1);
    readline.cursorTo(output, 0);
    readline.clearLine(output, 0);
    readline.moveCursor(output, 0, -1);
    readline.cursorTo(output, 0);
    readline.clearLine(output, 0);
  }
  output.write('\n');

  return answer;
}
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isQuit(value: string): boolean {
  return ['quit', '/quit', 'exit', '/exit'].includes(value);
}

function isBack(value: string): boolean {
  return ['b', 'back', '/back'].includes(value);
}

function isHome(value: string): boolean {
  return ['h', 'home', '/home'].includes(value);
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
