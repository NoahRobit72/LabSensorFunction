const { headers, connectToDatabase, getAllHomePageData } = require('../../public/helpers/db');

exports.handler = async function (event) {
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
    const labApi = event.queryStringParameters.labApi;
    const db = await connectToDatabase();
    const response = await getAllHomePageData(db, labApi);

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
}
