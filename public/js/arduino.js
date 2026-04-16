const API_BASE = '/api/v1/arduino';

let currentProblem = null;
let currentSubmissionId = null;
let starterCode = '';

function el(id) {
  return document.getElementById(id);
}

function setAuthStatus(message, variant) {
  const statusEl = el('auth-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = 'auth-status';

  if (variant === 'loading') {
    statusEl.classList.add('auth-status-loading');
    return;
  }
  if (variant === 'success') {
    statusEl.classList.add('auth-status-success');
    return;
  }
  if (variant === 'error') {
    statusEl.classList.add('auth-status-error');
    return;
  }

  statusEl.classList.add('auth-status-info');
}

function setAuthenticatedView(isAuthenticated) {
  const authPanel = el('auth-panel');
  const mainApp = el('main-app');

  if (!authPanel || !mainApp) return;

  if (isAuthenticated) {
    authPanel.classList.add('hidden');
    mainApp.classList.remove('hidden');
    return;
  }

  authPanel.classList.remove('hidden');
  mainApp.classList.add('hidden');
}

function getDefaultStarterCode() {
  return 'void setup() {\n  // Initialize pins and serial\n  \n}\n\nvoid loop() {\n  // Main code here\n  \n}';
}

async function authenticateUser() {
  const identifier = el('test-email')?.value?.trim();
  const password = el('test-password')?.value ?? '';

  if (!identifier || !password) {
    setAuthStatus('Please enter identifier and password', 'error');
    return;
  }

  setAuthStatus('Logging in...', 'loading');

  try {
    const response = await fetch('/api/v1/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ identifier, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }

    setAuthStatus('Login successful', 'success');
    setAuthenticatedView(true);
    await loadProblems();
  } catch (error) {
    setAuthStatus(`Login failed: ${error.message}`, 'error');
    console.error('[arduino] auth error:', error);
  }
}

async function logoutUser() {
  try {
    await fetch('/api/v1/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.warn('[arduino] sign-out failed:', error);
  }

  currentProblem = null;
  currentSubmissionId = null;
  starterCode = '';
  setAuthenticatedView(false);
  setAuthStatus('Logged out', 'info');
}

async function checkAuthStatus() {
  try {
    const response = await fetch('/api/v1/auth/status', {
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success && data.authenticated) {
      setAuthenticatedView(true);
      await loadProblems();
      return;
    }
  } catch (error) {
    console.warn('[arduino] auth status check failed:', error);
  }

  setAuthenticatedView(false);
}

async function loadProblems() {
  const listContainer = el('problem-list');
  const loadingEl = el('problems-loading');

  if (!listContainer || !loadingEl) return;

  loadingEl.classList.remove('hidden');
  loadingEl.innerHTML = '<p>Loading problems...</p>';
  listContainer.classList.add('hidden');
  listContainer.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/problems`, {
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load problems');
    }

    const problems = data.data?.problems || [];

    if (!problems.length) {
      loadingEl.innerHTML = '<p>No problems available. Run: pnpm run seed</p>';
      return;
    }

    loadingEl.classList.add('hidden');
    listContainer.classList.remove('hidden');

    problems.forEach((problem) => {
      listContainer.appendChild(createProblemItem(problem));
    });
  } catch (error) {
    loadingEl.innerHTML = '';

    const errorMessage = document.createElement('p');
    errorMessage.className = 'error-text';
    errorMessage.textContent = `Error: ${error.message}`;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-secondary retry-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', loadProblems);

    loadingEl.appendChild(errorMessage);
    loadingEl.appendChild(retryBtn);
  }
}

function createProblemItem(problem) {
  const div = document.createElement('div');
  div.className = 'problem-item';
  div.setAttribute('data-problem-id', problem.id);

  const difficulty = (problem?.question?.difficulty || 'easy').toLowerCase();

  div.innerHTML = `
    <div class="problem-title">${problem.question.title}</div>
    <div class="problem-meta">
      <span class="difficulty-badge difficulty-${difficulty}">${difficulty}</span>
      <span>Board: ${(problem.board || 'uno').toUpperCase()}</span>
    </div>
  `;

  div.addEventListener('click', () => {
    selectProblem(problem, div);
  });

  return div;
}

async function selectProblem(problem, selectedElement) {
  currentProblem = problem;
  currentSubmissionId = null;

  el('empty-state')?.classList.add('hidden');
  el('problem-workspace')?.classList.remove('hidden');

  if (el('problem-title')) el('problem-title').textContent = problem.question.title;
  if (el('problem-description')) el('problem-description').textContent = problem.question.description;

  if (problem.board && el('board-select')) {
    el('board-select').value = problem.board;
  }

  starterCode = getDefaultStarterCode();

  try {
    const response = await fetch(`${API_BASE}/problems/${problem.id}`, {
      credentials: 'include',
    });
    const data = await response.json();

    if (response.ok && data.success && data.data?.starterCode) {
      starterCode = data.data.starterCode;
    }
  } catch (error) {
    console.warn('[arduino] starter code fetch failed:', error);
  }

  if (el('code-editor')) el('code-editor').value = starterCode;

  document.querySelectorAll('.problem-item').forEach((item) => item.classList.remove('active'));
  selectedElement.classList.add('active');

  showStatus('Ready to compile', 'info');
  el('result-section')?.classList.add('hidden');
  if (el('validate-btn')) el('validate-btn').disabled = true;
}

function resetCode() {
  if (!starterCode) return;

  if (window.confirm('Reset code to starter template?')) {
    if (el('code-editor')) el('code-editor').value = starterCode;
    currentSubmissionId = null;
    if (el('validate-btn')) el('validate-btn').disabled = true;
    showStatus('Code reset to starter template', 'info');
  }
}

async function compileCode() {
  if (!currentProblem) {
    window.alert('Please select a problem first');
    return;
  }

  const code = el('code-editor')?.value?.trim();
  if (!code) {
    window.alert('Please write some code first');
    return;
  }

  const boardType = el('board-select')?.value || 'uno';
  const compileBtn = el('compile-btn');

  if (compileBtn) {
    compileBtn.disabled = true;
    compileBtn.innerHTML = '<span class="loading-spinner"></span> Compiling...';
  }

  showStatus('Submitting code for compilation...', 'loading');

  try {
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        problemId: currentProblem.id,
        code,
        boardType,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const details = Array.isArray(data.details)
        ? data.details.map((entry) => `${entry.path || entry.param}: ${entry.msg}`).join('\n')
        : null;
      throw new Error(details || data.error || 'Compilation submission failed');
    }

    currentSubmissionId = data.data.submissionId;
    showStatus('Compilation job queued. Polling for results...', 'loading');

    await pollCompilationStatus(currentSubmissionId);
  } catch (error) {
    handleCompilationFailure({ error: error.message, status: 'compilation_error' });
  }
}

async function pollCompilationStatus(submissionId) {
  const maxAttempts = 30;
  const terminalFailureStatuses = new Set([
    'wrong_answer',
    'compilation_error',
    'compile_error',
    'runtime_error',
    'internal_error',
  ]);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/jobs/${submissionId}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get job status');
      }

      const status = data.data?.status;

      if (status === 'accepted') {
        handleCompilationSuccess(data.data);
        return;
      }

      if (terminalFailureStatuses.has(status)) {
        handleCompilationFailure(data.data);
        return;
      }

      showStatus(`Compiling... (${status || 'processing'})`, 'loading');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      handleCompilationFailure({ error: error.message, status: 'compilation_error' });
      return;
    }
  }

  handleCompilationFailure({ error: 'Compilation timeout', status: 'compilation_error' });
}

function handleCompilationSuccess(payload) {
  const compileBtn = el('compile-btn');
  if (compileBtn) {
    compileBtn.disabled = false;
    compileBtn.textContent = '🔨 Compile Code';
  }

  showStatus('Compilation successful', 'success');

  const result = payload?.result || {};
  const hexCode = result.hexCode;
  const compileTime = result.compileTime || 'N/A';

  const output = [
    'COMPILATION SUCCESSFUL',
    '',
    `Hex File Generated: ${hexCode ? 'Yes' : 'No'}`,
    `Hex File Size: ${hexCode ? `${hexCode.length} bytes` : 'N/A'}`,
    `Compile Time: ${compileTime} ms`,
    '',
    `Status: ${payload?.status || 'accepted'}`,
  ];

  if (hexCode) {
    output.push('', `Hex File Preview:\n${hexCode.substring(0, 200)}...`);
  }

  if (el('compilation-result')) {
    el('compilation-result').textContent = output.join('\n');
  }

  el('result-section')?.classList.remove('hidden');
  if (el('validate-btn')) el('validate-btn').disabled = false;
}

function handleCompilationFailure(payload) {
  const compileBtn = el('compile-btn');
  if (compileBtn) {
    compileBtn.disabled = false;
    compileBtn.textContent = '🔨 Compile Code';
  }

  const result = payload?.result || {};
  const error = result.error || payload?.error || 'Unknown error';
  const status = payload?.status || 'compilation_error';

  showStatus('Compilation failed', 'error');

  if (el('compilation-result')) {
    el('compilation-result').textContent = [
      'COMPILATION FAILED',
      '',
      `Error: ${error}`,
      '',
      `Status: ${status}`,
      '',
      'Please check your code for syntax errors and unsupported APIs.',
    ].join('\n');
  }

  el('result-section')?.classList.remove('hidden');
  if (el('validate-btn')) el('validate-btn').disabled = true;
}

async function validateSubmission() {
  if (!currentSubmissionId) {
    window.alert('No submission to validate');
    return;
  }

  const validateBtn = el('validate-btn');
  if (validateBtn) {
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
  }

  try {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ submissionId: currentSubmissionId }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Validation failed');
    }

    const passedCount = data.data?.passedCount ?? 0;
    const totalCount = data.data?.totalCount ?? 0;

    if (data.data?.allTestsPassed) {
      showStatus(`Problem solved: ${passedCount}/${totalCount} tests passed`, 'success');
      window.alert('Congratulations! You solved this problem.');
    } else {
      showStatus(`Some tests failed: ${passedCount}/${totalCount} passed`, 'warning');
    }
  } catch (error) {
    showStatus(`Validation error: ${error.message}`, 'error');
  } finally {
    if (validateBtn) {
      validateBtn.disabled = false;
      validateBtn.textContent = '✅ Validate & Submit';
    }
  }
}

function showStatus(message, type) {
  const statusBox = el('status-box');
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.className = `status-box status-${type || 'info'}`;
  statusBox.classList.remove('hidden');
}

function bindEvents() {
  el('login-btn')?.addEventListener('click', authenticateUser);
  el('logout-btn')?.addEventListener('click', logoutUser);
  el('compile-btn')?.addEventListener('click', compileCode);
  el('validate-btn')?.addEventListener('click', validateSubmission);
  el('reset-code-btn')?.addEventListener('click', resetCode);
}

window.addEventListener('load', async () => {
  bindEvents();
  await checkAuthStatus();
});
