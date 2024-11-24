const mongoose = require('mongoose');


const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL)
            .then(() => console.log('Database Connected SuccessFully!'));
    } catch (error) {
        console.log(`Error in mongoDB ${error}`);
    }
};

module.exports = connectDB;


