const { headers, connectToDatabase, login } = require('../../public/helpers/db');

exports.handler = async function (event, context) {
  const handleCors = (statusCode, body) => ({
    statusCode,
    headers: headers,
    body: JSON.stringify(body),
  });

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(200, {});
  }

  try {
    const body = JSON.parse(event.body);

    const nameOfLab = body.labName;
    const passwordOfLab = body.labPassword;

    const db = await connectToDatabase();
    const response = await login(db, nameOfLab, passwordOfLab);

    if (response.success) {
      return handleCors(200, response);
    } else {
      return handleCors(401, response);
    }
  } catch (err) {
    console.error("Error:", err);

    return handleCors(500, {
      error: 'Internal server error',
    });
  }
};
