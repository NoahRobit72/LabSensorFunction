const { fetchDataFromMongoDB} = require('../../databaseFunctions/db');

// Example Response
//{"message":[{"DeviceName":"Device 1","Frequency":10,"Units":"Minute"},{"DeviceName":"Device 2","Frequency":10,"Units":"Minute"}]}
// DeviceName: Device 1
// Frequency: 10 samples per minute






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
    const multilineString = generateMultilineString(data);


    console.log(multilineString)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: multilineString,
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


function generateMultilineStringForSlack(data) {
  let result = "";

  data.forEach(device => {
    result += `*Device Name:* ${device.DeviceName}\n`;
    result += `*Frequency:* ${device.Frequency} samples per ${device.Units}\n\n`;
  });

  return result;
}



