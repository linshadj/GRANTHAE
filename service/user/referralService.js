import crypto from "crypto";
import userDb from "../../models/userDb.js";
import referralDb from "../../models/referralDb.js";
import { creditWallet } from "./walletService.js";

const referrerRewardAmount = Number(process.env.REFERRAL_REFERRER_REWARD || 100);
const refereeRewardAmount = Number(process.env.REFERRAL_SIGNUP_REWARD || 50);

const normalizeReferralCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeReferralToken = (value) => String(value || "").trim();

const createReferralCode = (user) => {
    const namePart = normalizeReferralCode(user.firstName || user.email || "GRANTHAE").slice(0, 5) || "GRANT";
    return `${namePart}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const createReferralToken = () => crypto.randomBytes(16).toString("hex");

const assignUniqueReferralIdentity = async (user) => {
    if (!user.referralCode) {
        let code = createReferralCode(user);
        while (await userDb.exists({ referralCode: code, _id: { $ne: user._id } })) {
            code = createReferralCode(user);
        }
        user.referralCode = code;
    }

    if (!user.referralToken) {
        let token = createReferralToken();
        while (await userDb.exists({ referralToken: token, _id: { $ne: user._id } })) {
            token = createReferralToken();
        }
        user.referralToken = token;
    }

    await user.save();
    return user;
};

export const ensureReferralIdentity = async (userOrId) => {
    const user = typeof userOrId?.save === "function"
        ? userOrId
        : await userDb.findById(userOrId);

    if (!user) throw new Error("User not found.");
    if (user.referralCode && user.referralToken) return user;
    return assignUniqueReferralIdentity(user);
};

export const normalizeReferralInput = ({ referralCode = "", referralToken = "" } = {}) => ({
    referralCode: normalizeReferralCode(referralCode),
    referralToken: normalizeReferralToken(referralToken),
});

export const resolveReferral = async ({ referralCode = "", referralToken = "" } = {}) => {
    const normalized = normalizeReferralInput({ referralCode, referralToken });

    if (!normalized.referralCode && !normalized.referralToken) {
        return null;
    }

    const query = normalized.referralToken
        ? { referralToken: normalized.referralToken }
        : { referralCode: normalized.referralCode };

    const referrer = await userDb.findOne({ ...query, isBlocked: false });
    if (!referrer) {
        throw new Error("Referral code or link is invalid.");
    }

    return {
        referrer,
        referralCode: referrer.referralCode,
        referralToken: referrer.referralToken,
        source: normalized.referralToken ? "token" : "code",
    };
};

export const validateReferralForSignup = async ({ referralCode = "", referralToken = "", email = "" } = {}) => {
    const resolved = await resolveReferral({ referralCode, referralToken });
    if (!resolved) return null;

    if (email && resolved.referrer.email === String(email).trim().toLowerCase()) {
        throw new Error("You cannot use your own referral code.");
    }

    return {
        referralCode: resolved.referralCode,
        referralToken: resolved.source === "token" ? resolved.referralToken : "",
        source: resolved.source,
    };
};

export const applyReferralReward = async (newUser, referralInput = {}) => {
    const resolved = await resolveReferral(referralInput);
    if (!resolved) return null;

    if (resolved.referrer._id.toString() === newUser._id.toString()) {
        return null;
    }

    const existingReferral = await referralDb.findOne({ referee: newUser._id });
    if (existingReferral) return existingReferral;

    const referral = await referralDb.create({
        referrer: resolved.referrer._id,
        referee: newUser._id,
        referralCode: resolved.referralCode,
        referralToken: resolved.source === "token" ? resolved.referralToken : "",
        source: resolved.source,
        referrerReward: referrerRewardAmount,
        refereeReward: refereeRewardAmount,
        rewardedAt: new Date(),
    });

    newUser.referredBy = resolved.referrer._id;
    newUser.referredAt = new Date();
    await newUser.save();

    if (referrerRewardAmount > 0) {
        await creditWallet(
            resolved.referrer._id,
            referrerRewardAmount,
            `Referral reward for inviting ${newUser.firstName}`,
            "referral_reward",
            referral._id.toString()
        );
    }

    if (refereeRewardAmount > 0) {
        await creditWallet(
            newUser._id,
            refereeRewardAmount,
            "Signup referral reward",
            "referral_reward",
            referral._id.toString()
        );
    }

    return referral;
};

export const getReferralSummary = async (userId, origin = "") => {
    const user = await ensureReferralIdentity(userId);
    const [referralCount, referrals] = await Promise.all([
        referralDb.countDocuments({ referrer: user._id, status: "completed" }),
        referralDb.find({ referrer: user._id, status: "completed" })
            .populate("referee", "firstName lastName email createdAt")
            .sort({ createdAt: -1 })
            .limit(5),
    ]);

    const baseUrl = String(origin || "").replace(/\/$/, "");

    return {
        code: user.referralCode,
        token: user.referralToken,
        referralUrl: `${baseUrl}/sign-up?ref=${encodeURIComponent(user.referralCode)}`,
        tokenUrl: `${baseUrl}/sign-up?refToken=${encodeURIComponent(user.referralToken)}`,
        referralCount,
        referrerRewardAmount,
        refereeRewardAmount,
        recentReferrals: referrals,
    };
};
