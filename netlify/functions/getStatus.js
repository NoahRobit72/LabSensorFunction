const { fetchDataFromMongoDB} = require('../../public/helpers/db');

// SLACK Function

// Example Query
//{"message":[{"DeviceName":"Device 1","Frequency":10,"Units":"Minute"},{"DeviceName":"Device 2","Frequency":10,"Units":"Minute"}]}

// Slack OUTPUT:
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
  
    console.log(multilineString);
  
    const response = {
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": multilineString
          }
        }
      ]
    };
  
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


function generateMultilineString(data) {
  let result = "";

  data.forEach(device => {
    result += `*Device Name:* ${device.DeviceName}\n`;
    result += `*Frequency:* ${device.Frequency} samples per ${device.Units}\n\n`;
  });

  return result;
}



