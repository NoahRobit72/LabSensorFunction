const { MongoClient } = require('mongodb');
const bcrypt = require ('bcryptjs');
require('dotenv').config();
const axios = require('axios');

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const slackWebhookURL = process.env.MSGWEBHOOK;
//MQTT DEFS
const mqtt = require('mqtt');

const protocol = 'mqtts'
// Set the host and port based on the connection information.
const host = process.env.MQTTHOST
const port = '8883'
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`
const connectUrl = `${protocol}://${host}:${port}`
// const caFilePath = path.resolve(__dirname, '../certificates/broker.emqx.io-ca.crt');

const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: 'mqttservice',
  password: 'password3',
  reconnectPeriod: 1000,
  // If the server is using a self-signed certificate, you need to pass the CA.
  // ca: fs.readFileSync(caFilePath),
})


const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Allow-Methods',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

let cachedClient = null;
let cachedDb = null;


const connectToDatabase = async () => {
  try {
    if (cachedDb && cachedClient) {
      return cachedDb;
    }
    const uri = process.env.DBURI;
    const client = new MongoClient(uri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true, 
      maxPoolSize: 10,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxIdleTimeMS: 30000
    });

    await client.connect();
    cachedClient = client;
    cachedDb = client.db(); // Return the database from the connection
    return cachedDb;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const getCollection = (db, collectionName) => {
  return db.collection(collectionName);
};

// Implemented ✅
// Need to encrypt labApi, but keep it shorter and in a format to pass as query parameter (no bcrypt)
const createLab = async (db, inputObject) => {
  let response;
  if (inputObject.adminPassword != "pi4life&noah!Benji123") {
    console.log("Incorrect key");
    response = {
      success: false,
      message: "Incorrect admin key",
      data: null
    }
    return response;
  }
  const labCollection = getCollection(db, 'labCollection');

  try {
    const existingLab = await labCollection.findOne({ labName: inputObject.labName });

    if (existingLab) {
      response = {
        success: false,
        message: `Lab with name ${inputObject.labName} already exists`,
        data: null
      }
      return response;
    }

    const index = await labCollection.countDocuments() + 1;
    const salt = bcrypt.genSaltSync(10);
    const password = bcrypt.hashSync(inputObject.password, salt);
    // const labApi = bcrypt.hashSync(inputObject.labName, salt);

    const lab = {
      labID: index,
      labName: inputObject.labName,
      password: password,
      api: inputObject.labName.replace(/ /g,''),
      email: inputObject.email,
      phoneNumber: inputObject.phoneNumber
    }

    const inputResult = await labCollection.insertOne(lab);

    if (inputResult.acknowledged) {
      response = {
        success: true,
        message: `Successfully created lab with ID ${index}`,
        data: {
          api: lab.api
        }
      }

      const returnString = `Hello ${lab.labName}! Welcome to LabSensors. For next steps, click here ...!`
      //Uncomment when get numbers verified
      await twilio.messages
      .create({
          body: returnString,
          from: '+18557298429',
          to: `${lab.phoneNumber}`
      })
    }

  } catch (err) {
    response = {
      success: false,
      message: `Failed to initialize lab with error: ${err}`,
      data: null
    }
  }
  return response;
}

// Implemented ✅
const login = async (db, username, password) => {
  let response;
  const labCollection = getCollection(db, 'labCollection');

  try {
    const lab = await labCollection.findOne({ labName: username });

    if (!lab) {
      console.log("User not found");
      response = {
        success: false,
        api: null,
        message: 'Login failed - User not found',
      };
      return response;
    }

    const isPasswordMatch = await bcrypt.compare(password.trim(), lab.password.trim());

    if (isPasswordMatch) {
      console.log("Password comparison successful");
      response = {
        success: true,
        api: lab.api,
        message: "Login Successful",
      };
    } else {
      console.log("Password comparison failed");
      response = {
        success: false,
        api: null,
        message: 'Login failed - Password mismatch',
      };
    }
  } catch (err) {
    console.error("Error during login:", err);
    response = {
      success: false,
      api: null,
      message: 'Login failed - Internal error',
    };
  }
  return response;
};

// Implemented ✅
const addDevice = async (db, labApi, inputObject) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  const MAC = inputObject.MAC;
  const IP = inputObject.IP;


  try {
    // Check if a device with the same MAC address already exists
    const existingDevice = await dataCollection.findOne({ MAC: inputObject.MAC });

    if (existingDevice) {
      response = { 
        success: true, 
        message: 'Device with the same MAC address already exists',
        data: {
          DeviceID: existingDevice.DeviceID,
          Frequency: existingDevice.Frequency,
          Units: existingDevice.Units,
          Status: existingDevice.Status,
          SendData: existingDevice.SendData
        }
      };
      return response;
    }

    // Asynchronously get the count for the new DeviceID
    const index = await dataCollection.countDocuments() + 1;

    const currentTime = Math.floor(new Date().getTime() / 1000);
    

    const dataObject = {
      DeviceID: index,
      DeviceName: `Device ${index}`,
      Temperature: 0,
      Humidity: 0,
      CO: 0,
      Alcohol: 0,
      CO2: 0,
      Toluene: 0,
      NH4: 0,
      Acetone: 0,
      Time: currentTime,
      Status: "Online",
      Frequency: 10,
      Units: "Minute",
      MAC: MAC,
      IP: IP,
      Experiment: "",
      SendData: "11111111"
    };

    // Use insertOne to get detailed result information
    const dataResult = await dataCollection.insertOne(dataObject);

    // Check if both insertions are acknowledged
    if (dataResult.acknowledged) {
      response = { 
        success: true, 
        message: `Device added with DeviceID ${index}`, 
        data: {
          DeviceID: index,
          Frequency: 10,
          Units: "Minute",
          SendData: "11111111"
        }
      };
    } else {
      response = { 
        success: false, 
        message: `Failed to add device with MAC: ${inputObject.MAC} and IP ${inputObject.IP}`, 
        data: null
      };
    }
  } catch (err) {
    response = { 
      success: false, 
      message: `Failed to add device with MAC: ${inputObject.MAC} and IP ${inputObject.IP} eith error: ${err}`, 
      data: null
    };
  }
  return response;
};

// Implemented ✅
const updateRecentDeviceData = async (db, labApi, dataObject) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const dataResult = await dataCollection.updateOne(
      { DeviceID: dataObject.DeviceID },
      { $set: { 
        Temperature: dataObject.Temperature, 
        Humidity: dataObject.Humidity,
        CO: dataObject.CO,
        Alcohol: dataObject.Alcohol,
        CO2: dataObject.CO2,
        Toluene: dataObject.Toluene,
        NH4: dataObject.NH4,
        Acetone: dataObject.Acetone,
        Time: dataObject.Time } },
      { upsert: true }
    );

    if (dataResult.matchedCount > 0 || dataResult.upsertedCount > 0) {
      response = { 
        success: true, 
        message: "Device data updated successfully", 
        data: null 
      };
    } else {
      response = { 
        success: false, 
        message: "Failed to update device data", 
        data: null 
      };
    }
  } catch (err) {
    response = { 
      success: false, 
      message: `Failed to update device data with error: ${err}`, 
      data: null 
    };
  }
  return response;
}

// Implemented ✅
const updateHistoricalDeviceData = async (db, labApi, dataObject) => {
 let response;
 const historicalCollection = getCollection(db, `${labApi}_historicalCollection`);
 const historicalDataExists = await historicalCollection.countDocuments({ DeviceID: dataObject.DeviceID }) > 0;

 try {
  if (!historicalDataExists) {
    console.log("Inserting into historical collection");
    await historicalCollection.insertOne({ ...dataObject });

    response = {success: true, message: "Historical data successfully updated", data: null}
    return response;
  } else {
    console.log("Retrieving most recent data");
    const mostRecentData = await historicalCollection
      .find({ DeviceID: dataObject.DeviceID })
      .sort({ Time: -1 })
      .limit(1)
      .toArray();

    const lastDataTime = mostRecentData.length > 0 ? mostRecentData[0].Time : 0;

    if ((dataObject.Time - lastDataTime) >= 180) {
      await historicalCollection.insertOne({ ...dataObject, Time: dataObject.Time });
      response = {success: true, message: "Historical data successfully updated", data: null}
    } else {
      response = {success: true, message: "Historical data not updated due to insufficient time passing", data: null}
    }
  }
 } catch (err) {
  response = {
    success: false, 
    message: `Failed to update historical data with error: ${err}`
  }
 }
 return response;

}

// Update to handle alarms for air quality values
const checkDeviceAlarmStatus = async(db, labApi, dataObject) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const labCollection = getCollection(db, "labCollection");

  try {
    const alarms = await alarmCollection.find({ DeviceID: dataObject.DeviceID }).toArray();
      for (const alarm of alarms) {
        let previousStatus = alarm.Status;
        if (isAlarmTriggered(dataObject, alarm)) {
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Triggered" } }
          );
          
          // SEND TEXT
          if (previousStatus == 'Not Triggered') {
            console.log(`SLACK URL: ${slackWebhookURL}`)
            const lab = await labCollection.findOne({api: labApi});
            const compare = alarm.Compare == '>' ? 'above' : 'below';
            const returnString = `ALERT ${lab.labName}! Device ${alarm.DeviceName}'s ${alarm.SensorType} has gone ${compare} the threshold of ${alarm.Threshold}`

            // Sending Text
            await twilio.messages
            .create({
                body: returnString,
                from: '+18557298429',
                to: `${lab.phoneNumber}`
            })

            let slackResponse = await axios.post(slackWebhookURL, {
              text: returnString,
            }, {
            headers: {
              'Content-type': 'application/json',
                },
            });
            console.log(`Slack API Return: ${slackResponse}`)
          
          }
          
        } else {
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Not Triggered" } }
          );
        }
      }
      response = {
        success: true,
        message: "Alarms successfully updated",
        data: null
      }
  } catch (err) {
    response = {
      success: false,
      message: `Alarms failed to update with error: ${err}`,
      data: null
    }
  }
  return response;
}

// All three below are helper functions for updateDeviceData
// Function to check if an alarm is triggered based on device data
const isAlarmTriggered = (dataObject, alarm) => {
  switch (alarm.SensorType) {
    case "Temperature":
      return checkAlarm(dataObject.Temperature, alarm.Threshold, alarm.Compare);
    case "Humidity":
      return checkAlarm(dataObject.Humidity, alarm.Threshold, alarm.Compare);
    case "CO":
      return checkAlarm(dataObject.CO, alarm.Threshold, alarm.Compare);
    case "Alcohol":
      return checkAlarm(dataObject.Alcohol, alarm.Threshold, alarm.Compare);
    case "CO2":
      return checkAlarm(dataObject.CO2, alarm.Threshold, alarm.Compare);
    case "Toluene":
      return checkAlarm(dataObject.Toluene, alarm.Threshold, alarm.Compare);
    case "NH4":
      return checkAlarm(dataObject.NH4, alarm.Threshold, alarm.Compare);
    case "Acetone":
      return checkAlarm(dataObject.Acetone, alarm.Threshold, alarm.Compare);
    default:
      return false;
  }
};

const checkAlarm = (currentValue, threshold, compare) => {
  switch (compare) {
    case ">":
      return currentValue > threshold;
    case "<":
      return currentValue < threshold;
    default:
      return false;
  }
};


// Implemented ✅
const getAllConfigData = async (db, labApi) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const config = await dataCollection.find({})
    .project({ 
      DeviceID: 1,
      DeviceName: 1,
      Status: 1,
      Frequency: 1,
      Units: 1,
      MAC: 1,
      IP: 1,
      Experiment: 1,
      SendData: 1,
      _id: 0 })
      .toArray();
    response = {
      success: true,
      message: "Fetched all config data",
      data: config || []
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to fetch config data with error: ${err}`,
      data: null
    }
  }
  return response;
};

// Implemented ✅
const getAllHomePageData = async (db, labApi) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const data = await dataCollection.find({})
      .project({ 
        DeviceID: 1,
        DeviceName: 1,
        Temperature: 1, 
        Humidity: 1,
        CO: 1,
        Alcohol: 1,
        CO2: 1,
        Toluene: 1,
        NH4: 1,
        Acetone: 1, 
        Time: 1,
        Status: 1,
        SendData: 1,
        Experiment: 1,
        _id: 0 }) 
      .toArray();

    // Sort the data by status: "Online" first, "Offline" after
    const sortedData = data.sort((a, b) => {
      // Assuming "Status" is a property in your data objects
      const statusOrder = { Online: 0, Offline: 1 };

      // Compare the status of two data objects
      return statusOrder[a.Status] - statusOrder[b.Status];
    });

    // Return an empty array if no data is found
    response = {
      success: true,
      message: "Fetched all home page data",
      data: sortedData || []
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to fetch homepage data with error: ${err}`,
      data: null
    }
  }
  return response;
};


const getAllHistoricalDataForDevice = async (db, labApi, deviceID) => {
  const historicalCollection = getCollection(db, `${labApi}_historicalCollection`);
  const parsedDeviceID = parseInt(deviceID, 10);

  try {
    const historicalData = await historicalCollection
      .find({ DeviceID: parseInt(parsedDeviceID) })
      .sort({ Time: 1 }) // Sort by Time in ascending order
      .project({ 
        Temperature: 1, 
        Humidity: 1,
        CO: 1,
        Alcohol: 1,
        CO2: 1,
        Toluene: 1,
        NH4: 1,
        Acetone: 1, 
        Time: 1,
        _id: 0 })
      .toArray();

    return {
      success: true,
      message: `Fetched all historical data for DeviceID ${deviceID}`,
      data: historicalData || [],
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to fetch historical data for DeviceID ${deviceID} with error: ${err}`,
      data: null,
    };
  }
};

// Implemented ✅
const getAllAlarmData = async (db, labApi) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const alarmData = await alarmCollection.find({}).toArray();
    response = {
      success: true,
      message: "Fetched all alarms from alarmCollection",
      data: alarmData || []
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to fetch homepage data with error: ${err}`,
      data: null
    }
  }
  return response;
};

// Implemented ✅
const editDeviceConfig = async (db, labApi, deviceConfig) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const dataResult = await dataCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName, Frequency: deviceConfig.Frequency, Units: deviceConfig.Units, Experiment: deviceConfig.Experiment, SendData: deviceConfig.SendData } });

    // Update in alarmCollection
    await alarmCollection.updateMany({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    // Check if all updates are acknowledged
    if (dataResult.matchedCount > 0) {
      let topic = `${labApi}/CONFIG`;
      let message = deviceConfig.DeviceID.toString() + " " + deviceConfig.Frequency.toString() + " " + deviceConfig.Units + " " + deviceConfig.SendData;
      sendMQTTMessage(topic, message);
      response = {
        success: true,
        message: "Successfully updated device config",
        data: null
      }
    } else {
      response = {
        success: false,
        message: "Failed to update device config",
        data: null
      }
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to update device config with error: ${err}`,
      data: null
    }
  }
  return response;
};

const sendMQTTMessage = async (topic, message) => {
  return new Promise((resolve, reject) => {
    client.publish(topic, message, (err) => {
      if (!err) {
        console.log(`Published message to ${topic}: ${message}`);
        const response = {
          success: true,
          message: "Successfully sent MQTT message",
          data: null
        };
        console.log("RESPONSE IN: ", response);
        resolve(response);
      } else {
        console.error(`Error publishing message: ${err}`);
        const response = {
          success: false,
          message: `Failed to send MQTT message with error: ${err}`,
          data: null
        };
        reject(response);
      }
    });
  });
};


// Function to update device config via the broker
function sendMQTTConfigMessage(lab, deviceID, Frequency, Units){
  message = deviceID.toString() + " " + Frequency.toString() + " " + Units;


  topic = lab + "/CONFIG"
  // Publish the user's message to a topic
  client.publish(topic, message, (err) => {
  if (!err) {
      console.log(`Published message to ${topic}: ${message}`);
  } else {
      console.error(`Error publishing message: ${err}`);
  }

  console.log();
  });
}

// Implemented ✅
const removeDevice = async (db, labApi, deviceID) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const device = await dataCollection.findOne({ DeviceID: parseInt(deviceID) });

    if (!device) {
      response = {
        success: false,
        message: `Device with DeviceID ${deviceID} not found`,
        data: null
      }
      return response;
    }

    const { _id } = device;

    // Remove device from dataCollection
    const dataRemoveResult = await dataCollection.deleteOne({ _id });

    // Remove device from configCollection
    const configRemoveResult = await configCollection.deleteOne({ DeviceID: parseInt(deviceID) });

    // Remove associated alarms from alarmCollection
    await alarmCollection.deleteMany({ DeviceID: parseInt(deviceID) });

    if (dataRemoveResult.deletedCount > 0 && configRemoveResult.deletedCount > 0) {
      response = {
        success: true,
        message: `Removed device with DeviceID ${deviceID}`,
        data: null
      }
    } else {
      response = {
        success: false,
        message: `Deletion not acknowledged`,
        data: null
      }
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to delete device with DeviceID ${deviceID}`,
      data: null
    }
  }
  return response;
};

// Implemented ✅
const addAlarm = async (db, labApi, alarmObject) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const { DeviceName, ...restAlarm } = alarmObject;

    // Find DeviceID based on DeviceName
    const device = await dataCollection.findOne({ DeviceName });

    if (!device) {
      response = {
        success: false,
        message: `Device with DeviceName ${DeviceName} not found`,
        data: null
      }
      return response;
    }

    const { DeviceID } = device;

    // Add DeviceID and DeviceName to the alarmObject
    const alarmToAdd = { DeviceID, DeviceName, ...restAlarm, Status: "Not Triggered" };

    // Find the last alarm to determine the new AlarmID
    const lastAlarm = await alarmCollection.find({}).sort({ AlarmID: -1 }).limit(1).toArray();
    alarmToAdd.AlarmID = lastAlarm.length > 0 ? lastAlarm[0].AlarmID + 1 : 1;

    await alarmCollection.insertOne(alarmToAdd);
    response = {
      success: true,
      message: 'Alarm added to alarmCollection',
      data: null
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to add alarm with error: ${err}`,
      data: null
    }
  }
  return response;
};

// Kinda implemented, but don't think we need this function anyways
const editAlarm = async (db, labApi, updatedAlarm) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const { AlarmID, _id, ...updatedFields } = updatedAlarm; // Exclude _id from update

  try {
    const result = await alarmCollection.updateOne({ AlarmID }, { $set: updatedFields });

    if (result.modifiedCount === 0) {
      response = {
        success: false,
        message: `Alarm with AlarmID ${AlarmID} not found`,
        data: null
      }
    } else {
      response = {
        success: true,
        message: `Alarm with AlarmID ${AlarmID} updated successfully`,
        data: null
      }
    }
  } catch (err) {
    response = {
      success: false,
      message: `Alarm not updated with error: ${err}`,
      data: null
    }
  }
  return response;
}

// Implemented ✅
const removeAlarm = async (db, labApi, alarmID) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const parsedAlarmID = parseInt(alarmID, 10);

  try {
    const result = await alarmCollection.deleteOne({ "AlarmID": parsedAlarmID });

    if (result.deletedCount === 0) {
      response = {
        success: false,
        message: `Alarm with AlarmID ${parsedAlarmID} not found`,
        data: null
      }
    } else {
      response = {
        success: true,
        message: `Alarm with AlarmID ${parsedAlarmID} removed successfully`,
        data: null
      }
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to delete alarm with error: ${err}`,
      data: null
    }
  }
  return response;
};

// Implemented ✅
const sendDeviceRefresh = async(labApi) => {
  let response;
  try {    
    let topic = `${labApi}/STATUS/OUT`;
    let message = "STATUS";
    sendMQTTMessage(topic, message);
    response = {
      success: true,
      message: "Successfully sent message to MQTT broker to check device status",
      data: null
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to send message to MQTT broker with error: ${err}`,
      data: null
    }
  }
  return response;
}

// Implemented ✅
const updateManyDeviceStatus = async(db, labApi, devices) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {  
    const updateOffline = await dataCollection.updateMany(
      { DeviceID: { $nin: devices } }, // Devices NOT in the provided list
      { $set: { Status: "Offline" } }
    );
    const updateOnline = await dataCollection.updateMany(
      { DeviceID: { $in: devices } }, // Devices in the provided list
      { $set: { Status: "Online" } }
    );
  
    if (updateOnline.acknowledged && updateOffline.acknowledged) {
      response = {
        success: true,
        message: "Updated device status for multiple devices",
        data: null
      }
    }
    else {
      response = {
        success: false,
        message: "Failed to updatedevice status for multiple devices",
        data: null
      }
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to updatedevice status for multiple devices with error: ${err}`,
      data: null
    }
  }
  return response;
}


const getSlackConfigData = async(db) => {
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
  
    return response;
  } catch (error) {
    console.error('Error fetching data:', error);
    return error;
  }
};

function generateMultilineString(data) {
  let result = "";

  data.forEach(device => {
    result += `*Device Name:* ${device.DeviceName}\n`;
    result += `*Device Status:* ${device.Status}\n`;
    result += `*Frequency:* ${device.Frequency} samples per ${device.Units}\n\n`;
  });

  return result;
}



const getAIInput = async(db, labApi, deviceID) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const historicalCollection = getCollection(db, `${labApi}_historicalCollection`);

  try {
    const dataResponse = await dataCollection.findOne({ DeviceID: parseInt(deviceID) });
    const historicalData = await historicalCollection.find({ DeviceID: parseInt(deviceID) }).toArray();

    if (!dataResponse || historicalData.length === 0) {
      response = { success: false, message: `No sufficient data found for device ${deviceID}`, data: null };
      return response;
    }

    const historicalDataAsString = historicalData.map(dataPoint => JSON.stringify(dataPoint)).join(', ');
    const input = `Experiment Summary: ${dataResponse.Experiment}. Data over time: ${historicalDataAsString}`.toString();

    response = {
      success: true,
      message: "Successfully received input for AI Analysis",
      data: input
    }
  } catch (err) {
    response = {
      success: false,
      message: `Failed to receive input for AI Analysis with error ${err}`,
      data: null
    }
  }
  return response;
}

function sendMQTTStatusMessage(lab){
  topic = lab + "/STATUS/OUT";
  const statusOutMessage = "STATUS";
  // Publish the user's message to a topic
  client.publish(topic, statusOutMessage, (err) => {
  if (!err) {
      console.log(`Published message to ${topic}: ${statusOutMessage}`);
  } else {
      console.error(`Error publishing message: ${err}`);
      throw err;
  }
  });
}

module.exports = {
  connectToDatabase,
  login,
  getCollection,
  getAllConfigData,
  editDeviceConfig,
  getAllAlarmData,
  removeDevice,
  getAllHomePageData,
  addAlarm,
  editAlarm,
  removeAlarm,
  addDevice,
  updateRecentDeviceData,
  updateHistoricalDeviceData,
  checkDeviceAlarmStatus,
  headers,
  getAllHistoricalDataForDevice,
  createLab,
  sendDeviceRefresh,
  updateManyDeviceStatus,
  sendMQTTMessage,
  getAIInput,
  getSlackConfigData
};
