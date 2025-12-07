// src/services/mongoService.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'your-connection-string';
const DB_NAME = 'BolnaCalls';
const COLLECTION_NAME = 'bolnaCalls';

export async function fetchBolnaCalls() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const database = client.db(DB_NAME);
    const collection = database.collection(COLLECTION_NAME);
    const calls = await collection.find({}).toArray();
    return calls;
  } finally {
    await client.close();
  }
}