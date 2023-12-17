
const { fetchDataFromMongoDB} = require('../../databaseFunctions/db');


exports.handler = async function () {
  // Enable CORS for all routes
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Allow-Methods',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
  try {
    const data = await fetchDataFromMongoDB();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: data,
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        message: 'error did not get data',
      }),
    };
  }
}



