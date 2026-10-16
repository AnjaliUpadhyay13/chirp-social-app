import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

// Uses TEST_MONGODB_URI (e.g. mongodb://127.0.0.1:27017) if set, otherwise downloads and starts an
// in-memory MongoDB via mongodb-memory-server (first run needs internet to fetch the mongod binary).
let memoryServer;

export async function connectTestDB() {
  const dbName = `social_test_${randomUUID().slice(0, 8)}`;
  let base = process.env.TEST_MONGODB_URI;
  if (!base) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    base = memoryServer.getUri();
  }
  await mongoose.connect(base.replace(/\/?$/, '/') + dbName);
}

export async function disconnectTestDB() {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export async function clearCollections() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
