const axios = require('axios');
// SLACK Sub function
// In the future this could just be a function that is called

exports.handler = async function (event) {
    const alarm = event.queryStringParameters.alarmName
    const slackWebhookURL = 'https://hooks.slack.com/services/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';

    const returnString = `ALERT: ${alarm} has been triggered!`

    try {
        await axios.post(slackWebhookURL, {
            text: returnString,
        }, {
        headers: {
          'Content-type': 'application/json',
            },
        });
  
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'sucess'
            })
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'error'
            })
        }
    }
} 
