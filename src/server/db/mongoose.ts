// src/server/db/mongoose.ts

import 'server-only';

import mongoose, { Connection, ConnectOptions } from 'mongoose';
import { requireEnv } from '@/config/env';

const MONGODB_URI = requireEnv('MONGODB_URI', 'MONGODB_URI');

interface GlobalMongoose {
  mongoose: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
}

declare const global: typeof globalThis & GlobalMongoose;

const globalMongoose = global.mongoose || { conn: null, promise: null };
global.mongoose = globalMongoose;

async function dbConnect(): Promise<Connection> {
  if (globalMongoose.conn) {
    console.log('Mongoose already connected.');
    return globalMongoose.conn;
  }

  if (!globalMongoose.promise) {
    globalMongoose.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
      } as ConnectOptions)
      .then((mongoose) => {
        console.log(
          `Mongoose connected to database: ${mongoose.connection.host}`
        );
        return mongoose.connection;
      })
      .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
        throw new Error('Failed to connect to MongoDB');
      });
  }

  globalMongoose.conn = await globalMongoose.promise;
  return globalMongoose.conn;
}

export default dbConnect;
