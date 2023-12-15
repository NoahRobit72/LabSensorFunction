const { connectToDatabase, login } = require('../../databaseFunctions/db');

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

  const nameOfLab = "nia lab";
  const passwordOfLab = "pi4life";

  try {
    const db = await connectToDatabase();

    const lab = await login(db, nameOfLab, passwordOfLab);

    if (lab.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          api: lab.api,
          message: 'Login successful',
        }),
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          message: 'Login unsuccessful',
        }),
      };
    }
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};
