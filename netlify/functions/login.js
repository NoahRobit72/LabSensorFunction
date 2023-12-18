const { headers, connectToDatabase, login } = require('../../databaseFunctions/db');

exports.handler = async function (event) {
  const nameOfLab = event.queryStringParameters.nameOfLab;
  const passwordOfLab = event.queryStringParameters.passwordOfLab;

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
