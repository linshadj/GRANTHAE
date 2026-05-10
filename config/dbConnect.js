import mongoose from 'mongoose';

export const connectDb = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("MONGODB_URI is not configured.");
    }

    try {
        const connect = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`MongoDB Connected: ${connect.connection.host}`);
        return connect;
    } catch (err) {
        console.error("Error in connecting DB:", err.message);
        throw err;
    }
};
