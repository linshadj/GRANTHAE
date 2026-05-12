import crypto from "crypto";
import Razorpay from "razorpay";

let razorpayClient = null;

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || "";

export const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getRazorpayClient = () => {
    if (!isRazorpayConfigured()) {
        throw new Error("Razorpay keys are not configured.");
    }

    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    return razorpayClient;
};

export const createRazorpayOrder = async ({ amount, receipt, notes = {} }) => {
    const amountInPaise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
        throw new Error("Invalid payment amount.");
    }

    return getRazorpayClient().orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: String(receipt).slice(0, 40),
        notes
    });
};

export const verifyRazorpaySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(razorpaySignature);

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};
