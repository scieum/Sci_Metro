import { defineConfig } from 'vitest/config';

export default defineConfig({
  // threads: child-process(forks) 워커가 이 PC의 OneDrive 경로에서 끊긴다
  test: { environment: 'node', pool: 'threads' },
});
