import * as walletService from "../../service/user/walletService.js";
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from "../../service/user/razorpayService.js";
import { getFriendlyErrorMessage } from "../../utils/friendlyError.js";

const walletPageData = async (req) => {
    const wallet = await walletService.getWallet(req.user._id);
    const transactions = [...wallet.transactions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
        title: "My Wallet",
        layout: "layouts/user-panel",
        user: req.user,
        path: "/wallet",
        wallet,
        transactions
    };
};

export const getWalletPage = async (req, res) => {
    try {
        res.render("pages/wallet", await walletPageData(req));
    } catch (error) {
        console.error("Wallet Page Error:", error);
        res.status(500).render("pages/error", { title: "Error", message: "Failed to load wallet." });
    }
};

export const getAddFundsPage = async (req, res) => {
    try {
        const wallet = await walletService.getWallet(req.user._id);
        res.render("pages/add-funds", {
            title: "Add Funds",
            layout: "layouts/user-panel",
            user: req.user,
            path: "/wallet",
            wallet,
            razorpayKeyId: getRazorpayKeyId(),
            razorpayConfigured: isRazorpayConfigured()
        });
    } catch (error) {
        console.error("Add Funds Page Error:", error);
        res.redirect("/wallet?status=error&message=Failed%20to%20load%20wallet.");
    }
};

export const addFunds = async (req, res) => {
    let topupIntent = null;

    try {
        if (!isRazorpayConfigured()) {
            return res.status(400).json({ success: false, message: "Razorpay keys are not configured." });
        }

        const { amount } = req.body;
        topupIntent = await walletService.createWalletTopupIntent(req.user._id, amount);
        const razorpayOrder = await createRazorpayOrder({
            amount: topupIntent.amount,
            receipt: topupIntent.transactionId,
            notes: {
                type: "wallet_topup",
                transactionId: topupIntent.transactionId,
                userId: req.user._id.toString()
            }
        });

        await walletService.attachWalletTopupReference(req.user._id, topupIntent.transactionId, razorpayOrder.id);

        res.status(200).json({
            success: true,
            message: "Razorpay wallet top-up initialized.",
            transactionId: topupIntent.transactionId,
            razorpay: {
                keyId: getRazorpayKeyId(),
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                name: "GRANTHAE",
                description: "Wallet top-up",
                prefill: {
                    name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
                    email: req.user.email || ""
                }
            }
        });
    } catch (error) {
        console.error("Add Funds Error:", error);
        if (topupIntent?.transactionId) {
            try {
                await walletService.markWalletTopupFailed(req.user._id, topupIntent.transactionId, error.message);
            } catch (markError) {
                console.error("Mark Wallet Top-up Failed Error:", markError);
            }
        }
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not initialize wallet top-up.") });
    }
};

export const verifyAddFunds = async (req, res) => {
    try {
        const {
            transactionId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        await walletService.completeWalletTopupPayment({
            userId: req.user._id,
            transactionId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        });

        res.status(200).json({
            success: true,
            message: "Funds added to wallet.",
            redirectUrl: "/wallet?status=success&message=Funds%20added%20to%20wallet."
        });
    } catch (error) {
        console.error("Verify Wallet Top-up Error:", error);
        res.status(400).json({
            success: false,
            message: getFriendlyErrorMessage(error, "Payment verification failed."),
            redirectUrl: "/wallet/add-funds?status=error&message=Payment%20verification%20failed."
        });
    }
};

export const markAddFundsFailed = async (req, res) => {
    try {
        const { transactionId, reason } = req.body;
        await walletService.markWalletTopupFailed(req.user._id, transactionId, reason);

        res.status(200).json({
            success: true,
            message: "Wallet top-up failure recorded."
        });
    } catch (error) {
        console.error("Mark Wallet Top-up Failed Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not record wallet top-up failure.") });
    }
};
