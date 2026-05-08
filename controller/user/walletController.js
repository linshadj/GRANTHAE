import * as walletService from "../../service/user/walletService.js";

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
            wallet
        });
    } catch (error) {
        console.error("Add Funds Page Error:", error);
        res.redirect("/wallet?status=error&message=Failed%20to%20load%20wallet.");
    }
};

export const addFunds = async (req, res) => {
    try {
        const { amount, paymentMethod } = req.body;
        await walletService.addFunds(req.user._id, amount, paymentMethod);
        res.redirect("/wallet?status=success&message=Funds%20added%20to%20wallet.");
    } catch (error) {
        console.error("Add Funds Error:", error);
        res.redirect(`/wallet/add-funds?status=error&message=${encodeURIComponent(error.message)}`);
    }
};
