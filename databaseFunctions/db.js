const { MongoClient } = require('mongodb');

const connectToDatabase = async () => {
  const uri = 'mongodb+srv://bgilb33:GbGb302302!@labsensordb.drzhafh.mongodb.net/?retryWrites=true&w=majority';
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

const initializeLabs = async (db, callback) => {
  const labCollection = getCollection(db, 'labCollection');

  try {
    const count = await labCollection.countDocuments();

    if (count === 0) {
      const labs = [
        {
          "labID": 1,
          "password": "pi4life",
          "name": "nia lab",
          "api": "nialab"
        },
        {
          "labID": 2,
          "password": "password2",
          "name": "little lab",
          "api": "littlelab"
        }
      ];

      const result = await labCollection.insertMany(labs);
      callback(null, result);
    } else {
      callback(null, 'Collection is not empty');
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

const login = async (db, username, password) => {
    const labCollection = getCollection(db, 'labCollection');
  
    try {
      const lab = await labCollection.findOne({ name: username, password: password });
  
      if (lab) {
        return { success: true, api: lab.api, message: 'Login successful' };
      } else {
        return { success: false, message: 'Login failed' };
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
  

//Input Body: 
// {
//   MAC: "mac",
//   IP: "ip",
//   Time: 1387294820
// }
const addDevice = async (db, labApi, inputObject, callback) => {
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    // Check if a device with the same MAC address already exists
    const existingDevice = await configCollection.findOne({ MAC: inputObject.MAC });

    if (existingDevice) {
      callback(null, { 
        success: false, 
        message: 'Device with the same MAC address already exists', 
        DeviceID: existingDevice.DeviceID,
        Frequency: existingDevice.Frequency,
        Units: existingDevice.Units
      });
      return;
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
      "MAC": inputObject.MAC,
      "IP": inputObject.IP
    };

    // Use insertOne to get detailed result information
    const dataResult = await dataCollection.insertOne(dataObject);
    const configResult = await configCollection.insertOne(configObject);

    // Check if both insertions are acknowledged
    if (dataResult.acknowledged && configResult.acknowledged) {
      callback(null, { 
        success: true, 
        message: `Device added with DeviceID ${index}`, 
        DeviceID: index,
        Frequency: 10,
        Units: "Minute"
      });
    } else {
      // Provide more information in case of an issue
      callback("Insertion not acknowledged", null);
    }
  } catch (err) {
    console.log(err);
    callback(err, null);
  }
};



const updateDeviceData = async (db, labApi, dataObject, callback) => {
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    // const currentTime = Math.floor(new Date().getTime() / 1000); // Current time in epoch format

    // Update in dataCollection
    const dataResult = await dataCollection.updateOne(
      { DeviceID: dataObject.DeviceID },
      { $set: { Temperature: dataObject.Temperature, Humidity: dataObject.Humidity, Time: dataObject.Time } }
    );

    // Check if the update is acknowledged
    if (dataResult.matchedCount > 0) {
      // Check and update alarms
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

      callback(null, 'Device data and alarms updated successfully');
    } else {
      // Provide more information in case of an issue
      callback('Update not acknowledged', null);
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

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

const getAllConfig = async (db, labApi, callback) => {
  const configCollection = getCollection(db, `${labApi}_configCollection`);

  try {
    const config = await configCollection.find({}).toArray();

    // Return an empty array if no data is found
    callback(null, config || []);
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

const getAllHomePageData = async (db, labApi, callback) => {
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const data = await dataCollection.find({}).toArray();

    // Return an empty array if no data is found
    callback(null, data || []);
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

const getAllAlarms = async (db, labApi, callback) => {
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const alarmData = await alarmCollection.find({}).toArray();
    callback(null, alarmData);
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

// NEED TO UPDATE NAME IN DATA COLLECTION AS WELL

const editDeviceConfig = async (db, labApi, deviceConfig, callback) => {
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const { _id, ...updatedFields } = deviceConfig;

  try {
    // Update in configCollection
    const configResult = await configCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: updatedFields });

    console.log("configResult:", configResult);

    // Update in dataCollection
    const dataResult = await dataCollection.updateOne({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    console.log("dataResult:", dataResult);

    // Update in alarmCollection
    const alarmResult = await alarmCollection.updateMany({ DeviceID: deviceConfig.DeviceID }, { $set: { DeviceName: deviceConfig.DeviceName } });

    console.log("alarmResult:", alarmResult);

    // Check if all updates are acknowledged
    if (configResult.matchedCount > 0 && dataResult.matchedCount > 0) {
      callback(null, 'Device config, name, and alarms updated successfully');
    } else {
      // Provide more information in case of an issue
      callback("Update not acknowledged", null);
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
};


const removeDevice = async (db, labApi, deviceID, callback) => {
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);
  const configCollection = getCollection(db, `${labApi}_configCollection`);
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);

  try {
    const device = await dataCollection.findOne({ DeviceID: parseInt(deviceID) });

    if (!device) {
      callback(null, `Device with DeviceID ${deviceID} not found`);
      return;
    }

    const { _id } = device;

    // Remove device from dataCollection
    const dataRemoveResult = await dataCollection.deleteOne({ _id });

    // Remove device from configCollection
    const configRemoveResult = await configCollection.deleteOne({ DeviceID: parseInt(deviceID) });

    // Remove associated alarms from alarmCollection
    const alarmsRemoveResult = await alarmCollection.deleteMany({ DeviceID: parseInt(deviceID) });

    if (dataRemoveResult.deletedCount > 0 && configRemoveResult.deletedCount > 0) {
      callback(null, `Device with DeviceID ${deviceID} removed from dataCollection, configCollection, and ${alarmsRemoveResult.deletedCount} alarms removed from alarmCollection`);
    } else {
      callback('Deletion not acknowledged', null);
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
};


const addAlarm = async (db, labApi, alarmObject, callback) => {
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const dataCollection = getCollection(db, `${labApi}_dataCollection`);

  try {
    const { DeviceName, ...restAlarm } = alarmObject;

    // Find DeviceID based on DeviceName
    const device = await dataCollection.findOne({ DeviceName });

    if (!device) {
      return callback(null, `Device with DeviceName ${DeviceName} not found`);
    }

    const { DeviceID } = device;

    // Add DeviceID and DeviceName to the alarmObject
    const alarmToAdd = { DeviceID, DeviceName, ...restAlarm, Status: "Not Triggered" };

    // Find the last alarm to determine the new AlarmID
    const lastAlarm = await alarmCollection.find({}).sort({ AlarmID: -1 }).limit(1).toArray();
    alarmToAdd.AlarmID = lastAlarm.length > 0 ? lastAlarm[0].AlarmID + 1 : 1;

    const result = await alarmCollection.insertOne(alarmToAdd);
    callback(null, 'Alarm added to alarmCollection');
  } catch (err) {
    console.error(err);
    callback(err);
  }
};


const editAlarm = async (db, labApi, updatedAlarm, callback) => {
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const { AlarmID, _id, ...updatedFields } = updatedAlarm; // Exclude _id from update

  try {
    const result = await alarmCollection.updateOne({ AlarmID }, { $set: updatedFields });

    if (result.modifiedCount === 0) {
      callback(null, `Alarm with AlarmID ${AlarmID} not found`);
    } else {
      callback(null, `Alarm with AlarmID ${AlarmID} updated successfully`);
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
}

const removeAlarm = async (db, labApi, alarmID, callback) => {
  const alarmCollection = getCollection(db, `${labApi}_alarmCollection`);
  const parsedAlarmID = parseInt(alarmID, 10);

  try {
    const result = await alarmCollection.deleteOne({ "AlarmID": parsedAlarmID });

    if (result.deletedCount === 0) {
      callback(null, `Alarm with AlarmID ${parsedAlarmID} not found`);
    } else {
      callback(null, `Alarm with AlarmID ${parsedAlarmID} removed successfully`);
    }
  } catch (err) {
    console.error(err);
    callback(err);
  }
};

module.exports = {
  connectToDatabase,
  initializeLabs,
  login,
  getCollection,
  getAllConfig,
  editDeviceConfig,
  getAllAlarms,
  removeDevice,
  getAllHomePageData,
  addAlarm,
  editAlarm,
  removeAlarm,
  addDevice,
  updateDeviceData
};
