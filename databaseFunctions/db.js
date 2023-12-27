const { MongoClient } = require('mongodb');
const bcrypt = require ('bcryptjs');


const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, PATCH, POST, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Allow-Methods',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

const connectToDatabase = async () => {
  const uri = 'mongodb+srv://bgilb33:GbGb302302!@labsensordb.drzhafh.mongodb.net/labsensordb?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    return client.db(); // Return the database from the connection
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const getCollection = (db, collectionName) => {
  return db.collection(collectionName);
};

const initializeLabs = async (db) => {
  const labCollection = getCollection(db, 'labCollection');

  try {
    const count = await labCollection.countDocuments();

    if (count === 0) {
      const salt = bcrypt.genSaltSync(10);
      let password1 = bcrypt.hashSync("pi4life", salt);
      let password2 = bcrypt.hashSync("password2", salt);

      const labs = [
        {
          "labID": 1,
          "password": password1,
          "name": "nia lab",
          "api": "nialab",
        },
        {
          "labID": 2,
          "password": password2,
          "name": "little lab",
          "api": "littlelab",
        },
      ];

      labs.forEach((lab) => {
        console.log(`Lab ${lab.labID} hashed password: `, lab.password);
      });

      const result = await labCollection.insertMany(labs);
      return result;
    } else {
      return "Result is not empty";
    }
  } catch (err) {
    console.error(err);
    return err;
  }
};

// Implemented ✅
const login = async (db, username, password) => {
  let response;
  const labCollection = getCollection(db, 'labCollection');

  try {
    const lab = await labCollection.findOne({ name: username });

    if (!lab) {
      console.log("User not found");
      response = {
        success: false,
        api: null,
        message: 'Login failed - User not found',
      };
      return response;
    }

    console.log("Password from frontend: ", password);
    console.log("Hashed Password in database: ", lab.password);

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
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  const MAC = inputObject.MAC;
  const IP = inputObject.IP;


  try {
    // Check if a device with the same MAC address already exists
    const existingDevice = await configCollection.findOne({ MAC: inputObject.MAC });

    if (existingDevice) {
      response = { 
        success: false, 
        message: 'Device with the same MAC address already exists',
        data: {
          DeviceID: existingDevice.DeviceID,
          Frequency: existingDevice.Frequency,
          Units: existingDevice.Units
        }
      };
      return response;
    }

    // Asynchronously get the count for the new DeviceID
    const index = await dataCollection.countDocuments() + 1;

    const currentTime = Math.floor(new Date().getTime() / 1000);
    

    const dataObject = {
      "DeviceID": index,
      "DeviceName": `Device ${index}`,
      "Temperature": 0,
      "Humidity": 0,
      "Time": currentTime
    };

    const configObject = {
      "DeviceID": index,
      "DeviceName": `Device ${index}`,
      "Frequency": 10,
      "Units": "Minute",
      "MAC": MAC,
      "IP": IP
    };

    // Use insertOne to get detailed result information
    const dataResult = await dataCollection.insertOne(dataObject);
    const configResult = await configCollection.insertOne(configObject);

    // Check if both insertions are acknowledged
    if (dataResult.acknowledged && configResult.acknowledged) {
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
// Need to add logic that clears out older data from historicalCollection
const updateDeviceData = async (db, labApi, dataObject) => {
  let response;
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const historicalCollection = getCollection(db, `${labApi}_historicalCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const currentTime = Math.floor(new Date().getTime() / 1000); // Current time in epoch format

    // Check if historical collection exists for the current device
    // Check if historical collection exists for the current device
    const historicalDataExists = await historicalCollection.countDocuments({ DeviceID: dataObject.DeviceID }) > 0;

    if (!historicalDataExists) {
      // If historical data doesn't exist for the current device, insert data into historical collection
      await historicalCollection.insertOne({ ...dataObject, Time: currentTime });
    } else {
      // Retrieve the most recent data from historical collection
      const mostRecentData = await historicalCollection
        .find({ DeviceID: dataObject.DeviceID })
        .sort({ Time: -1 })
        .limit(1)
        .toArray();

      const lastDataTime = mostRecentData.length > 0 ? mostRecentData[0].Time : 0;

      // Insert data into historical collection if it's been 15 minutes since the last data
      if ((currentTime - lastDataTime) >= 120) {
        console.log("Instering")
        
        await historicalCollection.insertOne({ ...dataObject, Time: currentTime });
      }
      else {
        console.log("Not Inserting");
        console.log(currentTime - lastDataTime)
      }
    }


    // Update or insert data into data collection
    const dataResult = await dataCollection.updateOne(
      { DeviceID: dataObject.DeviceID },
      { $set: { Temperature: dataObject.Temperature, Humidity: dataObject.Humidity, Time: currentTime } },
      { upsert: true } // Create a new document if it doesn't exist
    );

    // Check if the update is acknowledged
    if (dataResult.matchedCount > 0 || dataResult.upsertedCount > 0) {

      // Checking alarm status
      const alarms = await alarmCollection.find({ DeviceID: dataObject.DeviceID }).toArray();
      for (const alarm of alarms) {
        if (isAlarmTriggered(dataObject, alarm)) {
          // Alarm is triggered
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Triggered" } }
          );
        } else {
          // Alarm is not triggered
          await alarmCollection.updateOne(
            { AlarmID: alarm.AlarmID },
            { $set: { Status: "Not Triggered" } }
          );
        }
      }
      response = {
        success: true,
        message: "Device data and alarms updated successfully",
        data: null
      };
    } else {
      // Provide more information in case of an issue
      response = {
        success: false,
        message: "Update not acknowledged",
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
};

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
    // Return an empty array if no data is found
    response = {
      success: true,
      message: "Fetched all home page data",
      data: data || []
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
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const { _id, ...updatedFields } = deviceConfig;

  try {
    // Update in configCollection
    const configResult = await configCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: updatedFields });

    // Update in dataCollection
    const dataResult = await dataCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    // Update in alarmCollection
    const alarmResult = await alarmCollection.updateMany({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    // Check if all updates are acknowledged
    if (configResult.matchedCount > 0 && dataResult.matchedCount > 0) {
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

// udpdate this so test and nialab_configuration  is not hard coded
const fetchDataFromMongoDB = async () => {
  const filter = {};
  const projection = {
    'DeviceName': 1,
    'Frequency': 1,
    'Units': 1,
    '_id': 0
  };

  const client = await MongoClient.connect(
    'mongodb+srv://bgilb33:GbGb302302!@labsensordb.drzhafh.mongodb.net/?retryWrites=true&w=majority'
  );

  try {
    const coll = client.db('test').collection('nialab_configCollection');
    const cursor = coll.find(filter, { projection });
    const result = await cursor.toArray();
    return result;
  } finally {
    await client.close();
  }
}

module.exports = {
  connectToDatabase,
  initializeLabs,
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
  fetchDataFromMongoDB,
  headers,
  getAllHistoricalDataForDevice
};
