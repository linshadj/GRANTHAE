import mongoose from 'mongoose';

export const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGODB_URI)
        console.log(`MongoDB Connected: ${connect.connection.host}`);
    }catch(err) {
        console.log("Error in connecting DB: ", err)
    }
}

