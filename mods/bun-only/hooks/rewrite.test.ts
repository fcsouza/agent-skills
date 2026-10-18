import { describe, expect, test } from 'claude-code/testing';

import { rewrite } from './rewrite';

describe('rewrite', () => {
  test('installs and adds', () => {
    expect(rewrite('npm install')).toBe('bun install');
    expect(rewrite('npm ci')).toBe('bun install');
    expect(rewrite('npm i -D typescript')).toBe('bun add -d typescript');
    expect(rewrite('yarn add zod')).toBe('bun add zod');
    expect(rewrite('pnpm add -g turbo')).toBe('bun add -g turbo');
    expect(rewrite('yarn')).toBe('bun install');
  });

  test('scripts keep their own runner', () => {
    expect(rewrite('npm test')).toBe('bun run test');
    expect(rewrite('npm run build -- --watch')).toBe('bun run build -- --watch');
    expect(rewrite('yarn dev')).toBe('bun run dev');
  });

  test('npx and dlx become bunx', () => {
    expect(rewrite('npx -y create-next-app my-app')).toBe('bunx create-next-app my-app');
    expect(rewrite('pnpm dlx shadcn add button')).toBe('bunx shadcn add button');
  });

  test('biome goes through ultracite scripts', () => {
    expect(rewrite('bunx biome check --write .')).toBe('bun run format');
    expect(rewrite('bunx biome check src')).toBe('bun run lint:biome');
  });

  test('builtins and look-alike tools are left alone', () => {
    expect(rewrite('npm-check-updates -u')).toBe('npm-check-updates -u');
    expect(rewrite('pnpm publish --access public')).toBe('pnpm publish --access public');
    expect(rewrite('yarn why react')).toBe('yarn why react');
    expect(rewrite('npm create vite@latest app')).toBe('bun create vite@latest app');
    expect(rewrite('echo hi\nnpm install')).toBe('echo hi\nbun install');
  });

  test('only command starts are touched', () => {
    expect(rewrite('cd app && npm install && echo npm done')).toBe('cd app && bun install && echo npm done');
    expect(rewrite('bun install')).toBe('bun install');
    expect(rewrite('grep -r npm src')).toBe('grep -r npm src');
  });
});
