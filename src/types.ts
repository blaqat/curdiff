export type DiffSection = {
  binary: boolean;
  id: string;
  kind: 'commit' | 'pull-request' | 'staged' | 'unstaged';
  loadState?: 'binary' | 'deferred' | 'directory' | 'error' | 'ready' | 'too-large';
  newFile?: {
    cacheKey?: string;
    contents: string;
    name: string;
  };
  oldFile?: {
    cacheKey?: string;
    contents: string;
    name: string;
  };
  patch: string;
  summary?: {
    canLoad?: boolean;
    fileCount?: number;
    fingerprint?: string;
    limit?: number;
    reason: string;
    size?: number;
  };
};

export type GitFileStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'untracked';

export type ChangedFile = {
  fingerprint: string;
  oldPath?: string;
  path: string;
  sections: ReadonlyArray<DiffSection>;
  status: GitFileStatus;
};

export type ReviewSource =
  | {
      type: 'working-tree';
    }
  | {
      ref: string;
      type: 'commit';
    }
  | {
      headSha?: string;
      number?: number;
      owner?: string;
      repo?: string;
      title?: string;
      type: 'pull-request';
      url: string;
    };

export type HistoryEntry = {
  author: string;
  committedAt: number;
  gravatarUrl?: string;
  parents: ReadonlyArray<string>;
  ref: string;
  scope?: 'base' | 'pull-request';
  subject: string;
};

export type RepositoryHistory = {
  entries: ReadonlyArray<HistoryEntry>;
  root: string;
};

export type RepositoryState = {
  branch: string | null;
  files: ReadonlyArray<ChangedFile>;
  generatedAt: number;
  launchPath: string;
  reviewComments?: ReadonlyArray<PullRequestExistingReviewComment>;
  root: string;
  source: ReviewSource;
};

export type CodiffLaunchOptions = {
  repositoryPathProvided: boolean;
  source?: ReviewSource;
  walkthrough: boolean;
};

export type TerminalHelperStatus = {
  command: string;
  installed: boolean;
  path: string;
};

export type WalkthroughFile = {
  action: 'review' | 'scan' | 'skim';
  context: string;
  impact: 'wide' | 'contained' | 'mechanical';
  path: string;
  reason: string;
};

export type WalkthroughGroup = {
  files: ReadonlyArray<WalkthroughFile>;
  reason: string;
  title: string;
};

export type Walkthrough = {
  groups: ReadonlyArray<WalkthroughGroup>;
  summary: {
    focus: string;
    skim: string;
  };
  version: 1;
};

export type WalkthroughResult =
  | {
      status: 'ready';
      walkthrough: Walkthrough;
    }
  | {
      code?: 'CURSOR_UNAVAILABLE';
      reason: string;
      status: 'unavailable';
    };

export type ModelParameterValue = {
  id: string;
  value: string;
};

export type ModelParameterDefinition = {
  id: string;
  label?: string;
  values: ReadonlyArray<{ label?: string; value: string }>;
};

export type ModelVariant = {
  description?: string;
  isDefault?: boolean;
  label: string;
  params: ReadonlyArray<ModelParameterValue>;
};

export type CodiffModel = {
  id: string;
  label?: string;
  parameters?: ReadonlyArray<ModelParameterDefinition>;
  variants?: ReadonlyArray<ModelVariant>;
};

export type ModelSelection = {
  id: string;
  params?: ReadonlyArray<ModelParameterValue>;
};

export type ReviewAssistantRequest = {
  comment: {
    body: string;
    filePath: string;
    lineNumber: number;
    sectionId: string;
    side: 'additions' | 'deletions';
    startLineNumber?: number;
    startSide?: 'additions' | 'deletions';
  };
  model?: string | ModelSelection;
  source?: ReviewSource;
  walkthroughNote?: {
    action: WalkthroughFile['action'];
    context: string;
    groupReason: string;
    groupTitle: string;
    impact: WalkthroughFile['impact'];
    reason: string;
  };
};

export type ReviewAssistantResult =
  | {
      reply: string;
      status: 'ready';
    }
  | {
      code?: 'CURSOR_UNAVAILABLE';
      reason: string;
      status: 'unavailable';
    };

export type GitIdentity = {
  email: string;
  gravatarUrl?: string;
  name: string;
};

export type DiffSectionContentRequest = {
  force?: boolean;
  kind: DiffSection['kind'];
  path: string;
  source?: ReviewSource;
};

export type DiffImageContentRequest = {
  kind: DiffSection['kind'];
  path: string;
  source?: ReviewSource;
};

export type DiffImageRevision = {
  dataUrl: string;
  mimeType: string;
  name: string;
  size: number;
};

export type DiffImageContentResult =
  | {
      newImage?: DiffImageRevision;
      oldImage?: DiffImageRevision;
      status: 'ready';
    }
  | {
      reason: string;
      status: 'unavailable';
    };

export type CodiffTheme = 'system' | 'light' | 'dark';

export type CodiffPreferences = {
  askModel: string;
  askModelParams?: ReadonlyArray<ModelParameterValue>;
  copyCommentsOnClose: boolean;
  lastRepositoryPath: string;
  showWhitespace: boolean;
  theme: CodiffTheme;
  walkthroughModel: string;
  walkthroughModelParams?: ReadonlyArray<ModelParameterValue>;
};

export type PullRequestReviewComment = {
  body: string;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  startLineNumber?: number;
  startSide?: 'additions' | 'deletions';
};

export type PullRequestExistingReviewComment = PullRequestReviewComment & {
  author: {
    avatarUrl?: string;
    login: string;
    url?: string;
  };
  id: string;
  submittedAt?: string;
  url?: string;
};

export type PullRequestReviewEvent = 'APPROVE' | 'REQUEST_CHANGES';

export type SubmitPullRequestCommentRequest = {
  comment: PullRequestReviewComment;
  source: Extract<ReviewSource, { type: 'pull-request' }>;
};

export type SubmitPullRequestReviewRequest = {
  body?: string;
  comments: ReadonlyArray<PullRequestReviewComment>;
  event: PullRequestReviewEvent;
  source: Extract<ReviewSource, { type: 'pull-request' }>;
};
