import userDb from "../../models/userDb.js"
import { changePasswordService, verifyEmail } from "../../service/user/settingsService.js"
import { STATUS_CODES } from "../../utils/statusCodes.js";
import { getFriendlyErrorMessage } from "../../utils/friendlyError.js";


export const viewSettings = async (req, res) => {
    try {
        const user = await userDb.findById(req.session.user)
        res.render("pages/settings", {user, title: "Settings", layout: "layouts/user-panel"})
    }catch (err) {
        console.error("Error in viewSettings:", err.message);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).render("pages/error", {
            title: "Error",
            message: "Could not load settings."
        });
    }
}

export const changeEmail = async (req, res) => {
    try {

        const user = await userDb.findById(req.session.user)
        const { newEmail } = req.body;
        await verifyEmail(user, newEmail);
        req.session.newEmail = newEmail;
        req.session.otpRequested = true;
    
        return res.status(STATUS_CODES.OK).json({ success: true, message: "Verification code sent to new email."});
      } catch (error) {
        console.error("Error in changeEmail:", error.message);
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: getFriendlyErrorMessage(error, "Could not update email. Please try again.") });
      }
}

export const changePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword } = req.body;
        
        await changePasswordService(userId, currentPassword, newPassword);

        return res.status(STATUS_CODES.OK).json({ success: true, message: "Password updated successfully.", redirectUrl: "/settings?status=success&message=Password updated successfully." });
    } catch (error) {
        console.error("Error in changePassword:", error.message);
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: getFriendlyErrorMessage(error, "Could not update password. Please try again.") });
    }
}
