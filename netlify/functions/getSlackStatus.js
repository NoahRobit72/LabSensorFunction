const { headers, getSlackConfigData} = require('../../public/helpers/db');

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
    const response = await getSlackConfigData()
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
}

