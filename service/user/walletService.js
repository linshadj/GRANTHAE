import crypto from "crypto";
import walletDb from "../../models/walletDb.js";
import { verifyRazorpaySignature } from "./razorpayService.js";

const maxAddFundsAmount = 100000;

const roundAmount = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const createTransactionId = () => `WLT${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const getWalletTopupTransaction = (wallet, transactionId) => {
    const transaction = wallet.transactions.find((item) =>
        item.transactionId === transactionId && item.source === "add_funds"
    );

    if (!transaction) {
        throw new Error("Wallet top-up transaction not found.");
    }

    return transaction;
};

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

export const createWalletTopupIntent = async (userId, rawAmount) => {
    const amount = normalizeAmount(rawAmount);
    const wallet = await getWallet(userId);
    const transactionId = createTransactionId();

    wallet.transactions.push({
        transactionId,
        type: "credit",
        source: "add_funds",
        amount,
        description: "Wallet top-up via Razorpay",
        status: "pending",
        balanceAfter: wallet.balance
    });

    await wallet.save();
    return { wallet, transactionId, amount };
};

export const attachWalletTopupReference = async (userId, transactionId, razorpayOrderId) => {
    const wallet = await getWallet(userId);
    const transaction = getWalletTopupTransaction(wallet, transactionId);

    if (transaction.status !== "pending") {
        throw new Error("Wallet top-up transaction is not pending.");
    }

    transaction.referenceId = razorpayOrderId;
    await wallet.save();
    return transaction;
};

export const completeWalletTopupPayment = async ({
    userId,
    transactionId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
}) => {
    const wallet = await getWallet(userId);
    const transaction = getWalletTopupTransaction(wallet, transactionId);

    if (transaction.referenceId !== razorpayOrderId) {
        throw new Error("Wallet payment reference mismatch.");
    }

    if (transaction.status === "completed") {
        return wallet;
    }

    if (transaction.status === "failed") {
        throw new Error("This wallet top-up has already failed.");
    }

    const isValidSignature = verifyRazorpaySignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    });

    if (!isValidSignature) {
        transaction.status = "failed";
        transaction.description = "Wallet top-up via Razorpay failed verification";
        await wallet.save();
        throw new Error("Payment verification failed.");
    }

    wallet.balance = roundAmount(wallet.balance + Number(transaction.amount || 0));
    transaction.status = "completed";
    transaction.description = `Wallet top-up via Razorpay (${razorpayPaymentId})`;
    transaction.balanceAfter = wallet.balance;

    await wallet.save();
    return wallet;
};

export const markWalletTopupFailed = async (userId, transactionId, reason = "Payment failed or was cancelled.") => {
    const wallet = await getWallet(userId);
    const transaction = getWalletTopupTransaction(wallet, transactionId);

    if (transaction.status === "completed") {
        return wallet;
    }

    transaction.status = "failed";
    transaction.description = `Wallet top-up via Razorpay failed: ${String(reason || "Payment failed.").slice(0, 180)}`;
    transaction.balanceAfter = wallet.balance;
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
