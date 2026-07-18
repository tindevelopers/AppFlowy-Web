#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.APPFLOWY_BASE_URL || 'https://projects.tinconnect.com';

function resolveToken() {
  if (process.env.APPFLOWY_TOKEN) {
    return process.env.APPFLOWY_TOKEN.trim();
  }
  const paths = [
    path.join(__dirname, '../../app-flowy-tin/.appflowy-token'),
    path.join(__dirname, '../.appflowy-token'),
    path.join(process.env.HOME || '', '.appflowy-token'),
    path.join(process.cwd(), '.appflowy-token'),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8').trim();
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

const token = resolveToken();
if (!token) {
  console.error('Error: APPFLOWY_TOKEN not found in environment or local files.');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function apiRequest(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = await res.json();
    return json.data || json;
  } catch (err) {
    console.error(`API Request failed for ${url}:`, err.message);
    process.exit(1);
  }
}

function printFolder(view, depth = 0) {
  const indent = '  '.repeat(depth);
  const viewId = view.view_id || view.id;
  const isSpace = view.is_space || view.extra?.is_space || (typeof view.extra === 'string' && JSON.parse(view.extra).is_space);
  const spaceMarker = isSpace ? ' [SPACE]' : '';
  console.log(`${indent}${viewId}  ${view.name}${spaceMarker}`);
  if (view.children) {
    for (const child of view.children) {
      printFolder(child, depth + 1);
    }
  }
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`
AppFlowy Provisioning CLI (Node.js)
==================================
Usage:
  node scripts/appflowy-cli.js list [workspaceId]
  node scripts/appflowy-cli.js create-space <workspaceId> <name> [icon] [color] [permission]
  node scripts/appflowy-cli.js create-page <workspaceId> <parentViewId> <name> <layout>

Layout types for create-page:
  0 = Document
  1 = Grid
  2 = Board
  3 = Calendar
  4 = Chat
`);
  process.exit(0);
}

if (command === 'list') {
  let workspaceId = args[1];
  if (!workspaceId) {
    const workspaces = await apiRequest(`${baseUrl}/api/workspace?include_member_count=true`);
    if (!workspaces || workspaces.length === 0) {
      console.error('No workspaces found.');
      process.exit(1);
    }
    workspaceId = workspaces[0].workspace_id || workspaces[0].id;
    console.log(`Using default workspace: ${workspaces[0].workspace_name || workspaces[0].name} (${workspaceId})`);
  }

  const folder = await apiRequest(`${baseUrl}/api/workspace/${workspaceId}/view/${workspaceId}?depth=10`);
  console.log(`Workspace Folder Tree:`);
  printFolder(folder, 1);
} else if (command === 'create-space') {
  const workspaceId = args[1];
  const name = args[2];
  const icon = args[3] || '📁';
  const color = args[4] || 'blue';
  const permission = parseInt(args[5] || '0', 10);

  if (!workspaceId || !name) {
    console.error('Usage: node scripts/appflowy-cli.js create-space <workspaceId> <name> [icon] [color] [permission]');
    process.exit(1);
  }

  const result = await apiRequest(`${baseUrl}/api/workspace/${workspaceId}/space`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      space_icon: icon,
      space_icon_color: color,
      space_permission: permission,
    }),
  });

  console.log(`[ok] space created: ${name}`);
  console.log(`view_id: ${result.view_id || result}`);
} else if (command === 'create-page') {
  const workspaceId = args[1];
  const parentViewId = args[2];
  const name = args[3];
  const layout = parseInt(args[4] || '0', 10);

  if (!workspaceId || !parentViewId || !name) {
    console.error('Usage: node scripts/appflowy-cli.js create-page <workspaceId> <parentViewId> <name> <layout>');
    process.exit(1);
  }

  const result = await apiRequest(`${baseUrl}/api/workspace/${workspaceId}/page-view`, {
    method: 'POST',
    body: JSON.stringify({
      parent_view_id: parentViewId,
      layout,
      name,
    }),
  });

  console.log(`[ok] page view created: ${name}`);
  console.log(`view_id: ${result.view_id}`);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
