import mongoose from 'mongoose';
import env from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.error('Is MongoDB running? Check MONGODB_URI in backend/.env');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export const dbState = () =>
  ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown';
