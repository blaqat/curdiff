import type { CodiffConfig } from './config/types.ts';
import type {
  CodiffModel,
  CodiffPreferences,
  CodiffLaunchOptions,
  DiffImageContentRequest,
  DiffImageContentResult,
  DiffSection,
  DiffSectionContentRequest,
  GitIdentity,
  ModelSelection,
  RepositoryHistory,
  RepositoryState,
  ReviewAssistantRequest,
  ReviewAssistantResult,
  ReviewSource,
  SubmitPullRequestCommentRequest,
  PullRequestExistingReviewComment,
  SubmitPullRequestReviewRequest,
  TerminalHelperStatus,
  WalkthroughResult,
} from './types.ts';

declare global {
  interface Window {
    codiff: {
      askReviewAssistant: (request: ReviewAssistantRequest) => Promise<ReviewAssistantResult>;
      getConfig: () => Promise<CodiffConfig>;
      getDiffImageContent: (request: DiffImageContentRequest) => Promise<DiffImageContentResult>;
      getDiffSectionContent: (request: DiffSectionContentRequest) => Promise<DiffSection>;
      getGitIdentity: () => Promise<GitIdentity>;
      getLaunchOptions: () => Promise<CodiffLaunchOptions>;
      getPreferences: () => Promise<CodiffPreferences>;
      getRepositoryHistory: (limit?: number, source?: ReviewSource) => Promise<RepositoryHistory>;
      getRepositoryState: (source?: ReviewSource) => Promise<RepositoryState>;
      getTerminalHelperStatus: () => Promise<TerminalHelperStatus>;
      getWalkthrough: (
        request?: ReviewSource | { model?: string | ModelSelection; source?: ReviewSource },
      ) => Promise<WalkthroughResult>;
      installTerminalHelper: () => Promise<TerminalHelperStatus>;
      listModels: () => Promise<Array<CodiffModel>>;
      onConfigChanged: (callback: (config: CodiffConfig) => void) => () => void;
      onCopyPendingCommentsRequest: (callback: () => string | Promise<string>) => () => void;
      onFindInDiffs: (callback: () => void) => () => void;
      onRepositoryChanged: (callback: (change: { root: string }) => void) => () => void;
      openConfigFile: () => Promise<void>;
      openFile: (path: string) => Promise<void>;
      showInFolder: (path: string) => Promise<void>;
      submitPullRequestComment: (
        request: SubmitPullRequestCommentRequest,
      ) => Promise<PullRequestExistingReviewComment>;
      submitPullRequestReview: (request: SubmitPullRequestReviewRequest) => Promise<void>;
      updateSettings: (settings: Partial<CodiffConfig['settings']>) => Promise<void>;
    };
  }
}
