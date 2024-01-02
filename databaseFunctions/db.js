const { MongoClient } = require('mongodb');
const bcrypt = require ('bcryptjs');

const accountSid = 'ACab8799e29a7be958d0bbef422d874e6a';
const authToken = '50bebb3a6d20ba5b449c644d1de5df54';
// const twilio = require('twilio')(accountSid, authToken);

//MQTT DEFS
const mqtt = require('mqtt');
const readline = require('readline');

const fs = require('fs')
const protocol = 'mqtts'
// Set the host and port based on the connection information.
const host = 'u88196e4.ala.us-east-1.emqxsl.com'
const port = '8883'
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`
const connectUrl = `${protocol}://${host}:${port}`

const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: 'mqttservice',
  password: 'password3',
  reconnectPeriod: 1000,
  // If the server is using a self-signed certificate, you need to pass the CA.
  // ca: fs.readFileSync('./broker.emqx.io-ca.crt'),
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
      console.log("CACHE")
      return cachedDb;
    }
    const uri = 'mongodb+srv://bgilb33:GbGb302302!@labsensordb.drzhafh.mongodb.net/labsensordb?retryWrites=true&w=majority';
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
      // await twilio.messages
      // .create({
      //     body: returnString,
      //     from: '+18557298429',
      //     to: `${lab.phoneNumber}`
      // })
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
          Status: existingDevice.Status
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
      Time: currentTime,
      Status: "Online",
      Frequency: 10,
      Units: "Minute",
      MAC: MAC,
      IP: IP
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
          Units: "Minute"
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
      { $set: { Temperature: dataObject.Temperature, Humidity: dataObject.Humidity, Time: dataObject.Time } },
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

    if ((dataObject.Time - lastDataTime) >= 120) {
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

const checkDeviceAlarmStatus = async(db, labApi, dataObject) => {
  let response;
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const alarms = await alarmCollection.find({ DeviceID: dataObject.DeviceID }).toArray();
      for (const alarm of alarms) {
        if (isAlarmTriggered(dataObject, alarm)) {
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Triggered" } }
          );
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
      return checkTemperatureAlarm(dataObject.Temperature, alarm.Threshold, alarm.Compare);
    case "Humidity":
      return checkHumidityAlarm(dataObject.Humidity, alarm.Threshold, alarm.Compare)
    default:
      return false;
  }
};

// Function to check temperature alarm
const checkTemperatureAlarm = (currentTemperature, threshold, compare) => {
  switch (compare) {
    case ">":
      return currentTemperature > threshold;
    case "<":
      return currentTemperature < threshold;
    default:
      return false;
  }
};

const checkHumidityAlarm = (currentHumidity, threshold, compare) => {
  switch (compare) {
    case ">":
      return currentHumidity > threshold;
    case "<":
      return currentHumidity < threshold;
    default:
      return false;
  }
};

// Implemented ✅
// OUTDATED
const updateDeviceData = async (db, labApi, dataObject) => {
  try {
    console.log("Start updateDeviceData");

    const dataCollection = getCollection(db, `${labApi}_dataCollection`);
    const historicalCollection = getCollection(db, `${labApi}_historicalCollection`);
    const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

    // const currentTime = Math.floor(new Date().getTime() / 1000);

    console.log("Checking historical data");
    const historicalDataExists = await historicalCollection.countDocuments({ DeviceID: dataObject.DeviceID }) > 0;

    if (!historicalDataExists) {
      console.log("Inserting into historical collection");
      await historicalCollection.insertOne({ ...dataObject, Time: currentTime });
    } else {
      console.log("Retrieving most recent data");
      const mostRecentData = await historicalCollection
        .find({ DeviceID: dataObject.DeviceID })
        .sort({ Time: -1 })
        .limit(1)
        .toArray();

      const lastDataTime = mostRecentData.length > 0 ? mostRecentData[0].Time : 0;

      if ((currentTime - lastDataTime) >= 120) {
        console.log("Inserting into historical collection");
        await historicalCollection.insertOne({ ...dataObject, Time: currentTime });
      } else {
        console.log("Not Inserting");
        console.log(currentTime - lastDataTime);
      }
    }

    console.log("Updating or inserting data into data collection");
    const dataResult = await dataCollection.updateOne(
      { DeviceID: dataObject.DeviceID },
      { $set: { Temperature: dataObject.Temperature, Humidity: dataObject.Humidity, Time: currentTime } },
      { upsert: true }
    );

    if (dataResult.matchedCount > 0 || dataResult.upsertedCount > 0) {
      console.log("Checking alarm status");

      const alarms = await alarmCollection.find({ DeviceID: dataObject.DeviceID }).toArray();
      for (const alarm of alarms) {
        if (isAlarmTriggered(dataObject, alarm)) {
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Triggered" } }
          );
        } else {
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Not Triggered" } }
          );
        }
      }

      console.log("Device data and alarms updated successfully");
      return { success: true, message: "Device data and alarms updated successfully", data: null };
    } else {
      console.log("Update not acknowledged");
      return { success: false, message: "Update not acknowledged", data: null };
    }
  } catch (err) {
    console.error(`Failed to update device data with error: ${err}`);
    return { success: false, message: `Failed to update device data with error: ${err}`, data: null };
  }
};

// Implemented ✅
// No need once tables are combined, use getAllHomePageData instead
const getAllConfigData = async (db, labApi) => {
  let response;
  const configCollection = getCollection(db, `${labApi}_configCollection`);

  try {
    const config = await configCollection.find({}).toArray();
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
    const data = await dataCollection.find({}).toArray();

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
      .project({ Temperature: 1, Humidity: 1, Time: 1, _id: 0 })
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
    const dataResult = await dataCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName, Frequency: deviceConfig.Frequency, Units: deviceConfig.Units } });

    // Update in alarmCollection
    await alarmCollection.updateMany({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    // Check if all updates are acknowledged
    if (dataResult.matchedCount > 0) {
      sendMQTTConfigMessage(labApi, deviceConfig.DeviceID, deviceConfig.Frequency, deviceConfig.Units);
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
    sendMQTTStatusMessage(labApi);
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

function sendMQTTStatusMessage(lab){
  topic = lab + "/STATUS/OUT";
  const statusOutMessage = "STATUS";
  // Publish the user's message to a topic
  client.publish(topic, statusOutMessage, (err) => {
  if (!err) {
      console.log(`Published message to ${topic}: ${statusOutMessage}`);
  } else {
      console.error(`Error publishing message: ${err}`);
  }

  console.log();
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
  updateDeviceData,
  updateRecentDeviceData,
  updateHistoricalDeviceData,
  checkDeviceAlarmStatus,
  headers,
  getAllHistoricalDataForDevice,
  createLab,
  sendDeviceRefresh,
  updateManyDeviceStatus
};
