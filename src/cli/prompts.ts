import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

export async function promptForEmail(initial?: string): Promise<string> {
  if (initial && initial.trim()) {
    return initial.trim();
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('Email: ');
    const trimmed = answer.trim();
    if (!trimmed) {
      throw new Error('Email is required.');
    }
    return trimmed;
  } finally {
    rl.close();
  }
}

export async function promptForOtp(initial?: string): Promise<string> {
  if (initial && initial.trim()) {
    return initial.trim();
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('One-time passcode: ');
    const trimmed = answer.trim();
    if (!trimmed) {
      throw new Error('Passcode is required.');
    }
    return trimmed;
  } finally {
    rl.close();
  }
}
