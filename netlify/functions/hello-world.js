const { connectToDatabase, login } = require('../../databaseFunctions/db');

exports.handler = async function () {
    const nameOfLab = "nia lab";
    const passwordOfLab = "pi4life";

    try {
        const db = await connectToDatabase();

        const lab = await login(db, nameOfLab, passwordOfLab);

        if (lab.success) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    api: lab.api,
                    message: 'Login successful'
                })
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    message: 'Login unsuccessful'
                })
            };
        }
    } catch (err) {
        console.error(err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error'
            })
        };
    }
};
