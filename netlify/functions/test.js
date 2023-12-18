// Function to see if slack is working

exports.handler = async function () {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Lab Function API is working'
        })
    }
} 