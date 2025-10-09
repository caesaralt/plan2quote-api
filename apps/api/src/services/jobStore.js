import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { env } from '../config/env.js';

const ensureDirectory = (filePath) => {
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
};

const readStore = (filePath) => {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const writeStore = (filePath, data) => {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
};

class JobStore {
  constructor() {
    const resolvedPath = isAbsolute(env.JOB_DATABASE_PATH)
      ? env.JOB_DATABASE_PATH
      : resolve(process.cwd(), env.JOB_DATABASE_PATH);
    ensureDirectory(resolvedPath);
    this.filePath = resolvedPath;
    this.cache = readStore(this.filePath);
  }

  upsertJob(record) {
    this.cache[record.id] = { ...record };
    writeStore(this.filePath, this.cache);
  }

  findByHash(hash) {
    const items = Object.values(this.cache);
    const matches = items.filter((item) => item.hash === hash);
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }

  findById(id) {
    return this.cache[id];
  }
}

export const jobStore = new JobStore();
