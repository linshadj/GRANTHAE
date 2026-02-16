import userDb from "../../models/userDb.js"
import { changePasswordService, verifyEmail } from "../../service/settingsService.js"

export const viewSettings = async (req, res) => {
    try {
        const user = await userDb.findById(req.session.user)
        res.render("pages/settings", {user, title: "Settings", layout: "layouts/user-panel"})
    }catch (err) {
        console.log("Error in viewSettings")
    }
}

export const changeEmail = async (req, res) => {
    try {

        const user = await userDb.findById(req.session.user)
        const { newEmail } = req.body;
        await verifyEmail(user, newEmail);
        req.session.newEmail = newEmail;
        req.session.otpRequested = true;
    
        return res.status(200).json({ success: true, message: "Verification code sent to new email."});
      } catch (error) {
        console.log("error in updateEmail: ", error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
}

export const changePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword } = req.body;
        
        await changePasswordService(userId, currentPassword, newPassword);

        return res.status(200).json({ success: true, message: "Password updated successfully.", redirectUrl: "/settings?status=success&message=Password updated successfully." });
    } catch (error) {
        console.log("Error in changePassword: ", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}