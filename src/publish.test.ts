/**
 * Publish Workflow & Package Configuration Tests
 *
 * Validates that the npm publish GitHub Actions workflow and package.json
 * are configured correctly for zero-install (npx) distribution with
 * npm provenance, a full CI gate, and a clean published tarball.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKFLOW_PATH = path.resolve(__dirname, '../.github/workflows/npm-publish.yml');
const PACKAGE_PATH = path.resolve(__dirname, '../package.json');

describe('npm publish workflow', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  it('triggers on GitHub Release publish', () => {
    expect(workflow).toMatch(/release:\s*\n\s+types:\s*\[published\]/);
  });

  it('supports manual dispatch with an npm dist-tag input', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toMatch(/description:\s*['"]?npm dist-tag to publish under/);
    expect(workflow).toMatch(/default:\s*['"]latest['"]/);
  });

  it('grants id-token: write permission for npm provenance', () => {
    expect(workflow).toMatch(/id-token:\s*write/);
  });

  it('uses Node.js 22 to match engines', () => {
    expect(workflow).toMatch(/node-version:\s*['"]22['"]/);
  });

  it('configures the npm registry for setup-node auth', () => {
    expect(workflow).toContain("registry-url: 'https://registry.npmjs.org'");
  });

  it('pins actions to commit SHAs', () => {
    expect(workflow).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(workflow).toMatch(/actions\/setup-node@[0-9a-f]{40}/);
  });

  it('runs the full CI gate (lint, typecheck, test, build) before publish', () => {
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
  });

  it('verifies package contents with npm pack --dry-run', () => {
    expect(workflow).toContain('npm pack --dry-run');
  });

  it('guards against re-publishing an existing version', () => {
    expect(workflow).toContain('npm view "aliensec-mcp-server@$LOCAL" version');
    expect(workflow).toContain('already published to npm');
  });

  it('publishes with provenance, public access, and a dist-tag', () => {
    expect(workflow).toContain('npm publish --provenance --access public --tag "$NPM_TAG"');
    expect(workflow).toContain("NPM_TAG: ${{ github.event.inputs.tag || 'latest' }}");
  });

  it('authenticates via the NPM_REGISTRY_TOKEN secret', () => {
    expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_REGISTRY_TOKEN }}');
  });
});

describe('package.json publish configuration', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

  it('declares a bin entry pointing at the built entry point', () => {
    expect(pkg.bin).toEqual({ 'aliensec-mcp-server': 'dist/index.js' });
  });

  it('requires Node.js >= 22', () => {
    expect(pkg.engines.node).toBe('>=22.0.0');
  });

  it('ships only dist in the published tarball (excludes tests and dev config)', () => {
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.files).not.toContain('src');
  });

  it('declares public publish access', () => {
    expect(pkg.publishConfig).toEqual({ access: 'public' });
  });

  it('builds before packing via the prepack script', () => {
    expect(pkg.scripts.prepack).toBe('npm run build');
  });
});

describe('CLI entry point', () => {
  it('src/index.ts starts with a node shebang so the bin runs via npx', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './index.ts'), 'utf8');
    expect(source.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});
