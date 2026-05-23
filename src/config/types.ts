import type { ModelParameterValue } from '../types.ts';

export type CodiffTheme = 'system' | 'light' | 'dark';

export type CodiffSettings = {
  askModel: string;
  askModelParams?: Array<ModelParameterValue>;
  copyCommentsOnClose: boolean;
  lastRepositoryPath: string;
  showWhitespace: boolean;
  theme: CodiffTheme;
  walkthroughModel: string;
  walkthroughModelParams?: Array<ModelParameterValue>;
};

export type KeyCombo = string;

export type CodiffKeymap = {
  closeSearch: KeyCombo;
  commandBar: KeyCombo;
  diffSearch: KeyCombo;
  discardComment: KeyCombo;
  fileFilter: KeyCombo;
  nextSearchMatch: KeyCombo;
  prevSearchMatch: KeyCombo;
  submitComment: KeyCombo;
  toggleSidebar: KeyCombo;
};

export type CodiffConfig = {
  keymap: CodiffKeymap;
  settings: CodiffSettings;
};
