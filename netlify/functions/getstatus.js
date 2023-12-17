// const { connectToDatabase, login } = require('../../databaseFunctions/db');
import { MongoClient } from 'mongodb';


exports.handler = async function (event, context) {
  // Enable CORS for all routes
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Allow-Methods',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
    };
  }

  const filter = {};
  const projection = {
    'DeviceName': 1, 
    'Frequency': 1, 
    'Units': 1, 
    '_id': 0
  };

  const client = await MongoClient.connect(
    'mongodb+srv://bgilb33:GbGb302302!@labsensordb.drzhafh.mongodb.net/?retryWrites=true&w=majority'
  );
  const coll = client.db('test').collection('nialab_configCollection');
  const cursor = coll.find(filter, { projection });
  const result = await cursor.toArray();
  await client.close();
  return result
};
