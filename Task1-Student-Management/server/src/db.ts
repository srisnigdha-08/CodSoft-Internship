import mongoose from "mongoose";
import { allModels } from "./models/index.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, {
    // Fail quickly when MongoDB is down rather than queueing requests.
    bufferCommands: false,
    serverSelectionTimeoutMS: 3_000,
    maxPoolSize: 10,
    // Indexes are built explicitly below so a conflict stops startup visibly.
    autoIndex: false,
  });
  await Promise.all(allModels.map((model) => model.createIndexes()));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const database = mongoose.connection.db;
    if (mongoose.connection.readyState !== 1 || !database) return false;
    await database.admin().ping();
    return true;
  } catch {
    return false;
  }
}
