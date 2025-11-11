import chalk from 'chalk';

const primaryHex = '#c4b5fd';
const secondaryHex = '#93c5fd';

export const brandPrimary = chalk.hex(primaryHex);
export const brandPrimaryBold = (value: string): string => chalk.hex(primaryHex).bold(value);
export const brandSecondaryBold = (value: string): string => chalk.hex(secondaryHex).bold(value);
