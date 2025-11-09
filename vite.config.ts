// FIX: The original /// <reference types="node" /> directive was removed as it caused a "Cannot find type definition file" error.

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Fix: Replace `__dirname` with `process.cwd()` because `__dirname` is not available in ES modules.
          // FIX: Cast `process` to `any` to access `cwd` because node types are unavailable, which resolves the "Property 'cwd' does not exist" error.
          '@': path.resolve((process as any).cwd(), '.'),
        }
      }
    };
});