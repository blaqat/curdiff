import type { CodiffConfig, CodiffKeymap, CodiffSettings } from './types.ts';

export const defaultSettings: CodiffSettings = {
  askModel: 'composer-2.5',
  copyCommentsOnClose: false,
  lastRepositoryPath: '',
  showWhitespace: false,
  theme: 'system',
  walkthroughModel: 'composer-2.5',
};

export const defaultKeymap: CodiffKeymap = {
  closeSearch: 'Escape',
  commandBar: 'Mod+Shift+p',
  diffSearch: 'Mod+f',
  discardComment: 'Escape',
  fileFilter: 'Mod+p',
  nextSearchMatch: 'Enter',
  prevSearchMatch: 'Shift+Enter',
  submitComment: 'Mod+Enter',
  toggleSidebar: 'Mod+b',
};

export const defaultConfig: CodiffConfig = {
  keymap: defaultKeymap,
  settings: defaultSettings,
};
