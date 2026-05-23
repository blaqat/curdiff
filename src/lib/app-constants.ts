import type { CodiffLaunchOptions, CodiffPreferences, TerminalHelperStatus } from '../types.ts';
import { cliCommand } from './branding.ts';

export const HISTORY_PAGE_SIZE = 30;

export const defaultLaunchOptions: CodiffLaunchOptions = {
  repositoryPathProvided: false,
  walkthrough: false,
};

export const defaultTerminalHelperStatus: TerminalHelperStatus = {
  command: cliCommand,
  installed: false,
  path: '',
};

export const defaultPreferences: CodiffPreferences = {
  askModel: 'composer-2.5',
  copyCommentsOnClose: false,
  lastRepositoryPath: '',
  showWhitespace: false,
  theme: 'system',
  walkthroughModel: 'composer-2.5',
};
