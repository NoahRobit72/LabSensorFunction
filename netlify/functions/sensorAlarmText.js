const accountSid = 'ACab8799e29a7be958d0bbef422d874e6a';
const authToken = 'fe3391709cddc431de7692078884ccbc';
const client = require('twilio')(accountSid, authToken);



exports.handler = async function (event) {
    const alarm = event.queryStringParameters.alarmName

    const returnString = `ALERT: ${alarm} has been triggered!`

    client.messages
    .create({
        body: returnString,
        from: '+18557298429',
        to: '+12313426931'
    })
    .then(message => console.log(message.sid))

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Lab Function API is working'
        })
    }
} 