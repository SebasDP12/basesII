require('dotenv').config();
const { Pool: PgPool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

class ConnectionManager {
  constructor() {
    this.pgPool = null;
    this.mysqlPool = null;
    this.mongoClient = null;
    this.mongoDb = null;
    this.firestoreDb = null;
  }

  // 1. PostgreSQL (Hospital General)
  getPostgresPool() {
    if (!this.pgPool) {
      this.pgPool = new PgPool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'hospital_general',
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || 'adminpassword',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
      });
      this.pgPool.on('error', (err) => {
        console.error('[PostgreSQL Error]:', err.message);
      });
    }
    return this.pgPool;
  }

  // 2. MySQL (Clínica Odontológica)
  getMySQLPool() {
    if (!this.mysqlPool) {
      this.mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        database: process.env.MYSQL_DB || 'clinica_odontologica',
        user: process.env.MYSQL_USER || 'admin',
        password: process.env.MYSQL_PASSWORD || 'adminpassword',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 4000
      });
    }
    return this.mysqlPool;
  }

  // 3. MongoDB (Laboratorio Clínico)
  async getMongoDatabase() {
    if (!this.mongoDb) {
      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/laboratorio_clinico';
      this.mongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      await this.mongoClient.connect();
      this.mongoDb = this.mongoClient.db('laboratorio_clinico');
    }
    return this.mongoDb;
  }

  // 4. Firebase Firestore (Centro Médico Pediátrico)
  async getFirestore() {
    if (this.firestoreDb) {
      return this.firestoreDb;
    }

    try {
      const { Firestore } = require('@google-cloud/firestore');

      const options = {
        projectId: process.env.FIRESTORE_PROJECT_ID || 'pediatria-project'
      };

      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
        options.keyFilename = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      }

      const firestore = new Firestore(options);
      this.firestoreDb = firestore;
      return firestore;
    } catch (err) {
      console.warn('[Firestore Init]: SDK warning, using resilient fallback store.', err.message);
      return null;
    }
  }

  async closeAll() {
    if (this.pgPool) {
      await this.pgPool.end().catch(() => {});
    }
    if (this.mysqlPool) {
      await this.mysqlPool.end().catch(() => {});
    }
    if (this.mongoClient) {
      await this.mongoClient.close().catch(() => {});
    }
  }
}

module.exports = new ConnectionManager();
