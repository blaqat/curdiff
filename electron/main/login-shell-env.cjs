// @ts-check

// Shell environment resolution adapted from VS Code
// https://github.com/microsoft/vscode/blob/main/src/vs/platform/shell/node/shellEnv.ts

const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { userInfo } = require('node:os');
const { basename } = require('node:path');

const RESOLVE_TIMEOUT_MS = 10_000;

/** @returns {string} */
const getSystemShell = () => {
  const shell = process.env.SHELL;
  if (shell) {
    return shell;
  }

  try {
    const info = userInfo();
    if (info.shell && info.shell !== '/bin/false') {
      return info.shell;
    }
  } catch {
    // Fall through to default shell.
  }

  return process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
};

/** @returns {boolean} */
const shouldResolveShellEnv = () => {
  if (process.platform === 'win32') {
    return false;
  }

  if (process.env.CODIFF_CLI === '1') {
    return false;
  }

  if (process.env.CODIFF_DISABLE_SHELL_ENV === '1') {
    return false;
  }

  if (process.env.CURSOR_API_KEY?.trim()) {
    return false;
  }

  return true;
};

/** @returns {Record<string, string> | undefined} */
const resolveShellEnv = () => {
  if (!shouldResolveShellEnv()) {
    return undefined;
  }

  const savedRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
  const savedNoAttach = process.env.ELECTRON_NO_ATTACH_CONSOLE;
  const mark = randomUUID().replace(/-/g, '').slice(0, 12);
  const regex = new RegExp(`${mark}({.*})${mark}`);
  const shell = getSystemShell();
  const name = basename(shell);

  /** @type {string} */
  let command;
  /** @type {string[]} */
  let shellArgs;

  if (/^(?:pwsh|powershell)(?:-preview)?$/.test(name)) {
    command = `& '${process.execPath}' -p '''${mark}'' + JSON.stringify(process.env) + ''${mark}'''`;
    shellArgs = ['-Login', '-Command'];
  } else if (name === 'nu') {
    command = `^'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
    shellArgs = ['-i', '-l', '-c'];
  } else if (name === 'xonsh') {
    command = `import os, json; print("${mark}", json.dumps(dict(os.environ)), "${mark}")`;
    shellArgs = ['-i', '-l', '-c'];
  } else {
    command = `'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
    shellArgs = name === 'tcsh' || name === 'csh' ? ['-ic'] : ['-i', '-l', '-c'];
  }

  const result = spawnSync(shell, [...shellArgs, command], {
    encoding: 'utf8',
    timeout: RESOLVE_TIMEOUT_MS,
    env: {
      ...process.env,
      CODIFF_RESOLVING_SHELL_ENV: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1',
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  if (result.status !== 0 && result.status !== null) {
    return undefined;
  }

  if (!result.stdout) {
    return undefined;
  }

  const match = regex.exec(result.stdout);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    const env = /** @type {Record<string, string>} */ (JSON.parse(match[1]));

    if (savedRunAsNode) {
      env.ELECTRON_RUN_AS_NODE = savedRunAsNode;
    } else {
      delete env.ELECTRON_RUN_AS_NODE;
    }

    if (savedNoAttach) {
      env.ELECTRON_NO_ATTACH_CONSOLE = savedNoAttach;
    } else {
      delete env.ELECTRON_NO_ATTACH_CONSOLE;
    }

    delete env.CODIFF_RESOLVING_SHELL_ENV;
    delete env.XDG_RUNTIME_DIR;

    return env;
  } catch {
    return undefined;
  }
};

/**
 * On macOS/Linux, Electron inherits a minimal environment when launched from
 * Finder/Dock. Spawn the user's login shell and capture its full environment
 * so child processes see the same variables as a normal terminal session.
 */
const inheritLoginShellEnv = () => {
  try {
    const env = resolveShellEnv();
    if (env) {
      Object.assign(process.env, env);
    }
  } catch {
    // Keep inherited environment if shell lookup fails.
  }
};

module.exports = {
  getSystemShell,
  inheritLoginShellEnv,
  resolveShellEnv,
  shouldResolveShellEnv,
};
