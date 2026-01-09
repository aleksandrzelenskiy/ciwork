// src/server/db/mongoose.ts

import mongoose, { Connection, ConnectOptions } from 'mongoose';

interface GlobalMongoose {
  mongoose: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
}

declare const global: typeof globalThis & GlobalMongoose;

const globalMongoose = global.mongoose || { conn: null, promise: null };
global.mongoose = globalMongoose;

const isBuildPhase = (): boolean =>
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';

export const getMongoUri = ({
  requiredAtRuntime,
}: {
  requiredAtRuntime: boolean;
}): string | undefined => {
  const value = process.env.MONGODB_URI?.trim();
  if (!value) {
    if (requiredAtRuntime && !isBuildPhase()) {
      throw new Error('MONGODB_URI is required');
    }
    return undefined;
  }
  return value;
};

async function connectToMongo(): Promise<Connection> {
  if (mongoose.connection.readyState === 1) {
    globalMongoose.conn = mongoose.connection;
    return globalMongoose.conn;
  }
  if (globalMongoose.conn) {
    return globalMongoose.conn;
  }

  const mongoUri = getMongoUri({ requiredAtRuntime: !isBuildPhase() });
  if (!mongoUri) {
    // Build phase should not fail on missing runtime secrets.
    return mongoose.connection;
  }

  if (!globalMongoose.promise) {
    globalMongoose.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 30000,
      } as ConnectOptions)
      .then((mongoose) => {
        return mongoose.connection;
      })
      .catch(() => {
        console.error('Error connecting to MongoDB.');
        throw new Error('Failed to connect to MongoDB');
      });
  }

  globalMongoose.conn = await globalMongoose.promise;
  return globalMongoose.conn;
}

export default connectToMongo;
