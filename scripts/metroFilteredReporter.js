'use strict';

const { TerminalReporter } = require('metro');

/**
 * Drops noisy InspectorProxy DevTools WebSocket info lines (e.g. when a new
 * debugger attaches and the previous session closes with NEW_DEBUGGER_OPENED).
 * Errors/warnings from the same layer are unchanged.
 */
class FilteredTerminalReporter extends TerminalReporter {
  update(event) {
    if (shouldSuppressInspectorDevToolsInfo(event)) {
      return;
    }
    super.update(event);
  }
}

function shouldSuppressInspectorDevToolsInfo(event) {
  if (event.type !== 'unstable_server_log' || event.level !== 'info') {
    return false;
  }
  const parts = [].concat(event.data);
  const format = String(parts[0] ?? '');
  return format.includes('DevTools for app=');
}

module.exports = FilteredTerminalReporter;
