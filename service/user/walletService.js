import crypto from "crypto";
import walletDb from "../../models/walletDb.js";

const maxAddFundsAmount = 100000;
const addFundsPaymentMethods = new Map([
    ["card", "Credit/Debit Card"],
    ["upi", "UPI"],
    ["net_banking", "Net Banking"]
]);

const roundAmount = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const createTransactionId = () => `WLT${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const normalizeAmount = (rawAmount) => {
    const amount = roundAmount(rawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount.");
    }

    if (amount > maxAddFundsAmount) {
        throw new Error(`Maximum add-funds amount is ${maxAddFundsAmount}.`);
    }

    return amount;
};

export const getWallet = async (userId) => {
    let wallet = await walletDb.findOne({ user: userId });

    if (!wallet) {
        wallet = await walletDb.create({ user: userId });
    }

    return wallet;
};

export const addFunds = async (userId, rawAmount, paymentMethod = "card") => {
    const amount = normalizeAmount(rawAmount);
    const paymentLabel = addFundsPaymentMethods.get(paymentMethod);

    if (!paymentLabel) {
        throw new Error("Select a valid payment method.");
    }

    const wallet = await getWallet(userId);

    wallet.balance = roundAmount(wallet.balance + amount);
    wallet.transactions.push({
        transactionId: createTransactionId(),
        type: "credit",
        source: "add_funds",
        amount,
        description: `Wallet top-up via ${paymentLabel}`,
        status: "completed",
        balanceAfter: wallet.balance
    });

    await wallet.save();
    return wallet;
};

export const creditWallet = async (userId, rawAmount, description, source = "adjustment", referenceId = "") => {
    const amount = normalizeAmount(rawAmount);
    const wallet = await getWallet(userId);

    wallet.balance = roundAmount(wallet.balance + amount);
    wallet.transactions.push({
        transactionId: createTransactionId(),
        type: "credit",
        source,
        amount,
        description,
        status: "completed",
        referenceId,
        balanceAfter: wallet.balance
    });

    await wallet.save();
    return wallet;
};

export const debitWallet = async (userId, rawAmount, description, source = "order_payment", referenceId = "") => {
    const amount = normalizeAmount(rawAmount);
    const wallet = await getWallet(userId);

    if (wallet.balance < amount) {
        throw new Error("Insufficient wallet balance.");
    }

    wallet.balance = roundAmount(wallet.balance - amount);
    wallet.transactions.push({
        transactionId: createTransactionId(),
        type: "debit",
        source,
        amount,
        description,
        status: "completed",
        referenceId,
        balanceAfter: wallet.balance
    });

    await wallet.save();
    return wallet;
};
