const { App } = require('@slack/bolt')

// Initializes your app with your bot token and signing secret
const app = new App({
  token: "xoxb-4803222186196-4861475485057-BXb6pAzs9oeyMXWyEbC199Cg",
  signingSecret: "8ccfc0561ce400c3986ab60e0d8f9bfd",
});

(async () => {
  // Start your app
  await app.start(3000)

  console.log('⚡️Hello World.. Bolt app is running!')
})()

// Listen to the app_home_opened event, and when received, respond with a message including the user being messaged
app.event('app_home_opened', async ({ event, say, client, view }) => {
  console.log('⚡️Hello! Someone just opened the app to DM so we will send them a message!')
  say(`Hello world and <@${event.user}>! `)
  
  try {
    /* view.publish is the method that your app uses to push a view to the Home tab */
    await client.views.publish({

      /* the user that opened your app's app home */
      user_id: event.user,

      /* the view object that appears in the app home*/
      view: {
        "type": "home",
        "blocks": [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "Device: Device1",
              "emoji": true
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Status:*\n Online"
              },
              {
                "type": "mrkdwn",
                "text": "*Frequency:*\n 14 samples per Minute\n\n"
              }
            ]
          },
          {
            "type": "divider"
          },
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "Device: Device2",
              "emoji": true
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Status:*\n Offline"
              },
              {
                "type": "mrkdwn",
                "text": "*Frequency:*\n 10 samples per Minute\n\n"
              }
            ]
          }
        ]
      }
    })
  }

  catch (error) {
    console.error(error);
  }

})
