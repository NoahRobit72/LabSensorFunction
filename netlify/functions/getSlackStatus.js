const { headers, connectToDatabase, getAllConfigData } = require('../../public/helpers/db');

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
    const db = await connectToDatabase();
    console.log("connected to database")
    const returnContent = await getAllConfigData(db, "nialab"); // hard coded now but will be changed later
    const multilineString = generateMultilineString(returnContent.data);
  
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
    result += `*Device Status:* ${device.Status}\n`;
    result += `*Frequency:* ${device.Frequency} samples per ${device.Units}\n\n`;
  });

  return result;
}
