import userDb from "../../models/userDb.js"
import { verifyEmail } from "../../service/settingsService.js"

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
        console.log("contr ", newEmail)

    
        await verifyEmail(user, newEmail);

        req.session.otpRequested = true;
    
        return res.status(200).json({ success: true});
      } catch (error) {
        console.log("error in updateEmail: ", error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
}