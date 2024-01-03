const { headers, connectToDatabase, removeDevice } = require('../../public/helpers/db');

exports.handler = async function (event) {
  const labApi = event.queryStringParameters.labApi;
  const deviceID = event.queryStringParameters.deviceID;

  try {
    const db = await connectToDatabase();
    const response = await removeDevice(db, labApi, deviceID);

    if (response.success) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        }
    }
    else {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify(response)
        }
    }
  } catch {
    return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      };
  }

}