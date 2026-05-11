import passport from 'passport';
import { applyReferralReward, validateReferralForSignup } from '../../service/user/referralService.js';
import { getFriendlyErrorMessage } from '../../utils/friendlyError.js';

const getReferralInputFromQuery = (query = {}) => ({
  referralCode: String(query.ref || query.referralCode || "").trim(),
  referralToken: String(query.refToken || query.token || "").trim(),
});

// This starts the Google process
export const googleAuth = async (req, res, next) => {
  const referralInput = getReferralInputFromQuery(req.query);
  const hasReferral = referralInput.referralCode || referralInput.referralToken;

  if (hasReferral) {
    try {
      await validateReferralForSignup(referralInput);
      req.session.pendingReferral = referralInput;
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Referral code or link is invalid.");
      return res.redirect(`/sign-up?status=error&message=${encodeURIComponent(message)}`);
    }
  } else {
    delete req.session.pendingReferral;
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
};

// This handles the return from Google
export const googleAuthCallbackMiddleware = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    
    if (err) {
      return res.redirect('/sign-in?status=error&message=Something went wrong');
    }

    if (!user) {
      const message = info?.message || "Authentication failed";
      return res.redirect(`/sign-in?status=error&message=${encodeURIComponent(message)}`);
    }

    if (user?.$locals?.isNewGoogleUser) {
      req.session.googleSignupUserId = user._id.toString();
    }

    req.logIn(user, (err) => {
      if (err) {
        return res.redirect('/sign-in?status=error&message=Login failed');
      }
      return next();
    });

  })(req, res, next);
};


// This is your final custom logic (Session management)
export const googleAuthSuccess = async (req, res) => {
    req.session.user = req.user._id;
    req.session.isAuth = true;

    const isNewGoogleSignup = req.session.googleSignupUserId === req.user._id.toString();
    const pendingReferral = req.session.pendingReferral;
    delete req.session.googleSignupUserId;
    delete req.session.pendingReferral;

    if (isNewGoogleSignup && pendingReferral) {
      try {
        await validateReferralForSignup({ ...pendingReferral, email: req.user.email });
        await applyReferralReward(req.user, pendingReferral);
      } catch (error) {
        console.error("Google referral reward error:", error);
        const message = getFriendlyErrorMessage(error, "Account created, but referral reward could not be applied.");
        return res.redirect(`/home?status=error&message=${encodeURIComponent(message)}`);
      }
    }

    res.redirect('/home');
};
